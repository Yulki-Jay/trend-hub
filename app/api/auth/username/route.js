import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { getCurrentUser, normalizeUsername, validateUsername } from '../../../../lib/user-auth';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const current = getCurrentUser();
  if (!current) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const value = normalizeUsername(new URL(req.url).searchParams.get('value'));
  try { validateUsername(value); } catch (e) {
    return NextResponse.json({ available: false, valid: false, error: e.message });
  }
  const row = db.prepare('SELECT id FROM users WHERE username=? COLLATE NOCASE AND id!=?')
    .get(value, current.id);
  return NextResponse.json({ available: !row, valid: true });
}
