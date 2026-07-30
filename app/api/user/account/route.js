import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import {
  getCurrentUser,
  normalizeEmail,
  normalizeUsername,
  updateUserAccount,
  createSession,
  setSessionCookie,
} from '../../../../lib/user-auth';
import { audit, consumeRateLimit } from '../../../../lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  const current = getCurrentUser();
  if (!current) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const details = db.prepare('SELECT created_at,updated_at FROM users WHERE id=?').get(current.id);
  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM user_favorites WHERE user_id=?) favorites,
      (SELECT COUNT(*) FROM user_dismissals WHERE user_id=?) dismissals
  `).get(current.id, current.id);
  return NextResponse.json({ user: current, details, counts });
}

export async function PATCH(req) {
  const current = getCurrentUser();
  if (!current) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const limit = consumeRateLimit('account-update', current.id, { limit: 12, windowSeconds: 900, blockSeconds: 900 });
    if (!limit.allowed) return NextResponse.json(
      { ok: false, error: '账号修改过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 900) } },
    );
    const body = await req.json();
    const username = normalizeUsername(body.username);
    const email = normalizeEmail(body.email);
    const identityChanged = username !== current.username || email !== current.email;
    const duplicate = db.prepare(`
      SELECT username,email FROM users WHERE id!=? AND (username=? COLLATE NOCASE OR email=? COLLATE NOCASE) LIMIT 1
    `).get(current.id, username, email);
    if (duplicate) {
      const field = duplicate.username.toLowerCase() === username ? 'username' : 'email';
      return NextResponse.json({ ok: false, error: field === 'username' ? '用户名已被使用' : '邮箱已被使用', field }, { status: 409 });
    }
    const user = updateUserAccount(current.id, body);
    if (body.new_password || identityChanged) {
      db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(current.id);
      setSessionCookie(createSession(current.id), req);
      audit({
        actorUserId: current.id,
        action: body.new_password ? 'account.password_changed' : 'account.identity_changed',
        targetUserId: current.id,
        request: req,
      });
    } else {
      audit({ actorUserId: current.id, action: 'account.profile_changed', targetUserId: current.id, request: req });
    }
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
