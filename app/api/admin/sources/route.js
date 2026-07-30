import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import db from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/user-auth';
import { audit, validateExternalUrl } from '../../../../lib/security';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const items = db.prepare('SELECT * FROM sources ORDER BY category, id').all();
  return NextResponse.json({ items });
}

export async function POST(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  try {
    const { name, url, category } = await req.json();
    const safeName = String(name || '').trim();
    if (!safeName || safeName.length > 100) throw new Error('数据源名称长度需要为 1～100 位');
    const safeUrl = validateExternalUrl(url);
    const safeCategory = ['tech', 'economy', 'politics'].includes(category) ? category : 'tech';
    const result = db.prepare('INSERT INTO sources(name,type,url,category) VALUES(?,?,?,?)').run(
      safeName, 'rss', safeUrl, safeCategory,
    );
    audit({ actorUserId: getCurrentUser().id, action: 'admin.source_created', request: req, metadata: { id: result.lastInsertRowid } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ error: e.message || '创建数据源失败' }, { status: 400 });
  }
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
  audit({ actorUserId: getCurrentUser().id, action: 'admin.source_deleted', request: req, metadata: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
