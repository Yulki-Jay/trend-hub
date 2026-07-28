'use client';
import { useEffect, useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { useFlash } from '../hooks';

export default function UsersAdmin() {
  const [data, setData] = useState(null);
  const { message, flash } = useFlash();
  const load = () => fetch('/api/admin/users').then((r) => r.json()).then(setData);
  useEffect(() => { load(); }, []);
  if (!data) return <Loading />;

  const update = async (user, patch) => {
    const response = await fetch('/api/admin/users', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: user.id, ...patch }),
    });
    const result = await response.json();
    if (!response.ok) return flash(result.error || '更新失败');
    load(); flash('用户状态已更新');
  };
  const active = data.items.filter((user) => !user.disabled).length;
  const admins = data.items.filter((user) => user.role === 'admin' && !user.disabled).length;

  return (
    <>
      <PageHeader eyebrow="系统运营" title="用户管理" desc="查看平台注册用户，分配管理员角色或停用异常账号。" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {[['注册用户', data.items.length], ['有效用户', active], ['管理员', admins]].map(([label, value]) => (
          <div key={label} className="card p-5"><div className="text-sm text-slate-500">{label}</div><div className="mt-2 text-3xl font-bold">{value}</div></div>
        ))}
      </div>
      <Panel title="账号列表" desc="当前管理员不能在此页降级或停用，请在管理员账号页修改自己的资料。">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-sm">
            <thead className="text-xs text-slate-400"><tr><th className="pb-3 font-medium">用户</th><th className="pb-3 font-medium">邮箱</th><th className="pb-3 font-medium">收藏</th><th className="pb-3 font-medium">注册时间</th><th className="pb-3 font-medium">角色</th><th className="pb-3 font-medium">状态</th></tr></thead>
            <tbody>
              {data.items.map((user) => {
                const self = user.id === data.currentUserId;
                return (
                  <tr key={user.id} className={`border-t border-slate-100 dark:border-slate-800 ${user.disabled ? 'opacity-55' : ''}`}>
                    <td className="py-4 pr-4"><div className="font-medium">{user.display_name} {self && <span className="text-[10px] text-brand">当前账号</span>}</div><div className="text-xs text-slate-400">@{user.username}</div></td>
                    <td className="py-4 pr-4 text-slate-500">{user.email}</td>
                    <td className="py-4 pr-4">{user.favorite_count}</td>
                    <td className="py-4 pr-4 text-xs text-slate-400">{user.created_at}</td>
                    <td className="py-4 pr-4">
                      <select className="input w-auto py-1.5" disabled={self} value={user.role}
                        onChange={(e) => update(user, { role: e.target.value })}>
                        <option value="user">普通用户</option><option value="admin">管理员</option>
                      </select>
                    </td>
                    <td className="py-4">
                      <button disabled={self} onClick={() => update(user, { disabled: !user.disabled })}
                        className={`rounded-full px-3 py-1 text-xs font-medium ${user.disabled ? 'bg-slate-200 text-slate-500 dark:bg-slate-800' : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'}`}>
                        {user.disabled ? '已停用 · 点击启用' : '正常 · 点击停用'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
      <Toast message={message} />
    </>
  );
}
