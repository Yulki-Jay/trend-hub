'use client';
import { useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { useAdminSettings, useFlash } from '../hooks';

export default function SystemAdmin() {
  const { settings, setSettings, save } = useAdminSettings();
  const [busy, setBusy] = useState(false);
  const { message, flash } = useFlash();
  if (!settings) return <Loading />;
  const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const savePage = async () => {
    setBusy(true);
    try {
      await save({
        site_name: settings.site_name || 'TrendHub',
        site_description: settings.site_description || '',
        registration_enabled: settings.registration_enabled || '0',
      });
      flash('系统策略已保存');
    } catch (e) { flash('失败：' + e.message); }
    setBusy(false);
  };
  return (
    <>
      <PageHeader eyebrow="系统运营" title="系统策略" desc="管理站点展示信息和用户注册策略。" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="站点信息" desc="这些内容会显示在前台导航和首页介绍区域。">
          <div className="space-y-4">
            <label className="block"><span className="text-sm">站点名称</span><input className="input mt-1" value={settings.site_name || ''} onChange={(e) => set('site_name', e.target.value)} /></label>
            <label className="block"><span className="text-sm">站点介绍</span><textarea className="input mt-1 min-h-28" value={settings.site_description || ''} onChange={(e) => set('site_description', e.target.value)} /></label>
          </div>
        </Panel>
        <Panel title="注册策略" desc="关闭后登录页不再提供注册入口，已有用户不受影响。">
          <label className="flex items-center justify-between rounded-xl border border-slate-200/70 p-4 dark:border-slate-800">
            <div><div className="text-sm font-medium">开放公开注册</div><div className="mt-1 text-xs text-slate-400">管理员仍可在用户管理中主动创建账号</div></div>
            <input type="checkbox" checked={settings.registration_enabled === '1'} onChange={(e) => set('registration_enabled', e.target.checked ? '1' : '0')} />
          </label>
          <div className="mt-5 rounded-xl bg-sky-500/10 p-4 text-xs text-sky-700 dark:text-sky-300">若用于团队内部部署，建议关闭公开注册并由管理员统一创建用户。</div>
        </Panel>
      </div>
      <div className="mt-6 flex justify-end"><button className="btn" disabled={busy} onClick={savePage}>{busy ? '保存中…' : '保存系统策略'}</button></div>
      <Toast message={message} />
    </>
  );
}
