import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getSetting } from '../../../../lib/settings';
import { adminToken, COOKIE } from '../../../../lib/auth';

export async function POST(req) {
  const { password } = await req.json();
  const real = getSetting('admin_password', 'admin123');
  if (password !== real) {
    return NextResponse.json({ ok: false, error: '密码错误' }, { status: 401 });
  }
  cookies().set(COOKIE, adminToken(), {
    httpOnly: true, sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 7,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  cookies().delete(COOKIE);
  return NextResponse.json({ ok: true });
}
