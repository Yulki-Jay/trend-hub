import db from '../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const stats = {
    repos_today: db.prepare("SELECT COUNT(*) c FROM repos WHERE fetched_date=date('now','localtime') AND range='daily'").get().c,
    devs_today: db.prepare("SELECT COUNT(*) c FROM developers WHERE fetched_date=date('now','localtime') AND range='daily'").get().c,
    news_total: db.prepare('SELECT COUNT(*) c FROM news').get().c,
    news_today: db.prepare("SELECT COUNT(*) c FROM news WHERE date(created_at)=date('now','localtime')").get().c,
    papers_total: db.prepare('SELECT COUNT(*) c FROM papers').get().c,
    papers_today: db.prepare("SELECT COUNT(*) c FROM papers WHERE date(created_at)=date('now','localtime')").get().c,
    sources: db.prepare('SELECT COUNT(*) c FROM sources WHERE enabled=1').get().c,
  };

  // 新闻分类分布
  const newsByCat = db.prepare(
    'SELECT category, COUNT(*) c FROM news GROUP BY category ORDER BY c DESC'
  ).all();

  // 近7天新闻抓取趋势
  const trend = db.prepare(`
    SELECT date(created_at) d, COUNT(*) c FROM news
    WHERE created_at >= datetime('now','localtime','-6 day')
    GROUP BY date(created_at) ORDER BY d
  `).all();

  // GitHub 语言分布（今日）
  const langDist = db.prepare(`
    SELECT language, COUNT(*) c FROM repos
    WHERE fetched_date=date('now','localtime') AND range='daily' AND language!=''
    GROUP BY language ORDER BY c DESC LIMIT 8
  `).all();

  return Response.json({ ...stats, newsByCat, trend, langDist });
}
