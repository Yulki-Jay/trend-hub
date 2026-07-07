import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { buildSearch } from '../../../lib/search';

export const dynamic = 'force-dynamic';

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const range = searchParams.get('range') || 'daily';
  const q = searchParams.get('q') || '';

  const latestDate = db
    .prepare('SELECT MAX(fetched_date) d FROM developers WHERE range=?')
    .get(range)?.d;

  if (!latestDate) return NextResponse.json({ items: [], date: null });

  let sql = 'SELECT * FROM developers WHERE range=? AND fetched_date=?';
  const params = [range, latestDate];

  const search = buildSearch(q, ['login', 'name', 'repo_name']);
  sql += search.clause;
  params.push(...search.params);

  sql += ' ORDER BY rank ASC LIMIT 60';

  const items = db.prepare(sql).all(...params);
  return NextResponse.json({ items, date: latestDate });
}
