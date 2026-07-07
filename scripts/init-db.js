const db = require('../lib/db');

const defaults = {
  admin_password: process.env.ADMIN_PASSWORD || 'admin123',
  smtp_host: process.env.SMTP_HOST || '',
  smtp_port: process.env.SMTP_PORT || '465',
  smtp_secure: process.env.SMTP_SECURE || '1',
  smtp_user: process.env.SMTP_USER || '',
  smtp_pass: process.env.SMTP_PASS || '',
  smtp_from: process.env.SMTP_FROM || '',
  cron_fetch: '0 */2 * * *',      // 每2小时抓取
  cron_email: '0 8 * * *',        // 每日08:00推送
  github_languages: '',           // 空=全部
  email_enabled: '0',
  top_repos: '10',
  top_news: '15',
  top_papers: '8',
  arxiv_categories: 'cs.AI,cs.CL,cs.CV,cs.LG',  // arXiv 计算机分类
  paper_source_enabled: '1',
  semantic_scholar_key: '',  // 可选，填入可提升引用数抓取限速
};

const insertSetting = db.prepare(
  'INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO NOTHING'
);
for (const [k, v] of Object.entries(defaults)) insertSetting.run(k, String(v));

const seedSources = [
  // 科技（中文）
  ['36氪', 'rss', 'https://www.36kr.com/feed', 'tech'],
  ['少数派', 'rss', 'https://sspai.com/feed', 'tech'],
  ['虎嗅网', 'rss', 'https://www.huxiu.com/rss/0.xml', 'tech'],
  ['爱范儿', 'rss', 'https://www.ifanr.com/feed', 'tech'],
  ['机器之心', 'rss', 'https://www.jiqizhixin.com/rss', 'tech'],
  ['开源中国', 'rss', 'https://www.oschina.net/news/rss', 'tech'],
  ['cnBeta', 'rss', 'https://www.cnbeta.com.tw/backend.php', 'tech'],
  ['IT之家', 'rss', 'https://www.ithome.com/rss/', 'tech'],
  ['品玩', 'rss', 'https://www.pingwest.com/feed/all', 'tech'],
  ['TechCrunch', 'rss', 'https://techcrunch.com/feed/', 'tech'],
  ['The Verge', 'rss', 'https://www.theverge.com/rss/index.xml', 'tech'],
  ['Ars Technica', 'rss', 'https://feeds.arstechnica.com/arstechnica/index', 'tech'],
  ['Wired', 'rss', 'https://www.wired.com/feed/rss', 'tech'],
  ['MIT Tech Review', 'rss', 'https://www.technologyreview.com/feed/', 'tech'],
  // 经济财经（中文 + 国际）
  ['华尔街见闻', 'rss', 'https://dedicated.wallstreetcn.com/rss.xml', 'economy'],
  ['第一财经', 'rss', 'https://www.yicai.com/feed/', 'economy'],
  ['财新网', 'rss', 'https://feed.caixin.com/rss/economics.xml', 'economy'],
  ['FT中文网', 'rss', 'https://www.ftchinese.com/rss/feed', 'economy'],
  ['CNBC', 'rss', 'https://www.cnbc.com/id/100003114/device/rss/rss.html', 'economy'],
  ['The Economist', 'rss', 'https://www.economist.com/finance-and-economics/rss.xml', 'economy'],
  ['MarketWatch', 'rss', 'https://feeds.content.dowjones.io/public/rss/mw_topstories', 'economy'],
  // 政治时政（中文 + 国际）
  ['联合早报', 'rss', 'https://plink.anyfeeder.com/zaobao/realtime/china', 'politics'],
  ['BBC 中文', 'rss', 'https://feeds.bbci.co.uk/zhongwen/simp/rss.xml', 'politics'],
  ['纽约时报中文网', 'rss', 'https://cn.nytimes.com/rss/', 'politics'],
  ['德国之声中文', 'rss', 'https://rss.dw.com/rdf/rss-chi-all', 'politics'],
  ['BBC World', 'rss', 'https://feeds.bbci.co.uk/news/world/rss.xml', 'politics'],
  ['NYT World', 'rss', 'https://rss.nytimes.com/services/xml/rss/nyt/World.xml', 'politics'],
  ['France24', 'rss', 'https://www.france24.com/en/rss', 'politics'],
  ['The Guardian World', 'rss', 'https://www.theguardian.com/world/rss', 'politics'],
  ['Al Jazeera', 'rss', 'https://www.aljazeera.com/xml/rss/all.xml', 'politics'],
  ['NHK World', 'rss', 'https://www3.nhk.or.jp/nhkworld/en/news/all.xml', 'politics'],
];
const hasSource = db.prepare('SELECT COUNT(*) c FROM sources').get().c;
if (!hasSource) {
  const ins = db.prepare('INSERT INTO sources(name,type,url,category) VALUES(?,?,?,?)');
  for (const s of seedSources) ins.run(...s);
} else {
  // 已有库：补充缺失的种子源（按 url 去重）
  const insMissing = db.prepare(
    'INSERT INTO sources(name,type,url,category) SELECT ?,?,?,? WHERE NOT EXISTS(SELECT 1 FROM sources WHERE url=?)'
  );
  let added = 0;
  for (const [name, type, url, cat] of seedSources) {
    const r = insMissing.run(name, type, url, cat, url);
    added += r.changes;
  }
  if (added) console.log('补充新增数据源:', added);
}

console.log('DB initialized. Sources:', db.prepare('SELECT COUNT(*) c FROM sources').get().c);
