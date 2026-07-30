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
const EXPLORE_CATS = [
  { key: '', label: '全部' },
  { key: 'ai', label: 'AI' },
  { key: 'devtools', label: '开发工具' },
  { key: 'frontend', label: '前端' },
  { key: 'backend', label: '后端' },
  { key: 'data', label: '数据' },
  { key: 'security', label: '安全' },
  { key: 'mobile', label: '移动端' },
  { key: 'other', label: '其他' },
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

function useFav(type, user) {
  const [favs, setFavs] = useState({});
  const [dismissed, setDismissed] = useState([]);
  useEffect(() => {
    if (!user) {
      setFavs({});
      setDismissed([]);
      return;
    }
    fetch('/api/user/preferences?type=' + type)
      .then((r) => r.ok ? r.json() : { favorites: {}, dismissed: [] })
      .then((data) => {
        setFavs(data.favorites || {});
        setDismissed(data.dismissed || []);
      });
  }, [type, user?.id]);
  const toggle = (id, item) => {
    if (!user) return;
    const itemKey = type === 'repo' ? id.toLowerCase() : id;
    const active = !!favs[itemKey];
    setFavs((prev) => {
      const next = { ...prev };
      if (active) delete next[itemKey]; else next[itemKey] = item;
      return next;
    });
    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, key: itemKey, item, action: active ? 'unfavorite' : 'favorite' }),
    });
  };
  const dismiss = (id) => {
    if (!user) return;
    const normalized = id.toLowerCase();
    setDismissed((prev) => [...new Set([...prev, normalized])]);
    setFavs((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    fetch('/api/user/preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, key: normalized, action: 'dismiss' }),
    });
  };
  return [favs, toggle, dismissed, dismiss];
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

function RepoCard({ r, fav, onFav, explore = false, onDismiss }) {
  return (
    <div className="card p-5 animate-fadeup">
      {explore && r.reason && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-600 dark:text-violet-400">
          ✨ {r.reason}
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <a href={r.url} target="_blank" rel="noreferrer"
          className="font-semibold text-brand hover:underline break-all leading-snug">
          {r.full_name}
        </a>
        {onFav && <Star active={fav} onClick={() => onFav(r.full_name, r)} />}
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 whitespace-pre-line">
        {r.description || '暂无描述'}
      </p>
      {explore && r.topics?.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {r.topics.slice(0, 4).map((topic) => (
            <span key={topic} className="rounded-md bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {topic}
            </span>
          ))}
        </div>
      )}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
        {r.language && <span className="inline-flex items-center gap-1">● {r.language}</span>}
        <span>⭐ {r.stars.toLocaleString()}</span>
        <span>🍴 {r.forks.toLocaleString()}</span>
        {r.today_stars > 0 && <span className="text-emerald-500 font-medium">+{r.today_stars} today</span>}
        {explore && r.growth_7d > 0 && <span className="text-emerald-500 font-medium">+{r.growth_7d} / 7天</span>}
      </div>
      {explore && onDismiss && (
        <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 text-[11px] text-slate-400 dark:border-slate-800">
          <span>{r.pushed_at ? `最近更新 ${new Date(r.pushed_at).toLocaleDateString('zh-CN')}` : '持续关注中'}</span>
          <button onClick={() => onDismiss?.(r.full_name)} className="hover:text-slate-600 dark:hover:text-slate-200">不感兴趣</button>
        </div>
      )}
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
          {onFav && <span className="ml-auto"><Star active={fav} onClick={() => onFav(n.url, n)} /></span>}
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
        {onFav && <span className="ml-auto"><Star active={fav} onClick={() => onFav(p.url, p)} /></span>}
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
        {onFav && <Star active={fav} onClick={() => onFav(d.login, d)} />}
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

function ExploreEmpty() {
  return (
    <div className="text-center py-20 text-slate-400">
      <div className="text-5xl mb-3">🧭</div>
      暂无可推荐项目，请调整筛选条件，或到后台点击「更新探索池」。
    </div>
  );
}

export default function Home() {
  const [dark, toggleTheme] = useTheme();
  const [tab, setTab] = useState('repos');
  const [cols, setCols] = usePersistState('th_cols', 3);
  const effectiveCols = useResponsiveCols(cols);
  const [repoMode, setRepoMode] = useState('daily');
  const [devRange, setDevRange] = useState('daily');
  const [exploreCategory, setExploreCategory] = useState('');
  const [exploreLang, setExploreLang] = useState('');
  const [exploreBatch, setExploreBatch] = usePersistState('th_explore_batch', 0);
  const [category, setCategory] = useState('');
  const [newsRange, setNewsRange] = useState('');
  const [paperCat, setPaperCat] = useState('');
  const [paperSort, setPaperSort] = useState('time');
  const [lang, setLang] = useState('');
  const [q, setQ] = useState('');
  const [dq, setDq] = useState(''); // 防抖后的查询词
  const [auth, setAuth] = useState({ loading: true, user: null, isAdmin: false });

  // 输入防抖 300ms
  useEffect(() => {
    const t = setTimeout(() => setDq(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const [repos, setRepos] = useState(null);
  const [languages, setLanguages] = useState([]);
  const [explore, setExplore] = useState(null);
  const [exploreLanguages, setExploreLanguages] = useState([]);
  const [exploreCategories, setExploreCategories] = useState([]);
  const [devs, setDevs] = useState(null);
  const [news, setNews] = useState(null);
  const [papers, setPapers] = useState(null);
  const [paperCats, setPaperCats] = useState([]);
  const [stats, setStats] = useState(null);
  const [siteConfig, setSiteConfig] = useState({ siteName: 'TrendHub', siteDescription: '实时聚合 GitHub Trending、科技资讯与前沿论文' });

  const [repoFav, toggleRepoFav, repoDismissed, dismissRepo] = useFav('repo', auth.user);
  const [newsFav, toggleNewsFav] = useFav('news', auth.user);
  const [paperFav, togglePaperFav] = useFav('paper', auth.user);
  const [devFav, toggleDevFav] = useFav('developer', auth.user);

  useEffect(() => {
    let active = true;
    const refreshAuth = () => {
      fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => {
          if (active) setAuth({ loading: false, user: data.user || null, isAdmin: !!data.isAdmin });
        })
        .catch(() => {
          if (active) setAuth({ loading: false, user: null, isAdmin: false });
        });
    };
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') refreshAuth();
    };
    refreshAuth();
    window.addEventListener('focus', refreshAuth);
    window.addEventListener('pageshow', refreshAuth);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      active = false;
      window.removeEventListener('focus', refreshAuth);
      window.removeEventListener('pageshow', refreshAuth);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    setAuth({ loading: false, user: null, isAdmin: false });
  };

  useEffect(() => { fetch('/api/stats').then((r) => r.json()).then(setStats); }, []);
  useEffect(() => { fetch('/api/config').then((r) => r.json()).then(setSiteConfig); }, []);

  const loadRepos = useCallback(() => {
    setRepos(null);
    fetch('/api/repos?' + new URLSearchParams({ range: repoMode, language: lang, q: dq }))
      .then((r) => r.json()).then((d) => { setRepos(d.items); setLanguages(d.languages || []); });
  }, [repoMode, lang, dq]);

  const loadExplore = useCallback(async () => {
    setExplore(null);
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem('th_explore_seen') || '[]'); } catch {}
    const dismissed = repoDismissed;
    const request = async (excluded) => {
      const params = new URLSearchParams({
        category: exploreCategory,
        language: exploreLang,
        q: dq,
        seed: String(exploreBatch),
        exclude: excluded.slice(-150).join(','),
      });
      return (await fetch('/api/explore?' + params)).json();
    };
    let data = await request([...seen, ...dismissed]);
    if (!data.items?.length && seen.length) {
      localStorage.removeItem('th_explore_seen');
      seen = [];
      data = await request(dismissed);
    }
    setExplore(data.items || []);
    setExploreLanguages(data.languages || []);
    setExploreCategories(data.categories || []);
  }, [exploreCategory, exploreLang, dq, exploreBatch, repoDismissed]);

  const loadDevs = useCallback(() => {
    setDevs(null);
    fetch('/api/developers?' + new URLSearchParams({ range: devRange, q: dq }))
      .then((r) => r.json()).then((d) => setDevs(d.items));
  }, [devRange, dq]);

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

  useEffect(() => { if (tab === 'repos' && repoMode !== 'explore') loadRepos(); }, [tab, repoMode, loadRepos]);
  useEffect(() => { if (tab === 'repos' && repoMode === 'explore') loadExplore(); }, [tab, repoMode, loadExplore]);
  useEffect(() => { if (tab === 'devs') loadDevs(); }, [tab, loadDevs]);
  useEffect(() => { if (tab === 'news') loadNews(); }, [tab, loadNews]);
  useEffect(() => { if (tab === 'papers') loadPapers(); }, [tab, loadPapers]);

  const nextExploreBatch = () => {
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem('th_explore_seen') || '[]'); } catch {}
    const names = (explore || []).map((item) => item.full_name.toLowerCase());
    localStorage.setItem('th_explore_seen', JSON.stringify([...new Set([...seen, ...names])].slice(-200)));
    setExploreBatch(Number(exploreBatch) + 1);
  };

  const dismissExplore = (fullName) => {
    dismissRepo(fullName);
    setExplore((items) => (items || []).filter((item) => item.full_name !== fullName));
  };

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
          <div className="font-bold text-lg flex items-center gap-2"><span className="text-brand">◆</span> {siteConfig.siteName}</div>
          <div className="hidden md:flex text-xs text-slate-500 gap-4">
            {stats && (<>
              <span>今日开源 {stats.repos_today}</span>
              <span>新闻 {stats.news_total}</span>
              <span>论文 {stats.papers_total}</span>
            </>)}
          </div>
          <div className="ml-auto flex items-center gap-2">
            <a href="/dashboard" className="btn-ghost">看板</a>
            {auth.user ? (<>
              <a href="/favorites" className="btn-ghost">收藏</a>
              <a href="/account" className="btn-ghost"><span className="hidden sm:inline">{auth.user.display_name}</span><span>账号</span></a>
              <button className="btn-ghost" onClick={logout} title="退出登录">退出</button>
            </>) : !auth.loading && <a href="/login" className="btn-ghost">登录 / 注册</a>}
            {auth.isAdmin && <a href="/admin" className="btn-ghost">后台</a>}
            <button onClick={toggleTheme} className="btn-ghost">{dark ? '☀️' : '🌙'}</button>
          </div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 pt-10 pb-6 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          开源热榜 <span className="text-brand">·</span> 全网热点 <span className="text-brand">·</span> 前沿论文
        </h1>
        <p className="mt-3 text-slate-500 dark:text-slate-400">{siteConfig.siteDescription}</p>
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
              <button key={r.key} onClick={() => setRepoMode(r.key)}
                className={`chip ${repoMode === r.key ? 'bg-brand text-white' : 'bg-slate-200/60 dark:bg-slate-800'}`}>{r.label}</button>
            ))}
            <button onClick={() => setRepoMode('explore')}
              className={`chip ${repoMode === 'explore' ? 'bg-violet-600 text-white' : 'bg-violet-500/10 text-violet-600 dark:text-violet-400'}`}>
              ✨ 探索
            </button>
            {repoMode !== 'explore' && (
              <select className="input w-auto" value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="">全部语言</option>
                {languages.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            )}
            {repoMode === 'explore' && (<>
              <span className="w-px h-5 bg-slate-300 dark:bg-slate-700 mx-1" />
              {EXPLORE_CATS.filter((cat) => cat.key === '' || exploreCategories.some((item) => item.category === cat.key)).map((cat) => (
                <button key={cat.key} onClick={() => setExploreCategory(cat.key)}
                  className={`chip text-xs ${exploreCategory === cat.key ? 'bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900' : 'bg-slate-200/60 dark:bg-slate-800'}`}>
                  {cat.label}
                </button>
              ))}
              <select className="input w-auto" value={exploreLang} onChange={(e) => setExploreLang(e.target.value)}>
                <option value="">全部语言</option>
                {exploreLanguages.map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </>)}
          </>)}
          {tab === 'devs' && (<>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setDevRange(r.key)}
                className={`chip ${devRange === r.key ? 'bg-brand text-white' : 'bg-slate-200/60 dark:bg-slate-800'}`}>{r.label}</button>
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
          {tab === 'repos' && repoMode !== 'explore' && (repos === null ? <Skeletons cols={effectiveCols} /> : repos.length === 0 ? <Empty /> :
            <Masonry items={repos} cols={effectiveCols}
              renderItem={(r) => <RepoCard key={r.id} r={r} fav={!!repoFav[r.full_name.toLowerCase()]}
                onFav={auth.user ? toggleRepoFav : undefined} />} />)}
          {tab === 'repos' && repoMode === 'explore' && (<>
            <div className="mb-6 flex flex-col gap-3 rounded-2xl border border-violet-200/70 bg-violet-50/70 p-4 sm:flex-row sm:items-center dark:border-violet-900/50 dark:bg-violet-950/20">
              <div>
                <div className="font-semibold text-violet-700 dark:text-violet-300">跳出榜单，发现下一个有趣项目</div>
                <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">综合新鲜度、活跃度和增长趋势推荐，并主动避开最近的 GitHub Trending 项目。</div>
              </div>
              <button className="btn ml-auto shrink-0 bg-violet-600 hover:bg-violet-700" disabled={!explore?.length} onClick={nextExploreBatch}>
                🎲 换一批
              </button>
            </div>
            {explore === null ? <Skeletons cols={effectiveCols} /> : explore.length === 0 ? <ExploreEmpty /> :
              <Masonry items={explore} cols={effectiveCols}
                renderItem={(r) => <RepoCard key={r.id} r={r} explore fav={!!repoFav[r.full_name.toLowerCase()]}
                  onFav={auth.user ? toggleRepoFav : undefined} onDismiss={auth.user ? dismissExplore : undefined} />} />}
          </>)}
          {tab === 'devs' && (devs === null ? <Skeletons cols={effectiveCols} /> : devs.length === 0 ? <Empty /> :
            <Masonry items={devs} cols={effectiveCols}
              renderItem={(d) => <DeveloperCard key={d.id} d={d} rank={d.rank} fav={!!devFav[d.login]}
                onFav={auth.user ? toggleDevFav : undefined} />} />)}
          {tab === 'news' && (news === null ? <Skeletons cols={effectiveCols} /> : news.length === 0 ? <Empty /> :
            <Masonry items={news} cols={effectiveCols}
              renderItem={(n) => <NewsCard key={n.id} n={n} fav={!!newsFav[n.url]}
                onFav={auth.user ? toggleNewsFav : undefined} />} />)}
          {tab === 'papers' && (papers === null ? <Skeletons cols={effectiveCols} /> : papers.length === 0 ? <Empty /> :
            <Masonry items={papers} cols={effectiveCols}
              renderItem={(p) => <PaperCard key={p.id} p={p} fav={!!paperFav[p.url]}
                onFav={auth.user ? togglePaperFav : undefined} />} />)}
        </div>
      </div>

      <footer className="border-t border-slate-200/60 dark:border-slate-800 py-6 text-center text-xs text-slate-400">
        {siteConfig.siteName} · 数据来源 GitHub Trending、公开 RSS 源、arXiv、Papers with Code 及各平台热榜
      </footer>
    </div>
  );
}
