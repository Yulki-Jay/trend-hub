import { NextResponse } from 'next/server';
import { authenticateUser, createSession, setSessionCookie } from '../../../../lib/user-auth';
import { audit, clearRateLimit, consumeRateLimit, requestClientIp } from '../../../../lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  let body;
  try { body = await req.json(); } catch {
    return NextResponse.json({ ok: false, error: '请求格式错误' }, { status: 400 });
  }
  const identifier = String(body.identifier || '').trim().toLowerCase().slice(0, 254);
  const ip = requestClientIp(req);
  const limits = [
    consumeRateLimit('login-identifier', identifier || 'empty', { limit: 8, windowSeconds: 900, blockSeconds: 900 }),
  ];
  if (ip !== 'unknown') limits.push(
    consumeRateLimit('login-ip', ip, { limit: 40, windowSeconds: 900, blockSeconds: 900 }),
  );
  const blocked = limits.find((item) => !item.allowed);
  if (blocked) {
    audit({ action: 'auth.login_blocked', request: req, metadata: { identifier } });
    return NextResponse.json(
      { ok: false, error: '登录尝试过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(blocked.retryAfter || 900) } },
    );
  }
  const user = authenticateUser(identifier, body.password);
  if (!user) {
    return NextResponse.json({ ok: false, error: '用户名、邮箱或密码错误' }, { status: 401 });
  }
  clearRateLimit('login-identifier', identifier);
  if (ip !== 'unknown') clearRateLimit('login-ip', ip);
  setSessionCookie(createSession(user.id), req);
  audit({ actorUserId: user.id, action: 'auth.login_success', targetUserId: user.id, request: req });
  return NextResponse.json({ ok: true, user });
}
