const Parser = require('rss-parser');
const db = require('./db');
const { fetchPublicText, sanitizePublicHttpUrl } = require('./security');

const parser = new Parser();
const REQUEST_HEADERS = { 'User-Agent': 'TrendHub/1.0 (+https://trendhub.local)' };

function stripHtml(s = '') {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

// 过滤 RSS 源塞进摘要的无效占位文本（如"点击查看原文"），返回干净摘要或空串
function cleanSummary(raw = '') {
  let s = stripHtml(raw);
  // 去掉常见的"阅读全文/查看原文/点击..."等尾部占位
  s = s.replace(/[\s>》\]】]*(点击)?(查看|阅读|read)?\s*(全文|原文|more|详情|continue reading)[\s>》\]】.…]*$/gi, '').trim();
  s = s.replace(/(点击|请)?(查看|阅读)?原文\s*[>》]*$/g, '').trim();
  // 摘要太短（多为纯占位）视为无效
  if (s.length < 8) return '';
  return s.slice(0, 500);
}

function pickImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;
  const media = item['media:content']?.$?.url || item['media:thumbnail']?.$?.url;
  if (media) return media;
  const m = (item['content:encoded'] || item.content || '').match(/<img[^>]+src=["']([^"']+)["']/);
  return m ? m[1] : null;
}

async function fetchSource(source) {
  const xml = await fetchPublicText(source.url, { headers: REQUEST_HEADERS });
  const feed = await parser.parseString(xml);
  return (feed.items || []).slice(0, 30).map((it) => {
    // 依次尝试多个字段，取第一个清洗后非空的摘要
    const candidates = [
      it.contentSnippet,
      it['content:encodedSnippet'],
      it.summary,
      it['content:encoded'],
      it.content,
      it.description,
    ];
    let summary = '';
    for (const c of candidates) {
      const cleaned = cleanSummary(c || '');
      if (cleaned) { summary = cleaned; break; }
    }
    const safeUrl = sanitizePublicHttpUrl(it.link, source.url);
    const safeImage = sanitizePublicHttpUrl(pickImage(it), source.url);
    return {
      title: (it.title || '').trim(),
      url: safeUrl,
      summary,
      category: source.category,
      source: source.name,
      image: safeImage,
      published_at: it.isoDate || it.pubDate || new Date().toISOString(),
    };
  });
}

async function runNewsFetch() {
  const sources = db.prepare('SELECT * FROM sources WHERE enabled=1').all();
  const insert = db.prepare(`
    INSERT INTO news(title,url,summary,category,source,image,published_at)
    VALUES(@title,@url,@summary,@category,@source,@image,@published_at)
    ON CONFLICT(url) DO NOTHING
  `);
  let total = 0;
  for (const s of sources) {
    try {
      const items = await fetchSource(s);
      const tx = db.transaction((list) => {
        for (const it of list) if (it.title && it.url) insert.run(it);
      });
      tx(items);
      total += items.length;
    } catch (e) {
      db.prepare('INSERT INTO job_logs(job,status,message) VALUES(?,?,?)').run(
        'news', 'error', `${s.name}: ${e.message}`
      );
    }
  }
  // 清理超过14天的旧新闻
  db.prepare("DELETE FROM news WHERE created_at < datetime('now','localtime','-14 day')").run();
  return total;
}

module.exports = { runNewsFetch };
