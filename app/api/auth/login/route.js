import { NextResponse } from 'next/server';
import { authenticateUser, createSession, setSessionCookie } from '../../../../lib/user-auth';

export async function POST(req) {
  const body = await req.json();
  const user = authenticateUser(body.identifier, body.password);
  if (!user) {
    return NextResponse.json({ ok: false, error: '用户名、邮箱或密码错误' }, { status: 401 });
  }
  setSessionCookie(createSession(user.id));
  return NextResponse.json({ ok: true, user });
}
