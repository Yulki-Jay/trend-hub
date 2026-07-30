'use client';
import { useEffect, useState } from 'react';

export default function PersonalAccount() {
  const [data, setData] = useState(null);
  const [account, setAccount] = useState(null);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [usernameState, setUsernameState] = useState({ checking: false, available: true, error: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const flash = (text) => { setMessage(text); setTimeout(() => setMessage(''), 2600); };

  useEffect(() => {
    fetch('/api/user/account', { cache: 'no-store', credentials: 'same-origin' }).then(async (response) => {
      if (response.status === 401) {
        window.location.replace('/login?next=/account');
        return null;
      }
      return response.json();
    }).then((result) => {
      if (!result) return;
      setData(result);
      setAccount({ username: result.user.username, email: result.user.email, display_name: result.user.display_name });
    }).catch(() => flash('账号信息加载失败，请刷新后重试'));
  }, []);
  useEffect(() => {
    if (!account?.username) return;
    setUsernameState((state) => ({ ...state, checking: true }));
    const timer = setTimeout(async () => {
      const result = await (await fetch('/api/auth/username?value=' + encodeURIComponent(account.username))).json();
      setUsernameState({ checking: false, available: !!result.available, error: result.error || (result.available ? '' : '用户名已被使用') });
    }, 300);
    return () => clearTimeout(timer);
  }, [account?.username]);

  if (!data || !account) return <div className="min-h-screen flex items-center justify-center text-slate-400">加载中…</div>;
  const save = async () => {
    if (data.user.must_change_password && !passwords.next) return flash('首次登录必须先设置新密码');
    if (!usernameState.available) return flash(usernameState.error || '用户名不可用');
    setBusy(true);
    const response = await fetch('/api/user/account', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...account, current_password: passwords.current, new_password: passwords.next }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return flash('失败：' + (result.error || '保存失败'));
    setAccount({ username: result.user.username, email: result.user.email, display_name: result.user.display_name });
    setData((current) => ({ ...current, user: result.user }));
    setPasswords({ current: '', next: '' });
    flash('个人账号已更新');
  };
  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' });
    window.location.replace('/');
  };

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200/70 bg-white/80 dark:border-slate-800 dark:bg-slate-950/80">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
          <a href="/" className="font-bold"><span className="text-brand">◆</span> TrendHub</a>
          <span className="text-sm text-slate-400">个人账号</span>
          <div className="ml-auto flex gap-2">{data.user.role === 'admin' && <a href="/admin" className="btn-ghost">管理后台</a>}<button className="btn-ghost" onClick={logout}>退出</button></div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-9">
        {data.user.must_change_password && <div className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-5 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"><div className="font-semibold">首次登录需要更新密码</div><p className="mt-1">当前密码是临时凭据。设置新密码后才能进入管理后台或继续正常使用账号。</p></div>}
        <div className="mb-7"><div className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">Account</div><h1 className="mt-1 text-3xl font-bold">个人账号</h1><p className="mt-2 text-sm text-slate-500">管理登录信息、公开昵称和密码安全。</p></div>
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="card p-5"><div className="text-sm text-slate-500">账号角色</div><div className="mt-2 text-xl font-bold">{data.user.role === 'admin' ? '管理员' : '普通用户'}</div></div>
          <div className="card p-5"><div className="text-sm text-slate-500">收藏内容</div><div className="mt-2 text-3xl font-bold">{data.counts.favorites}</div></div>
          <div className="card p-5"><div className="text-sm text-slate-500">注册时间</div><div className="mt-2 text-sm font-medium">{data.details.created_at}</div></div>
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="card p-6"><h2 className="font-semibold">基本资料</h2><p className="mt-1 text-xs text-slate-400">修改用户名或邮箱时需要填写右侧的当前密码。</p><div className="mt-5 space-y-4">
            <label className="block"><span className="text-sm">用户名</span><input className={`input mt-1 ${!usernameState.available ? 'border-red-400' : ''}`} value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} /><span className={`mt-1 block text-xs ${usernameState.available ? 'text-emerald-500' : 'text-red-500'}`}>{usernameState.checking ? '正在检查…' : usernameState.available ? '用户名可用' : usernameState.error}</span></label>
            <label className="block"><span className="text-sm">昵称</span><input className="input mt-1" value={account.display_name} onChange={(e) => setAccount({ ...account, display_name: e.target.value })} /></label>
            <label className="block"><span className="text-sm">邮箱</span><input className="input mt-1" type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} /></label>
          </div></section>
          <section className="card p-6"><h2 className="font-semibold">修改密码</h2><p className="mt-1 text-xs text-slate-400">修改密码会退出其他设备上的登录会话。</p><div className="mt-5 space-y-4">
            <label className="block"><span className="text-sm">当前密码</span><input className="input mt-1" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} /></label>
            <label className="block"><span className="text-sm">新密码</span><input className="input mt-1" type="password" minLength={12} maxLength={128} autoComplete="new-password" placeholder="至少 12 位，留空不修改" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} /></label>
          </div></section>
        </div>
        <div className="mt-6 flex justify-end"><button className="btn" disabled={busy || usernameState.checking || !usernameState.available} onClick={save}>{busy ? '保存中…' : '保存个人账号'}</button></div>
      </main>
      {message && <div className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-slate-950 px-4 py-2.5 text-sm text-white shadow-xl">{message}</div>}
    </div>
  );
}
