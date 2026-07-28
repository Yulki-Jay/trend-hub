'use client';
import { useEffect, useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { useFlash } from '../hooks';

export default function AdminAccount() {
  const [account, setAccount] = useState(null);
  const [passwords, setPasswords] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);
  const { message, flash } = useFlash();
  useEffect(() => {
    fetch('/api/auth/me').then((r) => r.json()).then((data) => setAccount({
      username: data.user.username, email: data.user.email, display_name: data.user.display_name,
    }));
  }, []);
  if (!account) return <Loading />;

  const save = async () => {
    setBusy(true);
    const response = await fetch('/api/user/account', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...account, current_password: passwords.current, new_password: passwords.next,
      }),
    });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return flash('失败：' + (data.error || '保存失败'));
    setAccount({ username: data.user.username, email: data.user.email, display_name: data.user.display_name });
    setPasswords({ current: '', next: '' });
    flash('管理员账号已更新');
  };

  return (
    <>
      <PageHeader eyebrow="账号" title="管理员账号" desc="管理当前管理员的登录名、展示信息和密码。" />
      <div className="grid gap-6 xl:grid-cols-[1fr_0.85fr]">
        <Panel title="基本资料">
          <div className="space-y-4">
            <label className="block"><span className="text-sm font-medium">用户名</span><input className="input mt-2" value={account.username} onChange={(e) => setAccount({ ...account, username: e.target.value })} /></label>
            <label className="block"><span className="text-sm font-medium">昵称</span><input className="input mt-2" value={account.display_name} onChange={(e) => setAccount({ ...account, display_name: e.target.value })} /></label>
            <label className="block"><span className="text-sm font-medium">邮箱</span><input className="input mt-2" type="email" value={account.email} onChange={(e) => setAccount({ ...account, email: e.target.value })} /></label>
          </div>
        </Panel>
        <Panel title="修改密码" desc="修改后其他设备上的管理员会话会自动失效。">
          <div className="space-y-4">
            <label className="block"><span className="text-sm font-medium">当前密码</span><input className="input mt-2" type="password" autoComplete="current-password" value={passwords.current} onChange={(e) => setPasswords({ ...passwords, current: e.target.value })} /></label>
            <label className="block"><span className="text-sm font-medium">新密码</span><input className="input mt-2" type="password" autoComplete="new-password" placeholder="至少 8 位；留空不修改" value={passwords.next} onChange={(e) => setPasswords({ ...passwords, next: e.target.value })} /></label>
          </div>
          <div className="mt-5 rounded-xl bg-amber-500/10 p-4 text-xs text-amber-700 dark:text-amber-300">若仍在使用默认密码 admin123，请立即修改。</div>
        </Panel>
      </div>
      <div className="mt-6 flex justify-end"><button className="btn" disabled={busy} onClick={save}>{busy ? '保存中…' : '保存管理员账号'}</button></div>
      <Toast message={message} />
    </>
  );
}
