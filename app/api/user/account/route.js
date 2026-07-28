import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import {
  getCurrentUser,
  updateUserAccount,
  createSession,
  setSessionCookie,
} from '../../../../lib/user-auth';

export async function PATCH(req) {
  const current = getCurrentUser();
  if (!current) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const user = updateUserAccount(current.id, body);
    if (body.new_password) {
      db.prepare('DELETE FROM user_sessions WHERE user_id=?').run(current.id);
      setSessionCookie(createSession(current.id));
    }
    return NextResponse.json({ ok: true, user });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}
