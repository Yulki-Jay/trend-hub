import { NextResponse } from 'next/server';
import db from '../../../../lib/db';
import { getCurrentUser } from '../../../../lib/user-auth';

export const dynamic = 'force-dynamic';

const TYPES = new Set(['repo', 'developer', 'news', 'paper']);
const FIELDS = {
  repo: ['full_name', 'url', 'author', 'name', 'description', 'language', 'stars', 'forks', 'today_stars', 'growth_7d', 'topics', 'reason', 'pushed_at'],
  developer: ['login', 'name', 'url', 'avatar', 'repo_name', 'repo_url', 'repo_desc', 'rank'],
  news: ['title', 'url', 'summary', 'category', 'source', 'image', 'published_at'],
  paper: ['title', 'url', 'summary', 'authors', 'category', 'source', 'stars', 'citations', 'influential_citations', 'venue', 'year', 'published_at'],
};

function cleanItem(type, item) {
  const out = {};
  for (const field of FIELDS[type]) {
    const value = item?.[field];
    if (value !== undefined && value !== null) out[field] = value;
  }
  return out;
}

function parseData(value) {
  try { return JSON.parse(value); } catch { return null; }
}

export async function GET(req) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const type = new URL(req.url).searchParams.get('type') || 'repo';
  if (!TYPES.has(type)) return NextResponse.json({ error: 'invalid type' }, { status: 400 });

  const favorites = {};
  for (const row of db.prepare(`
    SELECT item_key,item_data FROM user_favorites
    WHERE user_id=? AND item_type=? ORDER BY id DESC
  `).all(user.id, type)) {
    const item = parseData(row.item_data);
    if (item) favorites[row.item_key] = item;
  }
  const dismissed = db.prepare(`
    SELECT item_key FROM user_dismissals WHERE user_id=? AND item_type=? ORDER BY id DESC
  `).all(user.id, type).map((row) => row.item_key);

  return NextResponse.json({ favorites, dismissed });
}

export async function POST(req) {
  const user = getCurrentUser();
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  const type = String(body.type || '');
  const key = String(body.key || '').trim();
  const action = String(body.action || '');
  if (!TYPES.has(type) || !key || key.length > 500) {
    return NextResponse.json({ error: 'invalid item' }, { status: 400 });
  }

  if (action === 'favorite') {
    const data = JSON.stringify(cleanItem(type, body.item));
    if (data.length > 50000) return NextResponse.json({ error: 'item too large' }, { status: 400 });
    db.prepare(`
      INSERT INTO user_favorites(user_id,item_type,item_key,item_data) VALUES(?,?,?,?)
      ON CONFLICT(user_id,item_type,item_key) DO UPDATE SET item_data=excluded.item_data
    `).run(user.id, type, key, data);
    db.prepare('DELETE FROM user_dismissals WHERE user_id=? AND item_type=? AND item_key=?')
      .run(user.id, type, key);
  } else if (action === 'unfavorite') {
    db.prepare('DELETE FROM user_favorites WHERE user_id=? AND item_type=? AND item_key=?')
      .run(user.id, type, key);
  } else if (action === 'dismiss') {
    db.prepare(`
      INSERT INTO user_dismissals(user_id,item_type,item_key) VALUES(?,?,?)
      ON CONFLICT(user_id,item_type,item_key) DO NOTHING
    `).run(user.id, type, key);
    db.prepare('DELETE FROM user_favorites WHERE user_id=? AND item_type=? AND item_key=?')
      .run(user.id, type, key);
  } else {
    return NextResponse.json({ error: 'invalid action' }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
