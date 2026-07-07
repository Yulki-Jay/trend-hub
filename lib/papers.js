const Parser = require('rss-parser');
const db = require('./db');
const { getSetting } = require('./settings');

function ssHeaders(extra = {}) {
  const key = getSetting('semantic_scholar_key', '') || process.env.SEMANTIC_SCHOLAR_KEY || '';
  const h = { 'User-Agent': 'TrendHub/1.0', ...extra };
  if (key) h['x-api-key'] = key;
  return h;
}

const parser = new Parser({
  timeout: 20000,
  headers: { 'User-Agent': 'TrendHub/1.0 (+https://trendhub.local)' },
});

function clean(s = '') {
  return s.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 带重试的 fetch（应对 arXiv / Semantic Scholar 429 限流）
async function fetchWithRetry(url, opts = {}, retries = 4) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, opts);
      if (res.status !== 429 && res.status !== 503) return res;
    } catch (e) {
      if (i === retries) throw e;
    }
    if (i < retries) await sleep(4000 * (i + 1)); // 退避 4s/8s/12s/16s
  }
  return fetch(url, opts);
}

// 解析 arXiv Atom XML 为论文对象数组
function parseArxivXml(xml) {
  const entries = xml.split('<entry>').slice(1).map((chunk) => chunk.split('</entry>')[0]);
  const pick = (s, tag) => {
    const m = s.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
    return m ? m[1].replace(/\s+/g, ' ').trim() : '';
  };
  const decode = (s) =>
    s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  return entries.map((e) => {
    const title = decode(clean(pick(e, 'title')));
    const summary = decode(clean(pick(e, 'summary'))).slice(0, 600);
    const idM = e.match(/<id>([^<]+)<\/id>/);
    const absUrl = idM ? idM[1] : '';
    const linkM = e.match(/<link[^>]*rel="alternate"[^>]*href="([^"]+)"/);
    const url = linkM ? linkM[1] : absUrl;
    const arxivM = absUrl.match(/arxiv\.org\/abs\/([0-9]+\.[0-9]+)/) || url.match(/arxiv\.org\/abs\/([0-9]+\.[0-9]+)/);
    const arxivId = arxivM ? arxivM[1] : '';
    const catM = e.match(/<arxiv:primary_category[^>]*term="([^"]+)"/) || e.match(/<category[^>]*term="([^"]+)"/);
    const category = catM ? catM[1] : 'cs';
    const authors = (e.match(/<name>([^<]+)<\/name>/g) || [])
      .map((a) => a.replace(/<\/?name>/g, '')).slice(0, 5).join(', ');
    const published = (e.match(/<published>([^<]+)<\/published>/) || [])[1] || new Date().toISOString();
    const year = parseInt(String(published).slice(0, 4), 10) || null;
    return { title, url, summary, authors, category, source: 'arXiv', stars: 0, arxivId, year, published_at: published };
  }).filter((p) => p.title && p.url);
}

// arXiv 官方 Atom API（最新提交）
async function fetchArxiv(categories) {
  const cats = categories.map((c) => `cat:${c}`).join('+OR+');
  const url =
    `http://export.arxiv.org/api/query?search_query=${cats}` +
    `&sortBy=submittedDate&sortOrder=descending&start=0&max_results=40`;

  const res = await fetchWithRetry(url, {
    headers: { 'User-Agent': 'TrendHub/1.0 (mailto:admin@trendhub.local)' },
  });
  if (!res.ok) throw new Error('arXiv HTTP ' + res.status);
  const xml = await res.text();
  return parseArxivXml(xml);
}

// Semantic Scholar 批量查引用数（免费，无需 key；有限速，做好容错）
// withAbstract=true 时额外拉取摘要/作者（用于高引用种子论文）
async function enrichCitations(papers, withAbstract = false) {
  const ids = papers.filter((p) => p.arxivId).map((p) => 'ARXIV:' + p.arxivId);
  if (!ids.length) return;
  const fields = withAbstract
    ? 'citationCount,influentialCitationCount,venue,year,abstract,authors,title'
    : 'citationCount,influentialCitationCount,venue,year';
  const map = {};
  // 每批最多 100 个
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    try {
      const res = await fetchWithRetry(
        `https://api.semanticscholar.org/graph/v1/paper/batch?fields=${fields}`,
        {
          method: 'POST',
          headers: ssHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify({ ids: batch }),
        }
      );
      if (!res.ok) continue;
      const data = await res.json();
      data.forEach((item, idx) => {
        if (!item) return;
        map[batch[idx]] = item;
      });
    } catch {
      /* 忽略单批失败 */
    }
    if (i + 100 < ids.length) await sleep(2000); // 批次间节流
  }
  for (const p of papers) {
    const info = p.arxivId && map['ARXIV:' + p.arxivId];
    if (info) {
      p.citations = info.citationCount || 0;
      p.influential_citations = info.influentialCitationCount || 0;
      p.venue = info.venue || p.venue || '';
      p.year = info.year || p.year || null;
      if (withAbstract) {
        if (info.abstract) p.summary = clean(info.abstract).slice(0, 600);
        if (info.title) p.title = clean(info.title);
        if (Array.isArray(info.authors) && info.authors.length) {
          p.authors = info.authors.slice(0, 5).map((a) => a.name).join(', ');
        }
        if (info.year) p.published_at = `${info.year}-01-01`;
      }
    }
  }
}

// Papers with Code 热门论文（带代码、按 GitHub 星标排序）
async function fetchPapersWithCode() {
  try {
    const res = await fetchWithRetry(
      'https://paperswithcode.com/api/v1/papers/?ordering=-github_stars&items_per_page=20',
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; TrendHub/1.0)', Accept: 'application/json' } }
    );
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('json')) return []; // 返回 HTML 说明接口不可用
    const data = await res.json();
    const minYear = new Date().getFullYear() - 2;
    return (data.results || []).map((p) => ({
      title: clean(p.title || ''),
      url: p.url_abs || p.url_pdf || `https://paperswithcode.com${p.id || ''}`,
      summary: clean(p.abstract || '').slice(0, 600),
      authors: Array.isArray(p.authors) ? p.authors.slice(0, 5).join(', ') : '',
      category: 'Code',
      source: 'PapersWithCode',
      stars: p.github_stars || 0,
      arxivId: p.arxiv_id || '',
      year: parseInt(String(p.published || '').slice(0, 4), 10) || null,
      published_at: p.published || new Date().toISOString(),
    })).filter((p) => p.title && p.url && (!p.year || p.year >= minYear));
  } catch {
    return [];
  }
}

// 各领域近两年高被引/里程碑论文种子（arXiv ID），用稳定的 batch 端点补实时引用数
// 仅保留 2024 年及以后的重要工作
const SEED_PAPERS = {
  'cs.CL': [
    ['2407.21783', 'The Llama 3 Herd of Models'],
    ['2412.19437', 'DeepSeek-V3 Technical Report'],
    ['2501.12948', 'DeepSeek-R1: Incentivizing Reasoning via RL'],
    ['2403.05530', 'Gemini 1.5'],
    ['2404.14219', 'Phi-3 Technical Report'],
    ['2412.15115', 'Qwen2.5 Technical Report'],
    ['2408.03314', 'Scaling LLM Test-Time Compute'],
  ],
  'cs.CV': [
    ['2401.14159', 'Depth Anything'],
    ['2408.00714', 'SAM 2: Segment Anything in Images and Videos'],
    ['2403.03206', 'Scaling Rectified Flow Transformers (SD3)'],
    ['2410.13848', 'Movie Gen'],
    ['2404.02905', 'Visual Autoregressive Modeling (VAR)'],
  ],
  'cs.LG': [
    ['2405.04434', 'DeepSeek-V2'],
    ['2312.00752', 'Mamba: Linear-Time Sequence Modeling'],
    ['2401.04088', 'Mixtral of Experts'],
    ['2404.19756', 'KAN: Kolmogorov-Arnold Networks'],
    ['2402.03300', 'DeepSeekMath: GRPO'],
  ],
  'cs.AI': [
    ['2402.17764', 'The Era of 1-bit LLMs (BitNet)'],
    ['2408.06195', 'rStar: Mutual Reasoning'],
    ['2501.19393', 's1: Simple Test-Time Scaling'],
  ],
  'cs.RO': [
    ['2405.12213', 'Octo: An Open-Source Generalist Robot Policy'],
    ['2410.24164', 'π0: A Vision-Language-Action Flow Model'],
  ],
  'cs.IR': [
    ['2402.03216', 'BGE M3-Embedding'],
  ],
};

// 高引用榜：近两年重要论文种子 + Semantic Scholar 实时引用数
async function fetchHighCited(categories) {
  const cats = categories.length ? categories : ['cs.LG', 'cs.CL', 'cs.CV', 'cs.AI'];
  const seeds = [];
  for (const c of cats) {
    for (const [id, title] of SEED_PAPERS[c] || []) {
      seeds.push({
        title,
        url: `https://arxiv.org/abs/${id}`,
        summary: '',
        authors: '',
        category: 'Top',
        source: 'HighCited',
        stars: 0,
        arxivId: id,
        citations: 0,
        influential_citations: 0,
        venue: '',
        year: null,
        published_at: `20${id.slice(0, 2)}-01-01`,
      });
    }
  }
  if (!seeds.length) return [];

  // 补引用数 + 摘要/venue/year（batch 端点稳定）
  await enrichCitations(seeds, true);
  const minYear = new Date().getFullYear() - 2;
  return seeds
    .filter((p) => p.citations > 0 && (!p.year || p.year >= minYear))
    .sort((a, b) => b.citations - a.citations);
}

// Semantic Scholar 搜索：近两年各领域高被引论文（动态补充，不止种子）
async function fetchRecentTopCited(categories) {
  const catQuery = {
    'cs.AI': 'artificial intelligence agents',
    'cs.CL': 'large language models',
    'cs.CV': 'computer vision diffusion',
    'cs.LG': 'deep learning',
    'cs.RO': 'robot learning',
    'cs.IR': 'retrieval augmented generation',
    'cs.NE': 'neural networks',
    'cs.CR': 'security',
  };
  const cats = (categories.length ? categories : ['cs.CL', 'cs.CV']).slice(0, 4);
  const yearFrom = new Date().getFullYear() - 2;
  const out = [];

  for (const c of cats) {
    const query = catQuery[c] || 'machine learning';
    const url =
      'https://api.semanticscholar.org/graph/v1/paper/search?' +
      new URLSearchParams({
        query,
        year: `${yearFrom}-`,
        fields: 'title,abstract,authors,year,venue,citationCount,influentialCitationCount,externalIds,publicationDate',
        sort: 'citationCount:desc',
        limit: '10',
      });
    try {
      const res = await fetchWithRetry(url, { headers: ssHeaders() });
      if (!res.ok) continue;
      const data = await res.json();
      for (const p of data.data || []) {
        if (!p || !p.title || !(p.citationCount > 0)) continue;
        const arxivId = p.externalIds?.ArXiv || '';
        const link = arxivId
          ? `https://arxiv.org/abs/${arxivId}`
          : `https://www.semanticscholar.org/paper/${p.paperId}`;
        out.push({
          title: clean(p.title),
          url: link,
          summary: clean(p.abstract || '').slice(0, 600),
          authors: Array.isArray(p.authors) ? p.authors.slice(0, 5).map((a) => a.name).join(', ') : '',
          category: 'Top',
          source: 'SemanticScholar',
          stars: 0,
          arxivId,
          citations: p.citationCount || 0,
          influential_citations: p.influentialCitationCount || 0,
          venue: p.venue || '',
          year: p.year || null,
          published_at: p.publicationDate || (p.year ? `${p.year}-01-01` : new Date().toISOString()),
        });
      }
    } catch {
      /* 单类失败忽略 */
    }
    await sleep(3000); // 类间节流，避免限流
  }
  return out;
}


async function runPaperFetch() {
  if (getSetting('paper_source_enabled', '1') !== '1') return 0;
  const cats = (getSetting('arxiv_categories', 'cs.AI,cs.CL,cs.CV,cs.LG') || '')
    .split(',').map((s) => s.trim()).filter(Boolean);

  const insert = db.prepare(`
    INSERT INTO papers(title,url,summary,authors,category,source,stars,citations,influential_citations,venue,year,published_at)
    VALUES(@title,@url,@summary,@authors,@category,@source,@stars,@citations,@influential_citations,@venue,@year,@published_at)
    ON CONFLICT(url) DO UPDATE SET
      stars=excluded.stars,
      citations=MAX(excluded.citations, papers.citations),
      influential_citations=MAX(excluded.influential_citations, papers.influential_citations),
      venue=COALESCE(NULLIF(excluded.venue,''), papers.venue),
      year=COALESCE(excluded.year, papers.year)
  `);

  const norm = (p) => ({
    citations: 0, influential_citations: 0, venue: '', year: null, ...p,
  });

  let total = 0;
  try {
    const arx = await fetchArxiv(cats.length ? cats : ['cs.AI']);
    await enrichCitations(arx); // 补引用数（新论文通常为0，正常）
    const tx = db.transaction((list) => { for (const p of list) if (p.title && p.url) insert.run(norm(p)); });
    tx(arx);
    total += arx.length;
  } catch (e) {
    db.prepare('INSERT INTO job_logs(job,status,message) VALUES(?,?,?)').run('paper', 'error', 'arXiv: ' + e.message);
  }

  // 高引用榜（近两年高被引：领域种子 + Semantic Scholar 动态搜索）
  try {
    const seedHot = await fetchHighCited(cats.length ? cats : ['cs.LG']);
    if (seedHot.length) {
      const tx = db.transaction((list) => { for (const p of list) insert.run(norm(p)); });
      tx(seedHot);
      total += seedHot.length;
    }
  } catch (e) {
    db.prepare('INSERT INTO job_logs(job,status,message) VALUES(?,?,?)').run('paper', 'error', 'highcited: ' + e.message);
  }

  try {
    const recentHot = await fetchRecentTopCited(cats.length ? cats : ['cs.CL', 'cs.CV']);
    if (recentHot.length) {
      const tx = db.transaction((list) => { for (const p of list) insert.run(norm(p)); });
      tx(recentHot);
      total += recentHot.length;
    }
  } catch (e) {
    db.prepare('INSERT INTO job_logs(job,status,message) VALUES(?,?,?)').run('paper', 'error', 'recenttop: ' + e.message);
  }

  const pwc = await fetchPapersWithCode();
  if (pwc.length) {
    try { await enrichCitations(pwc); } catch {}
    const tx = db.transaction((list) => { for (const p of list) insert.run(norm(p)); });
    tx(pwc);
    total += pwc.length;
  }

  db.prepare("DELETE FROM papers WHERE created_at < datetime('now','localtime','-30 day')").run();
  return total;
}

module.exports = { runPaperFetch };
