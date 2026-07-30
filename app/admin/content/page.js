'use client';
import { useEffect, useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { useFlash } from '../hooks';
import { adminFetch } from '../api';

const TABS = [['news', '新闻'], ['papers', '论文'], ['repos', 'GitHub 热榜'], ['explore', '探索候选']];

export default function ContentAdmin() {
  const [type, setType] = useState('news');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState(null);
  const [selected, setSelected] = useState([]);
  const { message, flash } = useFlash();
  const load = async (nextPage = page) => {
    const params = new URLSearchParams({ type, q, page: String(nextPage), pageSize: '20' });
    const result = await (await adminFetch('/api/admin/content?' + params)).json();
    setData(result); setSelected([]);
  };
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); load(1); }, 250);
    return () => clearTimeout(timer);
  }, [type, q]);
  if (!data) return <Loading />;
  const toggle = (key) => setSelected((current) => current.includes(key) ? current.filter((item) => item !== key) : [...current, key]);
  const remove = async () => {
    if (!selected.length || !window.confirm(`确认删除选中的 ${selected.length} 条内容？此操作不可恢复。`)) return;
    const response = await adminFetch('/api/admin/content', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, keys: selected }),
    });
    const result = await response.json();
    if (!response.ok) return flash(result.error || '删除失败');
    flash(`已删除 ${result.deleted} 条内容`); load();
  };

  return (
    <>
      <PageHeader eyebrow="内容运营" title="内容库" desc="统一检索和维护已入库的新闻、论文、GitHub 热榜与探索候选。" />
      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {TABS.map(([key, label]) => <button key={key} onClick={() => setType(key)} className={`card p-4 text-left ${type === key ? 'ring-2 ring-brand' : ''}`}><div className="text-sm text-slate-500">{label}</div><div className="mt-1 text-2xl font-bold">{Number(data.counts[key] || 0).toLocaleString()}</div></button>)}
      </div>
      <Panel title={TABS.find(([key]) => key === type)?.[1]} action={<button className="text-xs text-red-500 disabled:opacity-40" disabled={!selected.length} onClick={remove}>删除选中 ({selected.length})</button>}>
        <input className="input mb-5" placeholder="搜索标题、描述、作者或来源" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {data.items.map((item) => (
            <label key={item.key} className="flex cursor-pointer items-start gap-3 py-4">
              <input className="mt-1" type="checkbox" checked={selected.includes(item.key)} onChange={() => toggle(item.key)} />
              <div className="min-w-0 flex-1"><div className="font-medium break-all">{item.title}</div>{item.summary && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{item.summary}</p>}<div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-400"><span>{item.meta}</span>{item.metric > 0 && <span>{type === 'papers' ? '引用' : '⭐'} {item.metric}</span>}<span>{item.date}</span></div></div>
            </label>
          ))}
          {!data.items.length && <div className="py-16 text-center text-sm text-slate-400">没有符合条件的内容</div>}
        </div>
        <div className="mt-5 flex items-center justify-between text-xs text-slate-400"><span>共 {data.pagination.total} 条</span><div className="flex items-center gap-2"><button className="btn-ghost py-1 text-xs" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); load(next); }}>上一页</button><span>{page} / {data.pagination.pages}</span><button className="btn-ghost py-1 text-xs" disabled={page >= data.pagination.pages} onClick={() => { const next = page + 1; setPage(next); load(next); }}>下一页</button></div></div>
      </Panel>
      <Toast message={message} />
    </>
  );
}
