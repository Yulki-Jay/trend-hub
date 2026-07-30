'use client';
import { useEffect, useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { useFlash } from '../hooks';
import { adminFetch } from '../api';

const EMPTY_USER = { username: '', display_name: '', email: '', password: '', admin_password: '', role: 'user', disabled: false };

export default function UsersAdmin() {
  const [data, setData] = useState(null);
  const [filters, setFilters] = useState({ q: '', role: '', status: '' });
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const { message, flash } = useFlash();

  const load = async (nextPage = page) => {
    const params = new URLSearchParams({ ...filters, page: String(nextPage), pageSize: '20' });
    const response = await adminFetch('/api/admin/users?' + params);
    const result = await response.json();
    setData(result);
  };
  useEffect(() => {
    const timer = setTimeout(() => { setPage(1); load(1); }, 250);
    return () => clearTimeout(timer);
  }, [filters.q, filters.role, filters.status]);
  if (!data) return <Loading />;

  const submit = async (form) => {
    setBusy(true);
    const editing = !!modal?.user;
    const response = await adminFetch('/api/admin/users', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing
        ? { id: modal.user.id, username: form.username, display_name: form.display_name, email: form.email, role: form.role, disabled: form.disabled, new_password: form.password, admin_password: form.admin_password }
        : form),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return flash(result.error || '保存失败');
    setModal(null);
    load();
    flash(editing ? '用户资料已更新' : '用户已创建');
  };

  const remove = async (user, adminPassword) => {
    if (!window.confirm(`确定永久删除用户 @${user.username}？\n\n该操作无法撤销，用户的会话、收藏和屏蔽记录也会一并删除。`)) return;
    setBusy(true);
    const response = await adminFetch('/api/admin/users', {
      method: 'DELETE',
      body: JSON.stringify({ id: user.id, admin_password: adminPassword }),
    });
    const result = await response.json();
    setBusy(false);
    if (!response.ok) return flash(result.error || '删除失败');
    setModal(null);
    load();
    flash('用户已永久删除');
  };

  return (
    <>
      <PageHeader eyebrow="系统运营" title="用户管理" desc="主动创建用户、编辑身份资料、分配角色、停用账号和重置密码。"
        actions={<button className="btn" onClick={() => setModal({ user: null })}>＋ 添加用户</button>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-4">
        {[
          ['注册用户', data.summary.total], ['有效用户', data.summary.active],
          ['管理员', data.summary.admins], ['已停用', data.summary.disabled],
        ].map(([label, value]) => (
          <div key={label} className="card p-5"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold">{value || 0}</div></div>
        ))}
      </div>

      <Panel title="账号列表" desc="用户名和邮箱全局唯一；当前账号请前往个人账号页面修改。">
        <div className="mb-5 grid gap-3 sm:grid-cols-[1fr_160px_160px]">
          <input className="input" placeholder="搜索用户名、昵称或邮箱" value={filters.q} onChange={(e) => setFilters({ ...filters, q: e.target.value })} />
          <select className="input" value={filters.role} onChange={(e) => setFilters({ ...filters, role: e.target.value })}>
            <option value="">全部角色</option><option value="user">普通用户</option><option value="admin">管理员</option>
          </select>
          <select className="input" value={filters.status} onChange={(e) => setFilters({ ...filters, status: e.target.value })}>
            <option value="">全部状态</option><option value="active">正常</option><option value="disabled">已停用</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[940px] text-left text-sm">
            <thead className="text-xs text-slate-400"><tr><th className="pb-3 font-medium">用户</th><th className="pb-3 font-medium">邮箱</th><th className="pb-3 font-medium">角色</th><th className="pb-3 font-medium">收藏</th><th className="pb-3 font-medium">最近登录</th><th className="pb-3 font-medium">状态</th><th className="pb-3 font-medium text-right">操作</th></tr></thead>
            <tbody>
              {data.items.map((user) => {
                const self = user.id === data.currentUserId;
                return (
                  <tr key={user.id} className={`border-t border-slate-100 dark:border-slate-800 ${user.disabled ? 'opacity-55' : ''}`}>
                    <td className="py-4 pr-4"><div className="font-medium">{user.display_name} {self && <span className="ml-1 text-[10px] text-brand">当前账号</span>}</div><div className="text-xs text-slate-400">@{user.username}</div></td>
                    <td className="py-4 pr-4 text-slate-500">{user.email}</td>
                    <td className="py-4 pr-4"><span className={`rounded-full px-2 py-1 text-[11px] ${user.role === 'admin' ? 'bg-violet-500/10 text-violet-600' : 'bg-slate-100 text-slate-500 dark:bg-slate-800'}`}>{user.role === 'admin' ? '管理员' : '普通用户'}</span></td>
                    <td className="py-4 pr-4">{user.favorite_count}</td>
                    <td className="py-4 pr-4 text-xs text-slate-400">{user.last_login_at || '从未登录'}</td>
                    <td className="py-4 pr-4"><span className={user.disabled ? 'text-slate-400' : 'text-emerald-500'}>{user.disabled ? '已停用' : '正常'}</span></td>
                    <td className="py-4 text-right">
                      {self ? <a href="/account" className="text-xs text-brand">个人账号</a> : <button className="text-xs text-brand" onClick={() => setModal({ user })}>管理</button>}
                    </td>
                  </tr>
                );
              })}
              {!data.items.length && <tr><td colSpan="7" className="py-16 text-center text-slate-400">没有符合条件的用户</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex items-center justify-between text-xs text-slate-400">
          <span>共 {data.pagination.total} 个用户</span>
          <div className="flex items-center gap-2"><button className="btn-ghost py-1 text-xs" disabled={page <= 1} onClick={() => { const next = page - 1; setPage(next); load(next); }}>上一页</button><span>{page} / {data.pagination.pages}</span><button className="btn-ghost py-1 text-xs" disabled={page >= data.pagination.pages} onClick={() => { const next = page + 1; setPage(next); load(next); }}>下一页</button></div>
        </div>
      </Panel>

      {modal && <UserModal user={modal.user} busy={busy} onClose={() => setModal(null)} onSubmit={submit} onDelete={remove} />}
      <Toast message={message} />
    </>
  );
}

function UserModal({ user, busy, onClose, onSubmit, onDelete }) {
  const [form, setForm] = useState(user ? {
    username: user.username, display_name: user.display_name, email: user.email,
    password: '', admin_password: '', role: user.role, disabled: !!user.disabled,
  } : EMPTY_USER);
  const anotherAdmin = user?.role === 'admin';
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="card max-h-[90vh] w-full max-w-lg overflow-y-auto p-6 shadow-2xl">
        <div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">{user ? '编辑用户' : '添加用户'}</h2><p className="mt-1 text-xs text-slate-400">用户名和邮箱在全站范围内不可重复。</p></div><button className="text-slate-400" onClick={onClose}>✕</button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="block"><span className="text-sm">用户名</span><input className="input mt-1" disabled={anotherAdmin} value={form.username} onChange={(e) => set('username', e.target.value)} /></label>
          <label className="block"><span className="text-sm">昵称</span><input className="input mt-1" disabled={anotherAdmin} value={form.display_name} onChange={(e) => set('display_name', e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className="text-sm">邮箱</span><input className="input mt-1" disabled={anotherAdmin} type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></label>
          <label className="block sm:col-span-2"><span className="text-sm">{user ? '重置密码（至少 12 位，留空不修改）' : '初始密码（至少 12 位）'}</span><input className="input mt-1" disabled={anotherAdmin} minLength={12} maxLength={128} autoComplete="new-password" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} />{user && !anotherAdmin && <span className="mt-1 block text-xs text-amber-600">重置后会退出该用户的所有设备，并要求下次登录立即修改密码。</span>}</label>
          <label className="block"><span className="text-sm">角色</span><select className="input mt-1" value={form.role} onChange={(e) => set('role', e.target.value)}><option value="user">普通用户</option><option value="admin">管理员</option></select></label>
          <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={form.disabled} onChange={(e) => set('disabled', e.target.checked)} />停用账号</label>
          {(user || form.role === 'admin') && <label className="block sm:col-span-2"><span className="text-sm font-medium">你的管理员当前密码</span><input className="input mt-1" type="password" autoComplete="current-password" value={form.admin_password} onChange={(e) => set('admin_password', e.target.value)} /><span className="mt-1 block text-xs text-slate-400">敏感账号操作需要再次验证管理员身份；修改成功后目标用户会退出所有设备。</span></label>}
        </div>
        <div className="mt-6 flex items-center justify-between gap-3">
          <div>{user?.disabled && <button className="text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-40" disabled={busy} onClick={() => onDelete(user, form.admin_password)}>永久删除</button>}</div>
          <div className="flex gap-2"><button className="btn-ghost" disabled={busy} onClick={onClose}>取消</button><button className="btn" disabled={busy} onClick={() => onSubmit(form)}>{busy ? '处理中…' : user ? '保存修改' : '创建用户'}</button></div>
        </div>
      </div>
    </div>
  );
}
