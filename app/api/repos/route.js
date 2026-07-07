import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { buildSearch, buildRelevance } from '../../../lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || 'daily';
  const language = searchParams.get('language') || '';
  const q = searchParams.get('q') || '';

  const latestDate = db
    .prepare('SELECT MAX(fetched_date) d FROM repos WHERE range=?')
    .get(range)?.d;

  if (!latestDate) return NextResponse.json({ items: [], date: null });

  let sql = 'SELECT * FROM repos WHERE range=? AND fetched_date=?';
  const params = [range, latestDate];
  if (language) { sql += ' AND language=?'; params.push(language); }

  const search = buildSearch(q, ['full_name', 'description']);
  sql += search.clause;
  params.push(...search.params);

  // 有搜索时按标题命中相关度优先，否则按热榜排名
  const rel = buildRelevance(q, 'full_name');
  sql += ' ORDER BY ' + rel.expr + 'rank ASC LIMIT 60';
  params.push(...rel.params);

  const items = db.prepare(sql).all(...params);
  const languages = db
    .prepare("SELECT DISTINCT language FROM repos WHERE range=? AND fetched_date=? AND language!='' ORDER BY language")
    .all(range, latestDate)
    .map((r) => r.language);

  return NextResponse.json({ items, date: latestDate, languages });
}
