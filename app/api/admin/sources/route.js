import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const items = db.prepare('SELECT * FROM sources ORDER BY category, id').all();
  return NextResponse.json({ items });
}

export async function POST(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { name, url, category } = await req.json();
  if (!name || !url) return NextResponse.json({ error: '缺少参数' }, { status: 400 });
  db.prepare('INSERT INTO sources(name,type,url,category) VALUES(?,?,?,?)').run(
    name, 'rss', url, category || 'tech'
  );
  return NextResponse.json({ ok: true });
}

export async function PATCH(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id, enabled } = await req.json();
  db.prepare('UPDATE sources SET enabled=? WHERE id=?').run(enabled ? 1 : 0, id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { id } = await req.json();
  db.prepare('DELETE FROM sources WHERE id=?').run(id);
  return NextResponse.json({ ok: true });
}
