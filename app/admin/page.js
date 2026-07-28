'use client';
import { useEffect, useState } from 'react';
import { Loading, PageHeader, Panel, StatusBadge, Toast } from './components';

const STAT_META = [
  ['reposToday', '今日热榜', 'GitHub Trending 日榜', '🔥'],
  ['explore', '探索候选', '最新推荐候选池', '✨'],
  ['news', '新闻总量', '已入库资讯', '📰'],
  ['papers', '论文总量', '已入库论文', '📄'],
  ['users', '有效用户', '未停用账号', '👥'],
  ['sources', '启用数据源', '正在运行的 RSS 源', '◉'],
];

export default function AdminOverview() {
  const [data, setData] = useState(null);
  const [busy, setBusy] = useState('');
  const [toast, setToast] = useState('');
  const flash = (message) => { setToast(message); setTimeout(() => setToast(''), 2600); };
  const load = () => fetch('/api/admin/overview').then((r) => r.json()).then(setData);
  useEffect(() => { load(); }, []);

  const action = async (name, label) => {
    setBusy(name);
    const response = await fetch('/api/admin/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: name }),
    });
    const result = await response.json();
    setBusy('');
    flash(response.ok ? `${label}已完成` : `失败：${result.error || '未知错误'}`);
    load();
  };

  if (!data) return <Loading />;

  return (
    <>
      <PageHeader title="运营概览" desc="查看内容规模、任务健康状态和需要处理的异常。"
        actions={<>
          <button className="btn-ghost" disabled={!!busy} onClick={() => action('fetch-explore', '探索池更新')}>✨ 更新探索池</button>
          <button className="btn" disabled={!!busy} onClick={() => action('fetch', '全量抓取')}>{busy === 'fetch' ? '抓取中…' : '⟳ 全量抓取'}</button>
        </>} />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {STAT_META.map(([key, label, hint, icon]) => (
          <div key={key} className="card p-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">{label}</span>
              <span className="text-lg">{icon}</span>
            </div>
            <div className="mt-2 text-3xl font-bold">{Number(data.counts[key] || 0).toLocaleString()}</div>
            <div className="mt-1 text-xs text-slate-400">{hint}</div>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1.35fr]">
        <Panel title="任务健康" desc="每类任务最近一次运行结果">
          <div className="space-y-3">
            {data.lastJobs.map((job) => (
              <div key={job.job} className="flex items-center gap-3 rounded-xl border border-slate-200/70 px-4 py-3 dark:border-slate-800">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium">{job.job}</div>
                  <div className="mt-0.5 truncate text-xs text-slate-400">{job.message}</div>
                </div>
                <StatusBadge status={job.status} />
                <span className="hidden text-[11px] text-slate-400 sm:block">{job.created_at}</span>
              </div>
            ))}
            {!data.lastJobs.length && <div className="py-8 text-center text-sm text-slate-400">暂无任务记录</div>}
          </div>
        </Panel>

        <Panel title="最近活动" desc="系统最近 10 条任务日志" action={<a href="/admin/jobs" className="text-xs text-brand">查看全部 →</a>}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs text-slate-400"><tr><th className="pb-3 font-medium">时间</th><th className="pb-3 font-medium">任务</th><th className="pb-3 font-medium">状态</th><th className="pb-3 font-medium">说明</th></tr></thead>
              <tbody>
                {data.recentLogs.map((log) => (
                  <tr key={log.id} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-3 pr-3 whitespace-nowrap text-xs text-slate-400">{log.created_at}</td>
                    <td className="py-3 pr-3">{log.job}</td>
                    <td className="py-3 pr-3"><StatusBadge status={log.status} /></td>
                    <td className="py-3 text-slate-500">{log.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
      <Toast message={toast} />
    </>
  );
}
