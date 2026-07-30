'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const GROUPS = [
  {
    label: '运营总览',
    items: [{ href: '/admin', icon: '◫', label: '概览' }],
  },
  {
    label: '内容运营',
    items: [
      { href: '/admin/content', icon: '▦', label: '内容库' },
      { href: '/admin/github', icon: '◆', label: 'GitHub 运营' },
      { href: '/admin/news', icon: '▤', label: '新闻源' },
      { href: '/admin/papers', icon: '▧', label: '论文' },
    ],
  },
  {
    label: '系统运营',
    items: [
      { href: '/admin/jobs', icon: '◷', label: '定时任务' },
      { href: '/admin/email', icon: '✉', label: '邮件推送' },
      { href: '/admin/users', icon: '♙', label: '用户管理' },
      { href: '/admin/system', icon: '⚙', label: '系统策略' },
    ],
  },
];

export default function AdminShell({ user, children }) {
  const pathname = usePathname();
  const active = (href) => href === '/admin' ? pathname === href : pathname.startsWith(href);
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.replace('/');
  };

  useEffect(() => {
    let active = true;
    const verify = async () => {
      try {
        const response = await fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' });
        const auth = await response.json();
        if (!active) return;
        if (!auth.user) {
          const next = `${window.location.pathname}${window.location.search}`;
          window.location.replace(`/login?next=${encodeURIComponent(next)}`);
        } else if (auth.user.must_change_password) {
          window.location.replace('/account?security=required');
        } else if (!auth.isAdmin) {
          window.location.replace('/access-denied');
        }
      } catch {
        // 短暂网络异常不应主动清除本地界面；后续接口仍会在 401 时跳转登录。
      }
    };
    const onVisible = () => document.visibilityState === 'visible' && verify();
    verify();
    window.addEventListener('pageshow', verify);
    window.addEventListener('focus', verify);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      active = false;
      window.removeEventListener('pageshow', verify);
      window.removeEventListener('focus', verify);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const links = GROUPS.flatMap((group) => group.items);

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden lg:flex h-screen sticky top-0 flex-col border-r border-slate-200/70 bg-white/80 px-4 py-5 dark:border-slate-800 dark:bg-slate-950/90">
        <a href="/admin" className="flex items-center gap-2 px-3 text-lg font-bold">
          <span className="text-brand">◆</span> TrendHub Admin
        </a>
        <nav className="mt-8 flex-1 space-y-6">
          {GROUPS.map((group) => (
            <div key={group.label}>
              <div className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{group.label}</div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <a key={item.href} href={item.href}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${active(item.href)
                      ? 'bg-brand text-white shadow-sm'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'}`}>
                    <span className="w-5 text-center">{item.icon}</span>{item.label}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-slate-200/70 pt-4 dark:border-slate-800">
          <div className="px-3 text-sm font-medium truncate">{user.display_name}</div>
          <div className="px-3 text-xs text-slate-400 truncate">@{user.username}</div>
          <div className="mt-3 flex gap-2">
            <a href="/account" className="btn-ghost flex-1 justify-center text-xs">个人账号</a>
            <button onClick={logout} className="btn-ghost flex-1 justify-center text-xs">退出</button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-white/85 backdrop-blur lg:hidden dark:border-slate-800 dark:bg-slate-950/85">
          <div className="flex items-center gap-3 px-4 py-3">
            <span className="font-bold"><span className="text-brand">◆</span> Admin</span>
            <a href="/" className="ml-auto text-xs text-slate-500">前台</a>
            <a href="/account" className="text-xs text-slate-500">个人账号</a>
            <button onClick={logout} className="text-xs text-slate-500">退出</button>
          </div>
          <nav className="flex gap-2 overflow-x-auto px-4 pb-3">
            {links.map((item) => (
              <a key={item.href} href={item.href}
                className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium ${active(item.href)
                  ? 'bg-brand text-white' : 'bg-slate-100 dark:bg-slate-900'}`}>
                {item.label}
              </a>
            ))}
          </nav>
        </header>
        <main className="mx-auto max-w-7xl px-4 py-7 sm:px-6 lg:px-8 lg:py-9">{children}</main>
      </div>
    </div>
  );
}
