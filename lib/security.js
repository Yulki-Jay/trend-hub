const crypto = require('crypto');
const net = require('net');
const dns = require('dns').promises;
const db = require('./db');

const COMMON_PASSWORDS = new Set([
  '123456789012', 'password1234', 'password123!', 'qwertyuiop12',
  'admin123456', 'adminadmin12', 'letmein12345', 'trendhub1234',
]);

function configuredOrigin() {
  const value = String(process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || '').trim();
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

function trustProxy() {
  return process.env.TRUST_PROXY === '1';
}

function isSecureRequest(request) {
  if (process.env.COOKIE_SECURE === '1') return true;
  if (process.env.COOKIE_SECURE === '0') return false;
  const configured = configuredOrigin();
  if (configured) return configured.startsWith('https://');
  if (trustProxy()) {
    return String(request.headers.get('x-forwarded-proto') || '').split(',')[0].trim() === 'https';
  }
  return new URL(request.url).protocol === 'https:';
}

function requestClientIp(request) {
  if (trustProxy()) {
    const forwarded = String(request.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    if (forwarded) return forwarded.slice(0, 100);
  }
  return String(request.ip || request.headers.get('x-real-ip') || 'unknown').slice(0, 100);
}

function validatePassword(password, context = {}) {
  const value = String(password || '');
  if (value.length < 12 || value.length > 128) {
    throw new Error('密码长度需要为 12～128 位');
  }
  if (COMMON_PASSWORDS.has(value.toLowerCase())) throw new Error('密码过于常见，请更换一个更安全的密码');
  const identifiers = [context.username, context.email, context.displayName]
    .map((item) => String(item || '').trim().toLowerCase())
    .filter((item) => item.length >= 3);
  const lower = value.toLowerCase();
  if (identifiers.some((item) => lower.includes(item))) throw new Error('密码不能包含用户名、邮箱或昵称');
  return value;
}

function rateLimitKey(action, value) {
  return crypto.createHash('sha256').update(`${action}:${String(value || '')}`).digest('hex');
}

function consumeRateLimit(action, value, { limit, windowSeconds, blockSeconds }) {
  const consume = db.transaction(() => {
    const now = Math.floor(Date.now() / 1000);
    const key = rateLimitKey(action, value);
    const row = db.prepare('SELECT * FROM auth_rate_limits WHERE key=?').get(key);
    if (row?.blocked_until > now) return { allowed: false, retryAfter: row.blocked_until - now };

    const windowStart = !row || row.window_start + windowSeconds <= now ? now : row.window_start;
    const attempts = !row || row.window_start + windowSeconds <= now ? 1 : row.attempts + 1;
    const blockedUntil = attempts > limit ? now + blockSeconds : 0;
    db.prepare(`
      INSERT INTO auth_rate_limits(key,action,attempts,window_start,blocked_until)
      VALUES(?,?,?,?,?)
      ON CONFLICT(key) DO UPDATE SET attempts=excluded.attempts,window_start=excluded.window_start,
        blocked_until=excluded.blocked_until,action=excluded.action
    `).run(key, action, attempts, windowStart, blockedUntil);
    if (Math.random() < 0.02) db.prepare('DELETE FROM auth_rate_limits WHERE window_start<? AND blocked_until<?')
      .run(now - 86400, now);
    return blockedUntil ? { allowed: false, retryAfter: blockSeconds } : { allowed: true, remaining: limit - attempts };
  });
  return consume();
}

function clearRateLimit(action, value) {
  db.prepare('DELETE FROM auth_rate_limits WHERE key=?').run(rateLimitKey(action, value));
}

function audit({ actorUserId = null, action, targetUserId = null, request = null, metadata = null }) {
  let serialized = null;
  if (metadata) serialized = JSON.stringify(metadata).slice(0, 4000);
  db.prepare(`
    INSERT INTO security_audit_logs(actor_user_id,action,target_user_id,ip,metadata)
    VALUES(?,?,?,?,?)
  `).run(actorUserId, action, targetUserId, request ? requestClientIp(request) : null, serialized);
}

function isPrivateHostname(hostname) {
  const host = String(hostname || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return true;
  const kind = net.isIP(host);
  if (kind === 4) {
    const parts = host.split('.').map(Number);
    return parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) ||
      (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168) ||
      (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) ||
      parts[0] >= 224;
  }
  if (kind === 6) {
    if (host.startsWith('::ffff:')) return isPrivateHostname(host.slice(7));
    return host === '::' || host === '::1' || host.startsWith('fc') || host.startsWith('fd') ||
      host.startsWith('fe8') || host.startsWith('fe9') || host.startsWith('fea') || host.startsWith('feb');
  }
  return false;
}

function validateExternalUrl(value) {
  let url;
  try { url = new URL(String(value || '').trim()); } catch { throw new Error('请输入有效的网址'); }
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('网址仅支持 HTTP 或 HTTPS');
  if (url.username || url.password) throw new Error('网址不能包含账号或密码');
  if (isPrivateHostname(url.hostname)) throw new Error('不允许访问本机或内网地址');
  return url.toString();
}

function sanitizePublicHttpUrl(value, base) {
  if (!value) return null;
  try {
    const url = new URL(String(value).trim(), base);
    return ['http:', 'https:'].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

async function assertPublicHostname(hostname) {
  if (isPrivateHostname(hostname)) throw new Error('不允许访问本机或内网地址');
  const addresses = await dns.lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((item) => isPrivateHostname(item.address))) {
    throw new Error('数据源解析到了本机或内网地址');
  }
}

async function fetchPublicText(value, { headers = {}, timeoutMs = 15000, maxBytes = 5 * 1024 * 1024, redirects = 4 } = {}) {
  let current = validateExternalUrl(value);
  for (let hop = 0; hop <= redirects; hop += 1) {
    const url = new URL(current);
    await assertPublicHostname(url.hostname);
    const response = await fetch(url, {
      headers,
      redirect: 'manual',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || hop === redirects) throw new Error('数据源重定向次数过多');
      current = validateExternalUrl(new URL(location, current).toString());
      continue;
    }
    if (!response.ok) throw new Error(`数据源请求失败（HTTP ${response.status}）`);
    const length = Number(response.headers.get('content-length') || 0);
    if (length > maxBytes) throw new Error('数据源响应体过大');
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > maxBytes) throw new Error('数据源响应体过大');
    return buffer.toString('utf8');
  }
  throw new Error('数据源请求失败');
}

module.exports = {
  configuredOrigin,
  isSecureRequest,
  requestClientIp,
  validatePassword,
  consumeRateLimit,
  clearRateLimit,
  audit,
  validateExternalUrl,
  sanitizePublicHttpUrl,
  fetchPublicText,
};
