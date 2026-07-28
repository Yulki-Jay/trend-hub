import { NextResponse } from 'next/server';
import db from '../../../lib/db';
import { buildSearch } from '../../../lib/search';
import { getSetting } from '../../../lib/settings';

export const dynamic = 'force-dynamic';

function hashUnit(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) + 1) / 4294967297;
}

function parseTopics(value) {
  try {
    const topics = JSON.parse(value || '[]');
    return Array.isArray(topics) ? topics : [];
  } catch {
    return [];
  }
}

function weightedDiverseSample(items, limit, seed, fixed = {}) {
  const ranked = items.map((item) => {
    const random = hashUnit(`${seed}:${item.full_name}`);
    const weight = Math.max(1, Number(item.score) || 1);
    return { ...item, randomKey: -Math.log(random) / weight };
  }).sort((a, b) => a.randomKey - b.randomKey);

  const selected = [];
  const selectedNames = new Set();
  const authors = new Map();
  const languages = new Map();
  const categories = new Map();

  const take = (item, caps) => {
    if (selectedNames.has(item.full_name)) return false;
    const author = item.author || '';
    const language = item.language || '';
    const category = item.category || 'other';
    if (author && (authors.get(author) || 0) >= caps.author) return false;
    if (language && (languages.get(language) || 0) >= caps.language) return false;
    if ((categories.get(category) || 0) >= caps.category) return false;
    selected.push(item);
    selectedNames.add(item.full_name);
    if (author) authors.set(author, (authors.get(author) || 0) + 1);
    if (language) languages.set(language, (languages.get(language) || 0) + 1);
    categories.set(category, (categories.get(category) || 0) + 1);
    return true;
  };

  for (const item of ranked) {
    take(item, {
      author: 1,
      language: fixed.language ? limit : Math.max(2, Math.ceil(limit / 3)),
      category: fixed.category ? limit : Math.max(3, Math.ceil(limit / 2)),
    });
    if (selected.length >= limit) break;
  }
  if (selected.length < limit) {
    for (const item of ranked) {
      take(item, {
        author: 2,
        language: fixed.language ? limit : Math.max(4, Math.ceil(limit / 2)),
        category: limit,
      });
      if (selected.length >= limit) break;
    }
  }
  return selected.map(({ randomKey, ...item }) => item);
}

export async function GET(req) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category') || '';
  const language = searchParams.get('language') || '';
  const q = searchParams.get('q') || '';
  const seed = searchParams.get('seed') || '0';
  const limit = Math.min(60, Math.max(6, Number(getSetting('explore_batch_size', '18')) || 18));
  const excluded = (searchParams.get('exclude') || '')
    .split(',').map((s) => s.trim().toLowerCase()).filter(Boolean).slice(0, 150);

  const latestDate = db.prepare('SELECT MAX(fetched_date) d FROM explore_repos').get()?.d;
  if (!latestDate) {
    return NextResponse.json({ items: [], date: null, languages: [], categories: [] });
  }

  let sql = 'SELECT * FROM explore_repos WHERE fetched_date=?';
  const params = [latestDate];
  if (category) { sql += ' AND category=?'; params.push(category); }
  if (language) { sql += ' AND language=?'; params.push(language); }
  if (excluded.length) {
    sql += ` AND lower(full_name) NOT IN (${excluded.map(() => '?').join(',')})`;
    params.push(...excluded);
  }
  const search = buildSearch(q, ['full_name', 'description', 'topics']);
  sql += search.clause;
  params.push(...search.params);
  sql += ' ORDER BY score DESC LIMIT 240';

  const candidates = db.prepare(sql).all(...params).map((item) => ({
    ...item,
    topics: parseTopics(item.topics),
  }));
  const items = weightedDiverseSample(
    candidates,
    limit,
    `${latestDate}:${seed}:${category}:${language}:${q}`,
    { language: !!language, category: !!category }
  );

  const languages = db.prepare(`
    SELECT language, COUNT(*) count FROM explore_repos
    WHERE fetched_date=? AND language!=''
    GROUP BY language ORDER BY count DESC, language LIMIT 30
  `).all(latestDate).map((row) => row.language);
  const categories = db.prepare(`
    SELECT category, COUNT(*) count FROM explore_repos
    WHERE fetched_date=? GROUP BY category ORDER BY count DESC
  `).all(latestDate);

  return NextResponse.json({ items, date: latestDate, languages, categories, remaining: candidates.length });
}
