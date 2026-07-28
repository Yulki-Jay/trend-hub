'use client';
import { useEffect, useState } from 'react';

const TYPES = ['repo', 'developer', 'news', 'paper'];

export default function Favorites() {
  const [user, setUser] = useState(undefined);
  const [items, setItems] = useState({ repo: {}, developer: {}, news: {}, paper: {} });
  const [tab, setTab] = useState('repo');

  const loadAll = async () => {
    const auth = await (await fetch('/api/auth/me')).json();
    setUser(auth.user || null);
    if (!auth.user) return;
    const results = await Promise.all(TYPES.map(async (type) => {
      const response = await fetch('/api/user/preferences?type=' + type);
      return [type, response.ok ? (await response.json()).favorites : {}];
    }));
    setItems(Object.fromEntries(results));
  };

  useEffect(() => { loadAll(); }, []);

  const remove = async (type, key) => {
    setItems((current) => {
      const nextType = { ...current[type] };
      delete nextType[key];
      return { ...current, [type]: nextType };
    });
    await fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, key, action: 'unfavorite' }),
    });
  };

  if (user === undefined) return <div className="min-h-screen flex items-center justify-center text-slate-400">加载中…</div>;

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="card max-w-sm p-8 text-center">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-xl font-bold">登录后查看收藏</h1>
          <p className="mt-2 text-sm text-slate-500">收藏内容会与账号关联，并可以在不同设备访问。</p>
          <a href="/login" className="btn mt-6 justify-center">登录 / 注册</a>
          <a href="/" className="mt-4 block text-sm text-slate-400 hover:text-brand">返回首页</a>
        </div>
      </div>
    );
  }

  const lists = Object.fromEntries(TYPES.map((type) => [type, Object.entries(items[type] || {})]));
  const tabs = [
    { key: 'repo', label: `开源项目 (${lists.repo.length})` },
    { key: 'developer', label: `开发者 (${lists.developer.length})` },
    { key: 'news', label: `新闻 (${lists.news.length})` },
    { key: 'paper', label: `论文 (${lists.paper.length})` },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="font-bold flex items-center gap-2"><span className="text-brand">◆</span> 我的收藏</div>
          <span className="text-xs text-slate-400">{user.display_name}</span>
          <a href="/" className="ml-auto btn-ghost">返回首页</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6 flex-wrap">
          {tabs.map((item) => (
            <button key={item.key} onClick={() => setTab(item.key)}
              className={`chip ${tab === item.key ? 'bg-brand text-white' : 'bg-slate-200/70 dark:bg-slate-800'}`}>
              {item.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {lists[tab].length ? lists[tab].map(([key, item]) => (
            <FavoriteCard key={key} type={tab} item={item} onRemove={() => remove(tab, key)} />
          )) : <Empty />}
        </div>
      </main>
    </div>
  );
}

function FavoriteCard({ type, item, onRemove }) {
  const title = type === 'repo' ? item.full_name
    : type === 'developer' ? `${item.name} @${item.login}`
      : item.title;
  const url = type === 'developer' ? item.url : item.url;
  const summary = type === 'developer' ? item.repo_desc : item.description || item.summary;
  const meta = type === 'repo' ? `${item.language || '其他'} · ⭐ ${item.stars || 0}`
    : type === 'developer' ? item.repo_name
      : type === 'news' ? item.source
        : `${item.source || ''} · ${item.category || ''}`;
  return (
    <div className="card p-4 flex items-start gap-3">
      {type === 'developer' && item.avatar && <img src={item.avatar} alt="" className="w-10 h-10 rounded-full shrink-0" />}
      <div className="flex-1 min-w-0">
        <a href={url} target="_blank" rel="noreferrer" className="font-semibold text-brand break-all">{title}</a>
        {summary && <p className="text-sm text-slate-500 mt-1">{summary}</p>}
        {meta && <div className="text-xs text-slate-400 mt-1">{meta}</div>}
      </div>
      <button className="text-red-500 text-xs" onClick={onRemove}>移除</button>
    </div>
  );
}

function Empty() {
  return <div className="text-center py-20 text-slate-400"><div className="text-5xl mb-3">⭐</div>暂无收藏。</div>;
}
