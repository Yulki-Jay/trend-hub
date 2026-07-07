import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { buildSearch, buildRelevance } from '../../../lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const q = searchParams.get('q') || '';
  const range = searchParams.get('range') || '';

  let sql = 'SELECT * FROM news WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category=?'; params.push(category); }

  const search = buildSearch(q, ['title', 'summary']);
  sql += search.clause;
  params.push(...search.params);

  if (range === '24h') sql += " AND published_at >= datetime('now','-1 day')";
  else if (range === '3d') sql += " AND published_at >= datetime('now','-3 day')";
  else if (range === '7d') sql += " AND published_at >= datetime('now','-7 day')";

  const rel = buildRelevance(q, 'title');
  sql += ' ORDER BY ' + rel.expr + 'published_at DESC LIMIT 120';
  params.push(...rel.params);

  const items = db.prepare(sql).all(...params);
  return NextResponse.json({ items });
}
