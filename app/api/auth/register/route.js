import { NextResponse } from 'next/server';
import { createUser, createSession, setSessionCookie } from '../../../../lib/user-auth';
import { getSetting } from '../../../../lib/settings';
import { audit, consumeRateLimit, requestClientIp } from '../../../../lib/security';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (getSetting('registration_enabled', '1') !== '1') {
    return NextResponse.json({ ok: false, error: '当前未开放公开注册' }, { status: 403 });
  }
  try {
    const ip = requestClientIp(req);
    if (ip !== 'unknown') {
      const limit = consumeRateLimit('register-ip', ip, { limit: 5, windowSeconds: 3600, blockSeconds: 3600 });
      if (!limit.allowed) {
        return NextResponse.json(
          { ok: false, error: '注册操作过于频繁，请稍后再试' },
          { status: 429, headers: { 'Retry-After': String(limit.retryAfter || 3600) } },
        );
      }
    }
    const body = await req.json();
    const user = createUser({
      username: body.username,
      email: body.email,
      password: body.password,
      displayName: body.display_name,
    });
    setSessionCookie(createSession(user.id), req);
    audit({ actorUserId: user.id, action: 'auth.register', targetUserId: user.id, request: req });
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
