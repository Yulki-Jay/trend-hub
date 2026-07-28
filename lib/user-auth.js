const crypto = require('crypto');
const db = require('./db');

const USER_COOKIE = 'th_user_session';
const SESSION_DAYS = 30;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase();
}

function validateUsername(value) {
  const username = normalizeUsername(value);
  if (!/^[a-z0-9_-]{3,32}$/.test(username)) {
    throw new Error('用户名需为 3～32 位字母、数字、下划线或短横线');
  }
  return username;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    display_name: row.display_name,
    role: row.role || 'user',
  };
}

function validateRegistration({ username, email, password, displayName }) {
  const normalizedUsername = validateUsername(username);
  const normalized = normalizeEmail(email);
  const name = String(displayName || normalizedUsername).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) || normalized.length > 254) {
    throw new Error('请输入有效邮箱');
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    throw new Error('密码长度需要为 8～128 位');
  }
  if (name.length < 1 || name.length > 50) throw new Error('昵称长度需要为 1～50 位');
  return { username: normalizedUsername, email: normalized, password, displayName: name };
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${derived}`;
}

function verifyPassword(password, stored) {
  const [method, salt, expectedHex] = String(stored || '').split(':');
  if (method !== 'scrypt' || !salt || !expectedHex) return false;
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHex, 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function createUser(input) {
  const data = validateRegistration(input);
  try {
    const result = db.prepare(`
      INSERT INTO users(username,email,display_name,password_hash) VALUES(?,?,?,?)
    `).run(data.username, data.email, data.displayName, hashPassword(data.password));
    return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid));
  } catch (e) {
    if (String(e.code || '').startsWith('SQLITE_CONSTRAINT')) throw new Error('用户名或邮箱已经注册');
    throw e;
  }
}

function authenticateUser(identifier, password) {
  const normalized = String(identifier || '').trim().toLowerCase();
  if (typeof password !== 'string' || password.length > 128) return null;
  const row = db.prepare('SELECT * FROM users WHERE email=? OR username=?').get(normalized, normalized);
  if (!row || !verifyPassword(password, row.password_hash)) return null;
  return publicUser(row);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  const expiresAt = Math.floor(Date.now() / 1000) + SESSION_DAYS * 86400;
  db.prepare('DELETE FROM user_sessions WHERE expires_at<?').run(Math.floor(Date.now() / 1000));
  db.prepare('INSERT INTO user_sessions(user_id,token_hash,expires_at) VALUES(?,?,?)')
    .run(userId, tokenHash(token), expiresAt);
  return { token, maxAge: SESSION_DAYS * 86400 };
}

function ensureDefaultAdmin({ username = 'admin', email = 'admin@trendhub.local', password = 'admin123' } = {}) {
  const existing = db.prepare("SELECT * FROM users WHERE role='admin' ORDER BY id LIMIT 1").get();
  if (existing) return publicUser(existing);
  const normalizedUsername = validateUsername(username);
  const normalizedEmail = normalizeEmail(email);
  const result = db.prepare(`
    INSERT INTO users(username,email,display_name,password_hash,role) VALUES(?,?,?,?, 'admin')
  `).run(normalizedUsername, normalizedEmail, '管理员', hashPassword(password));
  return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(result.lastInsertRowid));
}

function updateUserAccount(userId, input) {
  const current = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!current) throw new Error('用户不存在');
  const username = validateUsername(input.username);
  const email = normalizeEmail(input.email);
  const displayName = String(input.display_name || '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new Error('请输入有效邮箱');
  if (displayName.length < 1 || displayName.length > 50) throw new Error('昵称长度需要为 1～50 位');

  let passwordHash = current.password_hash;
  if (input.new_password) {
    if (!verifyPassword(String(input.current_password || ''), current.password_hash)) throw new Error('当前密码错误');
    if (String(input.new_password).length < 8 || String(input.new_password).length > 128) {
      throw new Error('新密码长度需要为 8～128 位');
    }
    passwordHash = hashPassword(String(input.new_password));
  }
  try {
    db.prepare(`
      UPDATE users SET username=?,email=?,display_name=?,password_hash=?,updated_at=datetime('now','localtime')
      WHERE id=?
    `).run(username, email, displayName, passwordHash, userId);
  } catch (e) {
    if (String(e.code || '').startsWith('SQLITE_CONSTRAINT')) throw new Error('用户名或邮箱已被使用');
    throw e;
  }
  return publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(userId));
}

function cookieStore() {
  return require('next/headers').cookies();
}

function setSessionCookie(session) {
  cookieStore().set(USER_COOKIE, session.token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === '1',
    path: '/',
    maxAge: session.maxAge,
  });
}

function getCurrentUser() {
  const token = cookieStore().get(USER_COOKIE)?.value;
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.* FROM user_sessions s
    JOIN users u ON u.id=s.user_id
    WHERE s.token_hash=? AND s.expires_at>?
  `).get(tokenHash(token), Math.floor(Date.now() / 1000));
  return publicUser(row);
}

function deleteCurrentSession() {
  const store = cookieStore();
  const token = store.get(USER_COOKIE)?.value;
  if (token) db.prepare('DELETE FROM user_sessions WHERE token_hash=?').run(tokenHash(token));
  store.delete(USER_COOKIE);
}

module.exports = {
  USER_COOKIE,
  normalizeEmail,
  normalizeUsername,
  createUser,
  authenticateUser,
  ensureDefaultAdmin,
  updateUserAccount,
  createSession,
  setSessionCookie,
  getCurrentUser,
  deleteCurrentSession,
};
