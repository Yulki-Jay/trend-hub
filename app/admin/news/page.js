'use client';
import { useEffect, useMemo, useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { runAdminAction, useFlash } from '../hooks';
import { adminFetch } from '../api';

const CATEGORIES = [['tech', '科技'], ['economy', '经济'], ['politics', '政治']];

export default function NewsAdmin() {
  const [sources, setSources] = useState(null);
  const [filter, setFilter] = useState('');
  const [draft, setDraft] = useState({ name: '', url: '', category: 'tech' });
  const [busy, setBusy] = useState('');
  const { message, flash } = useFlash();
  const load = () => adminFetch('/api/admin/sources').then((r) => r.json()).then((d) => setSources(d.items || []));
  useEffect(() => { load(); }, []);
  const visible = useMemo(() => (sources || []).filter((source) => !filter || source.category === filter), [sources, filter]);
  if (!sources) return <Loading />;

  const add = async () => {
    if (!draft.name || !draft.url) return flash('请填写数据源名称和 RSS 地址');
    const response = await adminFetch('/api/admin/sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(draft),
    });
    const data = await response.json();
    if (!response.ok) return flash(data.error || '添加失败');
    setDraft({ name: '', url: '', category: 'tech' });
    load(); flash('新闻源已添加');
  };
  const toggle = async (source) => {
    await adminFetch('/api/admin/sources', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: source.id, enabled: !source.enabled }),
    });
    load();
  };
  const remove = async (source) => {
    if (!window.confirm(`确认删除新闻源“${source.name}”？`)) return;
    await adminFetch('/api/admin/sources', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: source.id }),
    });
    load(); flash('新闻源已删除');
  };
  const fetchNews = async () => {
    setBusy('fetch');
    try { const result = await runAdminAction({ action: 'fetch-news' }); flash(`新闻抓取完成：${result.newsCount} 条`); }
    catch (e) { flash('失败：' + e.message); }
    setBusy('');
  };

  return (
    <>
      <PageHeader eyebrow="内容运营" title="新闻源" desc="维护 RSS 数据源、启停抓取，并按内容分类查看运营状态。"
        actions={<button className="btn" disabled={busy === 'fetch'} onClick={fetchNews}>{busy === 'fetch' ? '抓取中…' : '⟳ 立即抓取新闻'}</button>} />

      <Panel title="添加新闻源" desc="添加后会参与下一次新闻抓取。">
        <div className="grid gap-3 md:grid-cols-[1fr_2fr_160px_auto]">
          <input className="input" placeholder="数据源名称" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          <input className="input" placeholder="https://example.com/rss.xml" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} />
          <select className="input" value={draft.category} onChange={(e) => setDraft({ ...draft, category: e.target.value })}>
            {CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button className="btn justify-center" onClick={add}>添加</button>
        </div>
      </Panel>

      <Panel className="mt-6" title={`数据源列表 · ${visible.length}`} action={
        <select className="input w-auto py-1.5" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">全部分类</option>{CATEGORIES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      }>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {visible.map((source) => (
            <div key={source.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center">
              <button onClick={() => toggle(source)} className={`h-6 w-11 rounded-full p-1 transition ${source.enabled ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-700'}`}>
                <span className={`block h-4 w-4 rounded-full bg-white transition ${source.enabled ? 'translate-x-5' : ''}`} />
              </button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2"><span className="font-medium">{source.name}</span><span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] text-brand">{CATEGORIES.find(([value]) => value === source.category)?.[1]}</span></div>
                <div className="mt-1 truncate text-xs text-slate-400">{source.url}</div>
              </div>
              <span className={`text-xs ${source.enabled ? 'text-emerald-500' : 'text-slate-400'}`}>{source.enabled ? '抓取中' : '已停用'}</span>
              <button className="text-xs text-red-500" onClick={() => remove(source)}>删除</button>
            </div>
          ))}
          {!visible.length && <div className="py-12 text-center text-sm text-slate-400">没有符合条件的数据源</div>}
        </div>
      </Panel>
      <Toast message={message} />
    </>
  );
}
