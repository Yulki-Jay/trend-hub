const db = require('./db');

const SEARCH_QUERIES = [
  { kind: 'new', build: () => `created:>=${daysAgo(120)} stars:20..5000 archived:false fork:false`, sort: 'stars' },
  { kind: 'active', build: () => `pushed:>=${daysAgo(14)} stars:30..3000 archived:false fork:false`, sort: 'updated' },
  { kind: 'ai', build: () => `topic:artificial-intelligence created:>=${daysAgo(365)} stars:20..8000 archived:false fork:false`, sort: 'updated' },
  { kind: 'devtools', build: () => `topic:developer-tools pushed:>=${daysAgo(60)} stars:20..8000 archived:false fork:false`, sort: 'updated' },
  { kind: 'productivity', build: () => `topic:productivity pushed:>=${daysAgo(90)} stars:20..5000 archived:false fork:false`, sort: 'updated' },
];

function localDate() {
  return new Date().toLocaleDateString('en-CA');
}

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

function ageInDays(value) {
  const time = Date.parse(value || '');
  if (!Number.isFinite(time)) return 9999;
  return Math.max(0, (Date.now() - time) / 86400000);
}

function stableNoise(value) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295;
}

function classifyRepo(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  const text = [repo.name, repo.description, repo.language, ...topics].join(' ').toLowerCase();
  const has = (words) => words.some((word) => text.includes(word));

  if (has(['artificial-intelligence', 'machine-learning', 'deep-learning', 'llm', 'generative-ai', 'computer-vision', 'natural-language'])) return 'ai';
  if (has(['security', 'cybersecurity', 'pentest', 'vulnerability', 'cryptography', 'malware'])) return 'security';
  if (has(['developer-tools', 'devtools', 'cli', 'terminal', 'productivity', 'automation', 'debugger', 'compiler'])) return 'devtools';
  if (has(['frontend', 'react', 'vue', 'svelte', 'css', 'web-components', 'design-system'])) return 'frontend';
  if (has(['backend', 'api', 'server', 'database', 'microservice', 'framework', 'web-framework'])) return 'backend';
  if (has(['data-science', 'data-engineering', 'analytics', 'visualization', 'etl', 'database'])) return 'data';
  if (has(['android', 'ios', 'mobile', 'flutter', 'react-native', 'swiftui'])) return 'mobile';
  return 'other';
}

function isBlockedRepo(repo) {
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  const text = [repo.full_name, repo.description, ...topics].join(' ').toLowerCase();
  const blockedTerms = [
    'wallet-drainer', 'seed phrase stealer', 'credential stealer',
    'arbitrage-bot', 'arbitrage bot', 'mev-bot', 'mev bot', 'airdrop-bot',
    'free-streaming', 'movie-resources', 'magnet-search', 'tvbox-config',
    'free netflix', 'license bypass', 'software crack',
  ];
  return blockedTerms.some((term) => text.includes(term));
}

function scoreRepo(repo, growth7d, today) {
  const createdDays = ageInDays(repo.created_at);
  const pushedDays = ageInDays(repo.pushed_at);
  const starVelocity = repo.stargazers_count / Math.max(createdDays, 7);
  const topics = Array.isArray(repo.topics) ? repo.topics : [];
  const category = classifyRepo(repo);

  let score = Math.log1p(repo.stargazers_count) * 4;
  score += Math.log1p(Math.max(0, growth7d)) * 14;
  score += Math.log1p(starVelocity) * 11;
  score += Math.max(0, 18 - pushedDays * 0.75);
  if (createdDays <= 30) score += 16;
  else if (createdDays <= 90) score += 11;
  else if (createdDays <= 365) score += 5;
  if (repo.description) score += 3;
  if (topics.length) score += Math.min(5, topics.length);
  if (repo.license) score += 3;
  if (repo.open_issues_count > repo.stargazers_count * 0.5) score -= 5;
  score += stableNoise(`${today}:${repo.full_name}`) * 8;

  let reason = '值得探索的新项目';
  if (growth7d >= 20) reason = `最近 7 天新增 ${growth7d} Star`;
  else if (createdDays <= 60) reason = `发布不到 ${Math.max(1, Math.ceil(createdDays))} 天`;
  else if (pushedDays <= 3 && repo.stargazers_count < 1500) reason = '小众但持续活跃';
  else if (category === 'devtools') reason = '实用开发工具';
  else if (category === 'ai') reason = '值得关注的 AI 项目';
  else if (repo.stargazers_count < 500) reason = '尚未被广泛发现';
  else if (pushedDays <= 7) reason = '近期保持活跃更新';

  return { score: Math.round(score * 100) / 100, reason, category };
}

async function searchGitHub(query, sort) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'TrendHub-Explore',
    'X-GitHub-Api-Version': '2022-11-28',
  };
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (token) headers.Authorization = `Bearer ${token}`;

  const url = new URL('https://api.github.com/search/repositories');
  url.searchParams.set('q', query);
  url.searchParams.set('sort', sort);
  url.searchParams.set('order', 'desc');
  url.searchParams.set('per_page', '50');

  const res = await fetch(url, { headers, signal: AbortSignal.timeout(20000) });
  if (!res.ok) {
    const remaining = res.headers.get('x-ratelimit-remaining');
    const hint = res.status === 403 || res.status === 429
      ? `，API 配额剩余 ${remaining ?? '未知'}，建议配置 GITHUB_TOKEN`
      : '';
    throw new Error(`GitHub Search HTTP ${res.status}${hint}`);
  }
  const data = await res.json();
  return Array.isArray(data.items) ? data.items : [];
}

async function runExploreFetch() {
  const today = localDate();
  const candidates = new Map();
  const errors = [];

  for (const source of SEARCH_QUERIES) {
    try {
      const items = await searchGitHub(source.build(), source.sort);
      for (const item of items) {
        if (!item.full_name || !item.description || item.archived || item.fork || item.disabled || isBlockedRepo(item)) continue;
        candidates.set(item.full_name.toLowerCase(), item);
      }
    } catch (e) {
      errors.push(e.message);
    }
  }

  if (!candidates.size) {
    throw new Error(errors[0] || 'GitHub 探索候选池为空');
  }

  const trending = new Set(
    db.prepare("SELECT DISTINCT lower(full_name) full_name FROM repos WHERE fetched_date >= date('now','localtime','-30 day')")
      .all().map((r) => r.full_name)
  );
  const findPrior = db.prepare(`
    SELECT stars FROM repo_snapshots
    WHERE full_name=? AND captured_date < ? AND captured_date >= date(?,'-8 day')
    ORDER BY captured_date ASC LIMIT 1
  `);
  const upsertRepo = db.prepare(`
    INSERT INTO explore_repos(
      full_name,url,author,name,description,language,topics,category,stars,forks,
      open_issues,growth_7d,score,reason,license,repo_created_at,pushed_at,fetched_date
    ) VALUES(
      @full_name,@url,@author,@name,@description,@language,@topics,@category,@stars,@forks,
      @open_issues,@growth_7d,@score,@reason,@license,@repo_created_at,@pushed_at,@fetched_date
    )
    ON CONFLICT(full_name) DO UPDATE SET
      url=excluded.url, author=excluded.author, name=excluded.name,
      description=excluded.description, language=excluded.language, topics=excluded.topics,
      category=excluded.category, stars=excluded.stars, forks=excluded.forks,
      open_issues=excluded.open_issues, growth_7d=excluded.growth_7d,
      score=excluded.score, reason=excluded.reason, license=excluded.license,
      repo_created_at=excluded.repo_created_at, pushed_at=excluded.pushed_at,
      fetched_date=excluded.fetched_date, updated_at=datetime('now','localtime')
  `);
  const upsertSnapshot = db.prepare(`
    INSERT INTO repo_snapshots(full_name,stars,forks,captured_date) VALUES(?,?,?,?)
    ON CONFLICT(full_name,captured_date) DO UPDATE SET
      stars=excluded.stars, forks=excluded.forks
  `);

  const rows = [];
  for (const repo of candidates.values()) {
    if (trending.has(repo.full_name.toLowerCase())) continue;
    const prior = findPrior.get(repo.full_name, today, today);
    const growth7d = prior ? Math.max(0, repo.stargazers_count - prior.stars) : 0;
    const ranked = scoreRepo(repo, growth7d, today);
    rows.push({
      full_name: repo.full_name,
      url: repo.html_url,
      author: repo.owner?.login || '',
      name: repo.name,
      description: repo.description || '',
      language: repo.language || '',
      topics: JSON.stringify(repo.topics || []),
      category: ranked.category,
      stars: repo.stargazers_count || 0,
      forks: repo.forks_count || 0,
      open_issues: repo.open_issues_count || 0,
      growth_7d: growth7d,
      score: ranked.score,
      reason: ranked.reason,
      license: repo.license?.spdx_id || '',
      repo_created_at: repo.created_at || '',
      pushed_at: repo.pushed_at || '',
      fetched_date: today,
    });
  }

  if (!rows.length) throw new Error('探索候选均与最近 GitHub Trending 重合');

  const save = db.transaction((items) => {
    db.prepare('DELETE FROM explore_repos WHERE fetched_date=?').run(today);
    for (const row of items) {
      upsertRepo.run(row);
      upsertSnapshot.run(row.full_name, row.stars, row.forks, today);
    }
    db.prepare("DELETE FROM repo_snapshots WHERE captured_date < date('now','localtime','-45 day')").run();
    db.prepare("DELETE FROM explore_repos WHERE fetched_date < date('now','localtime','-30 day')").run();
  });
  save(rows);

  return rows.length;
}

module.exports = { runExploreFetch, classifyRepo, scoreRepo, isBlockedRepo };
