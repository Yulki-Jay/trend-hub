'use client';
import { useEffect, useState, useCallback } from 'react';

const CATS = [
  { key: '', label: '全部' },
  { key: 'tech', label: '科技' },
  { key: 'economy', label: '经济' },
  { key: 'politics', label: '政治' },
];
const RANGES = [
  { key: 'daily', label: '今日' },
  { key: 'weekly', label: '本周' },
  { key: 'monthly', label: '本月' },
];
const NEWS_RANGES = [
  { key: '', label: '全部' },
  { key: '24h', label: '24小时' },
  { key: '3d', label: '3天' },
  { key: '7d', label: '7天' },
];
const COL_OPTIONS = [2, 3, 4];

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => setDark(document.documentElement.classList.contains('dark')), []);
  const toggle = () => {
    const d = !dark;
    setDark(d);
    document.documentElement.classList.toggle('dark', d);
    localStorage.theme = d ? 'dark' : 'light';
  };
  return [dark, toggle];
}

function usePersistState(key, initial) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    const s = localStorage.getItem(key);
    if (s !== null) setV(JSON.parse(s));
  }, [key]);
  const set = (nv) => { setV(nv); localStorage.setItem(key, JSON.stringify(nv)); };
  return [v, set];
}

function useFav(key) {
  const [favs, setFavs] = useState({});
  useEffect(() => {
    try { setFavs(JSON.parse(localStorage.getItem(key) || '{}')); } catch {}
  }, [key]);
  const toggle = (id, item) => {
    setFavs((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id]; else next[id] = item || true;
      localStorage.setItem(key, JSON.stringify(next));
      return next;
    });
  };
  return [favs, toggle];
}

// 响应式列数：根据当前视口宽度对用户选择的列数做上限收敛
function useResponsiveCols(desired) {
  const [cols, setCols] = useState(desired);
  useEffect(() => {
    const calc = () => {
      const w = window.innerWidth;
      let max;
      if (w < 640) max = 1;
      else if (w < 1024) max = 2;
      else if (w < 1280) max = 3;
      else max = 4;
      setCols(Math.min(desired, max));
    };
    calc();
    window.addEventListener('resize', calc);
    return () => window.removeEventListener('resize', calc);
  }, [desired]);
  return cols;
}

// 瀑布流：按原始顺序（新到旧）从左到右逐个填入各列，保证阅读顺序 = 时间顺序
function Masonry({ items, cols, renderItem }) {
  const buckets = Array.from({ length: cols }, () => []);
  items.forEach((it, i) => buckets[i % cols].push(it));
  return (
    <div className="th-masonry">
      {buckets.map((bucket, ci) => (
        <div key={ci} className="th-col">
          {bucket.map((it) => renderItem(it))}
        </div>
      ))}
    </div>
  );
}

function Skeletons({ cols = 3, n = 9 }) {
  const heights = ['h-40', 'h-56', 'h-48', 'h-64', 'h-44', 'h-52'];
  return (
    <Masonry
      items={Array.from({ length: n }).map((_, i) => i)}
      cols={cols}
      renderItem={(i) => (
        <div key={i} className={`card p-5 space-y-3 ${heights[i % heights.length]}`}>
          <div className="skeleton h-4 w-2/3" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-full" />
          <div className="skeleton h-3 w-4/5" />
        </div>
      )}
    />
  );
}

function Star({ active, onClick }) {
  return (
    <button onClick={onClick}
      className={`text-lg shrink-0 transition ${active ? 'text-amber-400' : 'text-slate-300 hover:text-amber-300'}`}>
      {active ? '★' : '☆'}
    </button>
  );
}

function RepoCard({ r, fav, onFav }) {
  return (
    <div className="card p-5 animate-fadeup">
      <div className="flex items-start justify-between gap-2">
        <a href={r.url} target="_blank" rel="noreferrer"
          className="font-semibold text-brand hover:underline break-all leading-snug">
          {r.full_name}
        </a>
        <Star active={fav} onClick={() => onFav(r.full_name, r)} />
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
        {r.description || '暂无描述'}
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {r.language && <span className="inline-flex items-center gap-1">● {r.language}</span>}
        <span>⭐ {r.stars.toLocaleString()}</span>
        <span>🍴 {r.forks.toLocaleString()}</span>
        {r.today_stars > 0 && <span className="text-emerald-500 font-medium">+{r.today_stars} today</span>}
      </div>
    </div>
  );
}

function NewsCard({ n, fav, onFav }) {
  const cat = CATS.find((c) => c.key === n.category);
  return (
    <div className="card overflow-hidden animate-fadeup">
      {n.image && (
        <a href={n.url} target="_blank" rel="noreferrer" className="block">
          <img src={n.image} alt="" loading="lazy"
            className="w-full max-h-56 object-cover"
            onError={(e) => (e.currentTarget.parentElement.style.display = 'none')} />
        </a>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand">{cat?.label || n.category}</span>
          <span className="text-xs text-slate-400 truncate">{n.source}</span>
          <span className="ml-auto"><Star active={fav} onClick={() => onFav(n.url, n)} /></span>
        </div>
        <a href={n.url} target="_blank" rel="noreferrer"
          className="font-semibold hover:text-brand transition leading-snug">{n.title}</a>
        {n.summary && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{n.summary}</p>}
        <div className="mt-3 text-xs text-slate-400">{new Date(n.published_at).toLocaleString('zh-CN')}</div>
      </div>
    </div>
  );
}

function PaperCard({ p, fav, onFav }) {
  return (
    <div className="card p-5 animate-fadeup">
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <span className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/10 text-violet-500">{p.category}</span>
        <span className="text-xs text-slate-400">{p.source}</span>
        {p.year ? <span className="text-xs text-slate-400">{p.year}</span> : null}
        <span className="ml-auto"><Star active={fav} onClick={() => onFav(p.url, p)} /></span>
      </div>
      <a href={p.url} target="_blank" rel="noreferrer"
        className="font-semibold hover:text-brand transition leading-snug">{p.title}</a>
      {p.authors && <div className="mt-1 text-xs text-slate-400 line-clamp-1">{p.authors}</div>}
      {p.summary && <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{p.summary}</p>}
      {p.venue && <div className="mt-2 text-xs text-slate-400 italic line-clamp-1">📍 {p.venue}</div>}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
        <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 font-medium" title="被引用次数">
          📈 {p.citations ?? 0} 引用
        </span>
        {p.influential_citations > 0 && (
          <span className="inline-flex items-center gap-1 text-rose-500 font-medium" title="高影响力引用">
            🔥 {p.influential_citations} 高影响
          </span>
        )}
        {p.stars > 0 && (
          <span className="inline-flex items-center gap-1 text-amber-500" title="关联代码仓库星标">
            ⭐ {p.stars}
          </span>
        )}
        <span className="ml-auto text-slate-400">{new Date(p.published_at).toLocaleDateString('zh-CN')}</span>
      </div>
    </div>
  );
}

function DeveloperCard({ d, rank, fav, onFav }) {
  return (
    <div className="card p-5 animate-fadeup">
      <div className="flex items-start gap-3">
        <span className="text-lg font-bold text-slate-300 dark:text-slate-600 w-6 shrink-0">{rank}</span>
        {d.avatar && (
          <a href={d.url} target="_blank" rel="noreferrer" className="shrink-0">
            <img src={d.avatar} alt={d.login} loading="lazy"
              className="w-12 h-12 rounded-full ring-2 ring-slate-100 dark:ring-slate-800"
              onError={(e) => (e.currentTarget.style.display = 'none')} />
          </a>
        )}
        <div className="min-w-0 flex-1">
          <a href={d.url} target="_blank" rel="noreferrer"
            className="font-semibold hover:text-brand transition block truncate">{d.name}</a>
          <a href={d.url} target="_blank" rel="noreferrer"
            className="text-sm text-slate-400 hover:text-brand truncate block">@{d.login}</a>
        </div>
        <Star active={fav} onClick={() => onFav(d.login, d)} />
      </div>
      {d.repo_name && (
        <a href={d.repo_url} target="_blank" rel="noreferrer"
          className="mt-3 block rounded-lg border border-slate-200/70 dark:border-slate-800 px-3 py-2 hover:border-brand/40 transition">
          <div className="text-xs text-slate-400 mb-0.5">🔥 热门仓库</div>
          <div className="text-sm font-medium text-brand truncate">{d.repo_name}</div>
          {d.repo_desc && <div className="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mt-0.5">{d.repo_desc}</div>}
        </a>
      )}
    </div>
  );
}

function Empty() {
  return (
    <div className="text-center py-20 text-slate-400">
      <div className="text-5xl mb-3">📭</div>      暂无数据，请到后台点击「立即抓取」。
    </div>
  );
}

export default function Home() {
  const [dark, toggleTheme] = useTheme();
  const [tab, setTab] = useState('repos');
  const [cols, setCols] = usePersistState('th_cols', 3);
  const effectiveCols = useResponsiveCols(cols);
  const [range, setRange] = useState('daily');
  const [category, setCategory] = useState('');
  const [newsRange, setNewsRange] = useState('');
  const [paperCat, setPaperCat] = useState('');
  const [paperSort, setPaperSort] = useState('time');
  const [lang, setLang] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState(''); // 防抖后的查询词

  // 输入防抖 300ms
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const [repos, setRepos] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [devs, setDevs] = useState(null);
  const [news, setNews] = useState(null);
  const [papers, setPapers] = useState(null);
  const [paperCats, setPaperCats] = useState([]);
  const [stats, setStats] = useState(null);

  const [repoFav, toggleRepoFav] = useFav('th_fav_repos');
  const [newsFav, toggleNewsFav] = useFav('th_fav_news');
  const [paperFav, togglePaperFav] = useFav('th_fav_papers');
  const [devFav, toggleDevFav] = useFav('th_fav_devs');

  useEffect(() => { fetch('/api/stats').then((r) => r.json()).then(setStats); }, []);

  const loadRepos = useCallback(() => {
    setRepos(null);
    fetch('/api/repos?' + new URLSearchParams({ range, language: lang, q: dq }))
      .then((r) => r.json()).then((d) => { setRepos(d.items); setLanguages(d.languages || []); });
  }, [range, lang, dq]);

  const loadDevs = useCallback(() => {
    setDevs(null);
    fetch('/api/developers?' + new URLSearchParams({ range, q: dq }))
      .then((r) => r.json()).then((d) => setDevs(d.items));
  }, [range, dq]);

  const loadNews = useCallback(() => {
    setNews(null);
    fetch('/api/news?' + new URLSearchParams({ category, q: dq, range: newsRange }))
      .then((r) => r.json()).then((d) => setNews(d.items));
  }, [category, dq, newsRange]);

  const loadPapers = useCallback(() => {
    setPapers(null);
    fetch('/api/papers?' + new URLSearchParams({ category: paperCat, q: dq, sort: paperSort }))
      .then((r) => r.json()).then((d) => { setPapers(d.items); setPaperCats(d.categories || []); });
  }, [paperCat, dq, paperSort]);

  useEffect(() => { if (tab === 'repos') loadRepos(); }, [tab, loadRepos]);
  useEffect(() => { if (tab === 'devs') loadDevs(); }, [tab, loadDevs]);
  useEffect(() => { if (tab === 'news') loadNews(); }, [tab, loadNews]);
  useEffect(() => { if (tab === 'papers') loadPapers(); }, [tab, loadPapers]);

  const TABS = [
    { key: 'repos', label: '🔥 GitHub 热榜' },
    { key: 'devs', label: '👨‍💻 开发者榜' },
    { key: 'news', label: '📰 热点新闻' },
    { key: 'papers', label: '📄 前沿论文' },
  ];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="font-bold text-lg flex items-center gap-2"><span className="text-brand">◆</span> TrendHub</div>
          <div className="hidden md:flex text-xs text-slate-500 gap-4">
            {stats && (<>
              <span>今日开源 {stats.repos_today}</span>
              <span>新闻 {stats.news_total}</span>
              <span>论文 {stats.papers_total}</span>
            </>)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="/dashboard" className="btn-ghost">看板</a>
            <a href="/favorites" className="btn-ghost">收藏</a>
            <a href="/admin" className="btn-ghost">后台</a>
            <button onClick={toggleTheme} className="btn-ghost">{dark ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 pt-10 pb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          开源热榜 <span className="text-brand">·</span> 全网热点 <span className="text-brand">·</span> 前沿论文
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">实时聚合 GitHub Trending、科技/经济/政治中文资讯与计算机论文</p>
        <div className="mt-6 max-w-md mx-auto">
          <input className="input text-center" placeholder="搜索项目、新闻或论文（空格分隔多个关键词）…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4">
        <div className="flex justify-center gap-2 mb-6 flex-wrap">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`chip ${tab === t.key ? 'bg-brand text-white' : 'bg-slate-200/70 dark:bg-slate-800'}`}>
              {t.label}
            </button>
          ))}
        </div>

        {/* 筛选栏 */}
        <div className="flex flex-wrap items-center gap-2 mb-6 justify-center">
          {tab === 'repos' && (<>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`chip ${range === r.key ? 'bg-brand text-white' : 'bg-slate-200/60 dark:bg-slate-800'}`}>{r.label}</button>
            ))}
            <select className="input w-auto" value={lang} onChange={(e) => setLang(e.target.value)}>
              <option value="">全部语言</option>
              {languages.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </>)}
          {tab === 'devs' && (<>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)}
                className={`chip ${range === r.key ? 'bg-brand text-white' : 'bg-slate-200/60 dark:bg-slate-800'}`}>{r.label}</button>
            ))}
          </>)}
          {tab === 'news' && (<>
            {CATS.map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)}
                className={`chip ${category === c.key ? 'bg-brand text-white' : 'bg-slate-200/60 dark:bg-slate-800'}`}>{c.label}</button>
            ))}
            <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />
            {NEWS_RANGES.map((r) => (
              <button key={r.key} onClick={() => setNewsRange(r.key)}
                className={`chip text-xs ${newsRange === r.key ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-200/60 dark:bg-slate-800'}`}>{r.label}</button>
            ))}
          </>)}
          {tab === 'papers' && (<>
            <button onClick={() => setPaperCat('')}
              className={`chip ${paperCat === '' ? 'bg-brand text-white' : 'bg-slate-200/60 dark:bg-slate-800'}`}>全部</button>
            {paperCats.map((c) => (
              <button key={c} onClick={() => setPaperCat(c)}
                className={`chip ${paperCat === c ? 'bg-brand text-white' : 'bg-slate-200/60 dark:bg-slate-800'}`}>{c}</button>
            ))}
            <select className="input w-auto" value={paperSort} onChange={(e) => setPaperSort(e.target.value)}>
              <option value="time">最新</option>
              <option value="citations">引用最多</option>
              <option value="influential">高影响力</option>
              <option value="stars">代码星标</option>
            </select>
          </>)}

          {/* 列数控制 */}
          <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1 hidden sm:block" />
          <div className="hidden sm:flex items-center gap-1 text-xs text-slate-400">
            <span>列数</span>
            {COL_OPTIONS.map((c) => (
              <button key={c} onClick={() => setCols(c)}
                className={`w-7 h-7 rounded-md ${cols === c ? 'bg-brand text-white' : 'bg-slate-200/60 dark:bg-slate-800'}`}>{c}</button>
            ))}
          </div>
        </div>

        <div className="pb-16">
          {tab === 'repos' && (repos === null ? <Skeletons cols={effectiveCols} /> : repos.length === 0 ? <Empty /> :
            <Masonry items={repos} cols={effectiveCols}
              renderItem={(r) => <RepoCard key={r.id} r={r} fav={!!repoFav[r.full_name]} onFav={toggleRepoFav} />} />)}
          {tab === 'devs' && (devs === null ? <Skeletons cols={effectiveCols} /> : devs.length === 0 ? <Empty /> :
            <Masonry items={devs} cols={effectiveCols}
              renderItem={(d) => <DeveloperCard key={d.id} d={d} rank={d.rank} fav={!!devFav[d.login]} onFav={toggleDevFav} />} />)}
          {tab === 'news' && (news === null ? <Skeletons cols={effectiveCols} /> : news.length === 0 ? <Empty /> :
            <Masonry items={news} cols={effectiveCols}
              renderItem={(n) => <NewsCard key={n.id} n={n} fav={!!newsFav[n.url]} onFav={toggleNewsFav} />} />)}
          {tab === 'papers' && (papers === null ? <Skeletons cols={effectiveCols} /> : papers.length === 0 ? <Empty /> :
            <Masonry items={papers} cols={effectiveCols}
              renderItem={(p) => <PaperCard key={p.id} p={p} fav={!!paperFav[p.url]} onFav={togglePaperFav} />} />)}
        </div>
      </div>

      <footer className="border-t border-slate-200/60 dark:border-slate-800 py-6 text-center text-xs text-slate-400">
        TrendHub · 数据来源 GitHub Trending、公开 RSS 源、arXiv、Papers with Code 及各平台热榜
      </footer>
    </div>
  );
}
