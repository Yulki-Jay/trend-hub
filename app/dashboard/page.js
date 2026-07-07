'use client';
import { useEffect, useState } from 'react';

const CAT_LABEL = { tech: '科技', economy: '经济', politics: '政治' };
const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];

function Bar({ label, value, max, color }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="w-28 truncate text-slate-500">{label}</span>
      <div className="flex-1 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden">
        <div className="h-full rounded-lg transition-all" style={{ width: pct + '%', background: color }} />
      </div>
      <span className="w-10 text-right text-slate-500">{value}</span>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="card p-6">
      <div className="text-sm text-slate-500">{label}</div>
      <div className="text-3xl font-bold mt-1">{value}</div>
      {hint && <div className="text-xs text-slate-400 mt-1">{hint}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [s, setS] = useState(null);
  useEffect(() => { fetch('/api/stats').then((r) => r.json()).then(setS); }, []);

  if (!s) return <div className="min-h-screen flex items-center justify-center text-slate-400">加载中…</div>;

  const trendMax = Math.max(1, ...(s.trend || []).map((t) => t.c));
  const catMax = Math.max(1, ...(s.newsByCat || []).map((c) => c.c));
  const langMax = Math.max(1, ...(s.langDist || []).map((l) => l.c));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="font-bold flex items-center gap-2"><span className="text-brand">◆</span> 数据看板</div>
          <a href="/" className="ml-auto btn-ghost">返回首页</a>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="今日开源热榜" value={s.repos_today} hint="GitHub Trending 日榜" />
          <StatCard label="新闻总量" value={s.news_total} hint={`今日新增 ${s.news_today}`} />
          <StatCard label="论文总量" value={s.papers_total} hint={`今日新增 ${s.papers_today}`} />
          <StatCard label="活跃数据源" value={s.sources} hint="启用中的 RSS 源" />
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          <div className="card p-6">
            <h2 className="font-semibold mb-4">近 7 天新闻抓取趋势</h2>
            <div className="flex items-end gap-2 h-40">
              {(s.trend || []).map((t, i) => (
                <div key={t.d} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full rounded-t-lg bg-brand/80 transition-all"
                    style={{ height: `${(t.c / trendMax) * 100}%`, minHeight: 4 }} title={t.c} />
                  <span className="text-[10px] text-slate-400">{t.d.slice(5)}</span>
                </div>
              ))}
              {!s.trend?.length && <div className="text-slate-400 text-sm">暂无数据</div>}
            </div>
          </div>

          <div className="card p-6">
            <h2 className="font-semibold mb-4">新闻分类分布</h2>
            <div className="space-y-3">
              {(s.newsByCat || []).map((c, i) => (
                <Bar key={c.category} label={CAT_LABEL[c.category] || c.category}
                  value={c.c} max={catMax} color={COLORS[i % COLORS.length]} />
              ))}
              {!s.newsByCat?.length && <div className="text-slate-400 text-sm">暂无数据</div>}
            </div>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="font-semibold mb-4">今日热榜编程语言分布</h2>
          <div className="space-y-3">
            {(s.langDist || []).map((l, i) => (
              <Bar key={l.language} label={l.language} value={l.c} max={langMax} color={COLORS[i % COLORS.length]} />
            ))}
            {!s.langDist?.length && <div className="text-slate-400 text-sm">暂无数据</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
