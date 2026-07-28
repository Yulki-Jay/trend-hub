'use client';
import { useState } from 'react';

export default function UserLogin() {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setBusy(true);
    setError('');
    const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: mode === 'login' ? email : undefined,
        username,
        email,
        password,
        display_name: displayName,
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || '操作失败');
    const requested = new URLSearchParams(window.location.search).get('next');
    const destination = requested?.startsWith('/') && !requested.startsWith('//')
      ? requested
      : data.user?.role === 'admin' ? '/admin' : '/';
    window.location.href = destination;
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-sm">
        <a href="/" className="text-sm text-slate-400 hover:text-brand">← 返回首页</a>
        <h1 className="mt-5 text-2xl font-bold">{mode === 'login' ? '登录 TrendHub' : '创建账号'}</h1>
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
          <input className="input" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            placeholder="密码（至少 8 位）" value={password}
            onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && submit()} />
        </div>
        {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
        <button className="btn mt-5 w-full justify-center" disabled={busy} onClick={submit}>
          {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>
        <button className="mt-4 w-full text-sm text-slate-500 hover:text-brand" onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setError('');
        }}>
          {mode === 'login' ? '还没有账号？立即注册' : '已有账号？返回登录'}
        </button>
      </div>
    </div>
  );
}
