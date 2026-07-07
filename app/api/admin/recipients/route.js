import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json({ items: db.prepare('SELECT * FROM recipients ORDER BY id').all() });
}

export async function POST(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { email } = await req.json();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email || ''))
    return NextResponse.json({ error: '邮箱格式错误' }, { status: 400 });
  try {
    db.prepare('INSERT INTO recipients(email) VALUES(?)').run(email);
  } catch {
    return NextResponse.json({ error: '邮箱已存在' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, enabled } = await req.json();
  db.prepare('UPDATE recipients SET enabled=? WHERE id=?').run(enabled ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json();
  db.prepare('DELETE FROM recipients WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
