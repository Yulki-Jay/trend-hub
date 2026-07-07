const cheerio = require('cheerio');
const db = require('./db');

function parseNum(txt) {
  if (!txt) return 0;
  const n = txt.replace(/,/g, '').trim();
  return parseInt(n, 10) || 0;
}

async function fetchTrending(range = 'daily', language = '') {
  const url =
    'https://github.com/trending' +
    (language ? '/' + encodeURIComponent(language) : '') +
    '?since=' + range;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error('GitHub trending HTTP ' + res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];

  $('article.Box-row').each((i, el) => {
    const $el = $(el);
    const repoPath = $el.find('h2 a').attr('href') || '';
    const fullName = repoPath.replace(/^\//, '').trim();
    if (!fullName) return;
    const [author, name] = fullName.split('/');
    const description = $el.find('p').text().trim();
    const lang = $el.find('[itemprop="programmingLanguage"]').text().trim();
    const statAnchors = $el.find('a.Link--muted');
    const stars = parseNum($(statAnchors[0]).text());
    const forks = parseNum($(statAnchors[1]).text());
    const todayText = $el.find('.d-inline-block.float-sm-right').text();
    const todayStars = parseNum((todayText.match(/([\d,]+)/) || [])[1]);

    items.push({
      full_name: fullName,
      url: 'https://github.com/' + fullName,
      author,
      name,
      description,
      language: lang,
      stars,
      forks,
      today_stars: todayStars,
      range,
      rank: i + 1,
    });
  });
  return items;
}

async function runRepoFetch(ranges = ['daily'], languages = ['']) {
  // 使用本地(北京)日期，与统计查询 date('now','localtime') 保持一致
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const insert = db.prepare(`
    INSERT INTO repos(full_name,url,author,name,description,language,stars,forks,today_stars,range,rank,fetched_date)
    VALUES(@full_name,@url,@author,@name,@description,@language,@stars,@forks,@today_stars,@range,@rank,@fetched_date)
    ON CONFLICT(full_name,range,fetched_date) DO UPDATE SET
      stars=excluded.stars, forks=excluded.forks, today_stars=excluded.today_stars, rank=excluded.rank
  `);
  let total = 0;
  for (const range of ranges) {
    for (const lang of languages) {
      const items = await fetchTrending(range, lang);
      const tx = db.transaction((list) => {
        for (const it of list) insert.run({ ...it, fetched_date: today });
      });
      tx(items);
      total += items.length;
    }
  }
  return total;
}

// 抓取 GitHub Trending Developers 开发者榜
async function fetchDevelopers(range = 'daily', language = '') {
  const url =
    'https://github.com/trending/developers' +
    (language ? '/' + encodeURIComponent(language) : '') +
    '?since=' + range;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122 Safari/537.36',
      Accept: 'text/html',
    },
  });
  if (!res.ok) throw new Error('GitHub developers HTTP ' + res.status);
  const html = await res.text();
  const $ = cheerio.load(html);
  const items = [];

  $('article.Box-row').each((i, el) => {
    const $el = $(el);
    const name = $el.find('h1.h3 a').text().trim();
    const login = ($el.find('a.Link--secondary').first().text().trim()) ||
      ($el.find('h1.h3 a').attr('href') || '').replace(/^\//, '').trim();
    if (!login) return;
    const avatar = $el.find('img').attr('src') || '';
    const repoAnchor = $el.find('h1.h4 a');
    const repoName = repoAnchor.text().trim();
    const repoPath = repoAnchor.attr('href') || '';
    const repoDesc = $el.find('.f6.color-fg-muted.mt-1').text().trim();

    items.push({
      login,
      name: name || login,
      url: 'https://github.com/' + login,
      avatar,
      repo_name: repoName,
      repo_url: repoPath ? 'https://github.com' + repoPath : '',
      repo_desc: repoDesc,
      range,
      rank: i + 1,
    });
  });
  return items;
}

async function runDeveloperFetch(ranges = ['daily'], languages = ['']) {
  const today = new Date().toLocaleDateString('en-CA');
  const insert = db.prepare(`
    INSERT INTO developers(login,name,url,avatar,repo_name,repo_url,repo_desc,range,rank,fetched_date)
    VALUES(@login,@name,@url,@avatar,@repo_name,@repo_url,@repo_desc,@range,@rank,@fetched_date)
    ON CONFLICT(login,range,fetched_date) DO UPDATE SET
      name=excluded.name, avatar=excluded.avatar, repo_name=excluded.repo_name,
      repo_url=excluded.repo_url, repo_desc=excluded.repo_desc, rank=excluded.rank
  `);
  let total = 0;
  for (const range of ranges) {
    for (const lang of languages) {
      const items = await fetchDevelopers(range, lang);
      const tx = db.transaction((list) => {
        for (const it of list) insert.run({ ...it, fetched_date: today });
      });
      tx(items);
      total += items.length;
    }
  }
  return total;
}

module.exports = { fetchTrending, runRepoFetch, fetchDevelopers, runDeveloperFetch };
