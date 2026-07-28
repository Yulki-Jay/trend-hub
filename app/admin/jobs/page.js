'use client';
import { useEffect, useState } from 'react';
import { Loading, PageHeader, Panel, StatusBadge, Toast } from '../components';
import { runAdminAction, useAdminSettings, useFlash } from '../hooks';

export default function JobsAdmin() {
  const { settings, setSettings, save } = useAdminSettings();
  const [logs, setLogs] = useState(null);
  const [busy, setBusy] = useState('');
  const { message, flash } = useFlash();
  const loadLogs = () => fetch('/api/admin/actions').then((r) => r.json()).then((d) => setLogs(d.logs || []));
  useEffect(() => { loadLogs(); }, []);
  if (!settings || !logs) return <Loading />;
  const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  const savePage = async () => {
    setBusy('save');
    try {
      await save({ cron_fetch: settings.cron_fetch, cron_explore: settings.cron_explore, cron_email: settings.cron_email });
      flash('定时任务已保存并重新加载');
    } catch (e) { flash('失败：' + e.message); }
    setBusy('');
  };
  const action = async (name, label) => {
    setBusy(name);
    try { await runAdminAction({ action: name }); flash(label + '已完成'); }
    catch (e) { flash('失败：' + e.message); }
    setBusy(''); loadLogs();
  };

  return (
    <>
      <PageHeader eyebrow="系统运营" title="定时任务" desc="管理自动抓取与邮件推送计划，并查看任务运行历史。"
        actions={<button className="btn" disabled={!!busy} onClick={() => action('fetch', '全量抓取')}>{busy === 'fetch' ? '运行中…' : '▶ 立即运行全量任务'}</button>} />

      <Panel title="任务计划" desc="使用标准 5 段 cron 表达式，保存后调度器立即重新加载。">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            ['cron_fetch', '内容抓取', '0 */2 * * *', '默认每 2 小时'],
            ['cron_explore', '探索候选池', '30 3 * * *', '默认每日 03:30'],
            ['cron_email', '邮件推送', '0 8 * * *', '默认每日 08:00'],
          ].map(([key, label, placeholder, hint]) => (
            <label key={key} className="block">
              <span className="text-sm font-medium">{label}</span>
              <input className="input mt-2 font-mono" placeholder={placeholder} value={settings[key] || ''} onChange={(e) => set(key, e.target.value)} />
              <span className="mt-2 block text-xs text-slate-400">{hint}</span>
            </label>
          ))}
        </div>
        <div className="mt-5 flex justify-end"><button className="btn" disabled={busy === 'save'} onClick={savePage}>{busy === 'save' ? '保存中…' : '保存任务计划'}</button></div>
      </Panel>

      <Panel className="mt-6" title="手动运行" desc="用于单独验证某个内容模块，不影响其他任务。">
        <div className="flex flex-wrap gap-3">
          <button className="btn-ghost" disabled={!!busy} onClick={() => action('fetch-github', 'GitHub 抓取')}>GitHub 热榜</button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => action('fetch-explore', '探索池更新')}>探索候选池</button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => action('fetch-news', '新闻抓取')}>新闻</button>
          <button className="btn-ghost" disabled={!!busy} onClick={() => action('fetch-papers', '论文抓取')}>论文</button>
        </div>
      </Panel>

      <Panel className="mt-6" title={`运行日志 · 最近 ${logs.length} 条`} action={<button className="text-xs text-brand" onClick={loadLogs}>刷新</button>}>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs text-slate-400"><tr><th className="pb-3 font-medium">时间</th><th className="pb-3 font-medium">任务</th><th className="pb-3 font-medium">状态</th><th className="pb-3 font-medium">数量</th><th className="pb-3 font-medium">说明</th></tr></thead>
            <tbody>{logs.map((log) => (
              <tr key={log.id} className="border-t border-slate-100 dark:border-slate-800">
                <td className="py-3 pr-4 whitespace-nowrap text-xs text-slate-400">{log.created_at}</td>
                <td className="py-3 pr-4 font-medium">{log.job}</td>
                <td className="py-3 pr-4"><StatusBadge status={log.status} /></td>
                <td className="py-3 pr-4">{log.count || 0}</td>
                <td className="py-3 text-slate-500">{log.message}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </Panel>
      <Toast message={message} />
    </>
  );
}
