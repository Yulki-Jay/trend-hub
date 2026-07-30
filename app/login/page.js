'use client';
import { useEffect, useState } from 'react';

export default function UserLogin() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [config, setConfig] = useState({ siteName: 'TrendHub', registrationEnabled: true });

  useEffect(() => {
    fetch('/api/config').then((r) => r.json()).then((value) => {
      setConfig(value);
      if (!value.registrationEnabled) setMode('login');
    });
    fetch('/api/auth/me', { cache: 'no-store', credentials: 'same-origin' })
      .then((response) => response.json())
      .then((auth) => {
        if (!auth.user) return;
        const requested = new URLSearchParams(window.location.search).get('next');
        const safeNext = requested?.startsWith('/') && !requested.startsWith('//') ? requested : '';
        if (auth.user.must_change_password) window.location.replace('/account?security=required');
        else if (safeNext.startsWith('/admin') && !auth.isAdmin) window.location.replace('/access-denied');
        else window.location.replace(safeNext || (auth.isAdmin ? '/admin' : '/'));
      }).catch(() => {});
  }, []);

  const submit = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: mode === 'login' ? email : undefined,
        username,
        email,
        password,
        display_name: displayName,
      }),
    });
    const data = await res.json().catch(() => ({ error: '服务暂时不可用，请稍后重试' }));
    setBusy(false);
    if (!res.ok) return setError(data.error || '操作失败');
    const requested = new URLSearchParams(window.location.search).get('next');
    let destination = requested?.startsWith('/') && !requested.startsWith('//')
      ? requested
      : data.user?.role === 'admin' ? '/admin' : '/';
    if (data.user?.must_change_password) destination = '/account?security=required';
    else if (destination.startsWith('/admin') && data.user?.role !== 'admin') destination = '/access-denied';
    window.location.replace(destination);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-sm">
        <a href="/" className="text-sm text-slate-400 hover:text-brand">← 返回首页</a>
        <h1 className="mt-5 text-2xl font-bold">{mode === 'login' ? `登录 ${config.siteName}` : '创建账号'}</h1>
        <p className="mt-1 mb-6 text-sm text-slate-500">
          登录后可以跨设备保存收藏和“不感兴趣”项目。
        </p>
        <div className="space-y-3">
          {mode === 'register' && (
            <>
              <input className="input" maxLength={32} autoComplete="username" placeholder="用户名（字母、数字、下划线或短横线）"
                value={username} onChange={(e) => setUsername(e.target.value)} />
              <input className="input" maxLength={50} placeholder="昵称" value={displayName}
                onChange={(e) => setDisplayName(e.target.value)} />
            </>
          )}
          <input className="input" type={mode === 'login' ? 'text' : 'email'} autoComplete={mode === 'login' ? 'username' : 'email'}
            placeholder={mode === 'login' ? '用户名或邮箱' : '邮箱'}
            value={email} onChange={(e) => setEmail(e.target.value)} />
          <input className="input" type="password" minLength={mode === 'register' ? 12 : undefined} maxLength={128} autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder={mode === 'login' ? '密码' : '密码（至少 12 位）'} value={password}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <button className="btn mt-5 w-full justify-center" disabled={busy} onClick={submit}>
          {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
        {config.registrationEnabled && <button className="mt-4 w-full text-sm text-slate-500 hover:text-brand" onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError('');
        }}>
          {mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录'}
        </button>}
      </div>
    </div>
  );
}
