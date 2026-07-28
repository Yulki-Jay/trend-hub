import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const latestExploreDate = db.prepare('SELECT MAX(fetched_date) date FROM explore_repos').get()?.date;
  const counts = {
    reposToday: db.prepare("SELECT COUNT(*) count FROM repos WHERE fetched_date=date('now','localtime') AND range='daily'").get().count,
    explore: latestExploreDate
      ? db.prepare('SELECT COUNT(*) count FROM explore_repos WHERE fetched_date=?').get(latestExploreDate).count
      : 0,
    news: db.prepare('SELECT COUNT(*) count FROM news').get().count,
    papers: db.prepare('SELECT COUNT(*) count FROM papers').get().count,
    users: db.prepare('SELECT COUNT(*) count FROM users WHERE disabled=0').get().count,
    sources: db.prepare('SELECT COUNT(*) count FROM sources WHERE enabled=1').get().count,
    recipients: db.prepare('SELECT COUNT(*) count FROM recipients WHERE enabled=1').get().count,
  };
  const lastJobs = db.prepare(`
    SELECT l.* FROM job_logs l
    JOIN (SELECT job,MAX(id) id FROM job_logs GROUP BY job) latest ON latest.id=l.id
    ORDER BY l.id DESC
  `).all();
  const recentLogs = db.prepare('SELECT * FROM job_logs ORDER BY id DESC LIMIT 10').all();
  return NextResponse.json({ counts, latestExploreDate, lastJobs, recentLogs });
}
