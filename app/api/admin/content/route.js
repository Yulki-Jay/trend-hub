import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

const TYPES = new Set(['repos', 'explore', 'news', 'papers']);

export async function GET(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const type = TYPES.has(searchParams.get('type')) ? searchParams.get('type') : 'news';
  const q = String(searchParams.get('q') || '').trim();
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = Math.min(100, Math.max(10, Number(searchParams.get('pageSize')) || 20));
  const like = `%${q}%`;
  let items;
  let total;

  if (type === 'repos') {
    const where = q ? 'WHERE full_name LIKE ? OR description LIKE ?' : '';
    const params = q ? [like, like] : [];
    total = db.prepare(`SELECT COUNT(DISTINCT full_name) count FROM repos ${where}`).get(...params).count;
    items = db.prepare(`
      SELECT full_name key,full_name title,MAX(description) summary,MAX(language) meta,
        MAX(stars) metric,MAX(fetched_date) date
      FROM repos ${where} GROUP BY full_name ORDER BY MAX(id) DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize);
  } else if (type === 'explore') {
    const where = q ? 'WHERE full_name LIKE ? OR description LIKE ?' : '';
    const params = q ? [like, like] : [];
    total = db.prepare(`SELECT COUNT(*) count FROM explore_repos ${where}`).get(...params).count;
    items = db.prepare(`
      SELECT full_name key,full_name title,description summary,
        CASE WHEN language!='' THEN language||' · '||reason ELSE reason END meta,
        stars metric,fetched_date date FROM explore_repos ${where}
      ORDER BY score DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize);
  } else if (type === 'papers') {
    const where = q ? 'WHERE title LIKE ? OR summary LIKE ? OR authors LIKE ?' : '';
    const params = q ? [like, like, like] : [];
    total = db.prepare(`SELECT COUNT(*) count FROM papers ${where}`).get(...params).count;
    items = db.prepare(`
      SELECT CAST(id AS TEXT) key,title,summary,source||' · '||category meta,
        citations metric,created_at date FROM papers ${where}
      ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize);
  } else {
    const where = q ? 'WHERE title LIKE ? OR summary LIKE ? OR source LIKE ?' : '';
    const params = q ? [like, like, like] : [];
    total = db.prepare(`SELECT COUNT(*) count FROM news ${where}`).get(...params).count;
    items = db.prepare(`
      SELECT CAST(id AS TEXT) key,title,summary,source||' · '||category meta,
        0 metric,created_at date FROM news ${where}
      ORDER BY id DESC LIMIT ? OFFSET ?
    `).all(...params, pageSize, (page - 1) * pageSize);
  }

  const counts = {
    repos: db.prepare('SELECT COUNT(DISTINCT full_name) count FROM repos').get().count,
    explore: db.prepare('SELECT COUNT(*) count FROM explore_repos').get().count,
    news: db.prepare('SELECT COUNT(*) count FROM news').get().count,
    papers: db.prepare('SELECT COUNT(*) count FROM papers').get().count,
  };
  return NextResponse.json({ items, counts, pagination: { page, pageSize, total, pages: Math.max(1, Math.ceil(total / pageSize)) } });
}

export async function DELETE(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const type = TYPES.has(body.type) ? body.type : '';
  const keys = Array.isArray(body.keys) ? body.keys.slice(0, 100) : [];
  if (!type || !keys.length) return NextResponse.json({ error: '缺少删除目标' }, { status: 400 });
  const placeholders = keys.map(() => '?').join(',');
  const remove = db.transaction(() => {
    if (type === 'repos') db.prepare(`DELETE FROM repos WHERE full_name IN (${placeholders})`).run(...keys.map(String));
    else if (type === 'explore') db.prepare(`DELETE FROM explore_repos WHERE full_name IN (${placeholders})`).run(...keys.map(String));
    else if (type === 'papers') db.prepare(`DELETE FROM papers WHERE id IN (${placeholders})`).run(...keys.map(Number));
    else db.prepare(`DELETE FROM news WHERE id IN (${placeholders})`).run(...keys.map(Number));
  });
  remove();
  return NextResponse.json({ ok: true, deleted: keys.length });
}
