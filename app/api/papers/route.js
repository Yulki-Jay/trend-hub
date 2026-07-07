import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { buildSearch, buildRelevance } from '../../../lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const source = searchParams.get('source') || '';
  const q = searchParams.get('q') || '';
  const sort = searchParams.get('sort') || 'time';

  let sql = 'SELECT * FROM papers WHERE 1=1';
  const params = [];
  if (category) { sql += ' AND category=?'; params.push(category); }
  if (source) { sql += ' AND source=?'; params.push(source); }

  const search = buildSearch(q, ['title', 'summary', 'authors']);
  sql += search.clause;
  params.push(...search.params);

  const rel = buildRelevance(q, 'title');
  let baseOrder;
  if (sort === 'citations') baseOrder = 'citations DESC, influential_citations DESC, published_at DESC';
  else if (sort === 'influential') baseOrder = 'influential_citations DESC, citations DESC, published_at DESC';
  else if (sort === 'stars') baseOrder = 'stars DESC, published_at DESC';
  else baseOrder = 'published_at DESC';
  sql += ' ORDER BY ' + rel.expr + baseOrder + ' LIMIT 80';
  params.push(...rel.params);

  const items = db.prepare(sql).all(...params);
  const categories = db
    .prepare("SELECT DISTINCT category FROM papers WHERE category!='' ORDER BY category")
    .all().map((r) => r.category);
  return NextResponse.json({ items, categories });
}
