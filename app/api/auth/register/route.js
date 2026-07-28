import { NextResponse } from 'next/server';
import { createUser, createSession, setSessionCookie } from '../../../../lib/user-auth';

export async function POST(req) {
  try {
    const body = await req.json();
    const user = createUser({
      username: body.username,
      email: body.email,
      password: body.password,
      displayName: body.display_name,
    });
    setSessionCookie(createSession(user.id));
    return NextResponse.json({ ok: true, user }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
