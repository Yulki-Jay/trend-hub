'use client';
import { useEffect, useState } from 'react';

function load(key) {
  try { return Object.values(JSON.parse(localStorage.getItem(key) || '{}')).filter((v) => v && typeof v === 'object'); }
  catch { return []; }
}
function remove(key, id) {
  const obj = JSON.parse(localStorage.getItem(key) || '{}');
  delete obj[id];
  localStorage.setItem(key, JSON.stringify(obj));
}

export default function Favorites() {
  const [repos, setRepos] = useState([]);
  const [devs, setDevs] = useState([]);
  const [news, setNews] = useState([]);
  const [papers, setPapers] = useState([]);
  const [tab, setTab] = useState('repos');

  const refresh = () => {
    setRepos(load('th_fav_repos'));
    setDevs(load('th_fav_devs'));
    setNews(load('th_fav_news'));
    setPapers(load('th_fav_papers'));
  };
  useEffect(refresh, []);

  const del = (key, id, setter) => { remove(key, id); refresh(); };

  const TABS = [
    { key: 'repos', label: `开源项目 (${repos.length})` },
    { key: 'devs', label: `开发者 (${devs.length})` },
    { key: 'news', label: `新闻 (${news.length})` },
    { key: 'papers', label: `论文 (${papers.length})` },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="font-bold flex items-center gap-2"><span className="text-brand">◆</span> 我的收藏</div>
          <a href="/" className="ml-auto btn-ghost">返回首页</a>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex gap-2 mb-6">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`chip ${tab === t.key ? 'bg-brand text-white' : 'bg-slate-200/70 dark:bg-slate-800'}`}>{t.label}</button>
          ))}
        </div>

        <div className="space-y-3">
          {tab === 'repos' && (repos.length ? repos.map((r) => (
            <div key={r.full_name} className="card p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <a href={r.url} target="_blank" rel="noreferrer" className="font-semibold text-brand break-all">{r.full_name}</a>
                <p className="text-sm text-slate-500 mt-1">{r.description}</p>
                <div className="text-xs text-slate-400 mt-1">{r.language} · ⭐ {r.stars}</div>
              </div>
              <button className="text-red-500 text-xs" onClick={() => del('th_fav_repos', r.full_name)}>移除</button>
            </div>
          )) : <Empty />)}

          {tab === 'devs' && (devs.length ? devs.map((d) => (
            <div key={d.login} className="card p-4 flex items-start gap-3">
              {d.avatar && <img src={d.avatar} alt="" className="w-10 h-10 rounded-full shrink-0" />}
              <div className="flex-1 min-w-0">
                <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold">{d.name} <span className="text-slate-400 font-normal">@{d.login}</span></a>
                {d.repo_name && <div className="text-sm text-brand mt-1 truncate">🔥 {d.repo_name}</div>}
                {d.repo_desc && <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{d.repo_desc}</p>}
              </div>
              <button className="text-red-500 text-xs" onClick={() => del('th_fav_devs', d.login)}>移除</button>
            </div>
          )) : <Empty />)}

          {tab === 'news' && (news.length ? news.map((n) => (
            <div key={n.url} className="card p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <a href={n.url} target="_blank" rel="noreferrer" className="font-semibold">{n.title}</a>
                <p className="text-sm text-slate-500 mt-1">{n.summary}</p>
                <div className="text-xs text-slate-400 mt-1">{n.source}</div>
              </div>
              <button className="text-red-500 text-xs" onClick={() => del('th_fav_news', n.url)}>移除</button>
            </div>
          )) : <Empty />)}

          {tab === 'papers' && (papers.length ? papers.map((p) => (
            <div key={p.url} className="card p-4 flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <a href={p.url} target="_blank" rel="noreferrer" className="font-semibold">{p.title}</a>
                <p className="text-sm text-slate-500 mt-1">{p.summary}</p>
                <div className="text-xs text-slate-400 mt-1">{p.source} · {p.category}</div>
              </div>
              <button className="text-red-500 text-xs" onClick={() => del('th_fav_papers', p.url)}>移除</button>
            </div>
          )) : <Empty />)}
        </div>
      </main>
    </div>
  );
}

function Empty() {
  return <div className="text-center py-20 text-slate-400"><div className="text-5xl mb-3">⭐</div>暂无收藏，点击卡片上的星标即可收藏。</div>;
}
