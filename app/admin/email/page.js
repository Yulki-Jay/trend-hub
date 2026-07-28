'use client';
import { useEffect, useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { runAdminAction, useAdminSettings, useFlash } from '../hooks';

export default function EmailAdmin() {
  const { settings, setSettings, save } = useAdminSettings();
  const [recipients, setRecipients] = useState(null);
  const [newEmail, setNewEmail] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [busy, setBusy] = useState('');
  const { message, flash } = useFlash();
  const loadRecipients = () => fetch('/api/admin/recipients').then((r) => r.json()).then((d) => setRecipients(d.items || []));
  useEffect(() => { loadRecipients(); }, []);
  if (!settings || !recipients) return <Loading />;
  const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  const savePage = async () => {
    setBusy('save');
    try {
      await save({
        email_enabled: settings.email_enabled || '0',
        smtp_host: settings.smtp_host || '', smtp_port: settings.smtp_port || '465',
        smtp_secure: settings.smtp_secure || '1', smtp_user: settings.smtp_user || '',
        smtp_pass: settings.smtp_pass || '', smtp_from: settings.smtp_from || '',
        top_repos: settings.top_repos || '10', top_news: settings.top_news || '15', top_papers: settings.top_papers || '8',
      });
      flash('邮件配置已保存');
    } catch (e) { flash('失败：' + e.message); }
    setBusy('');
  };
  const action = async (payload, label) => {
    setBusy(label);
    try { const result = await runAdminAction(payload); flash(payload.action === 'verify-smtp' ? 'SMTP 连接成功' : `已发送 ${result.sent} 封邮件`); }
    catch (e) { flash('失败：' + e.message); }
    setBusy('');
  };
  const addRecipient = async () => {
    const response = await fetch('/api/admin/recipients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: newEmail }),
    });
    const data = await response.json();
    if (!response.ok) return flash(data.error || '添加失败');
    setNewEmail(''); loadRecipients(); flash('收件人已添加');
  };
  const toggleRecipient = async (recipient) => {
    await fetch('/api/admin/recipients', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: recipient.id, enabled: !recipient.enabled }),
    });
    loadRecipients();
  };
  const removeRecipient = async (id) => {
    await fetch('/api/admin/recipients', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadRecipients(); flash('收件人已删除');
  };

  return (
    <>
      <PageHeader eyebrow="系统运营" title="邮件推送" desc="配置 SMTP、汇总内容和订阅收件人。"
        actions={<>
          <button className="btn-ghost" disabled={!!busy} onClick={() => action({ action: 'verify-smtp' }, 'verify')}>测试连接</button>
          <button className="btn" disabled={!!busy} onClick={() => action({ action: 'send' }, 'send')}>{busy === 'send' ? '发送中…' : '✉ 立即发送汇总'}</button>
        </>} />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Panel title="SMTP 配置" desc="用于发送每日汇总和测试邮件。">
          <div className="grid gap-4 sm:grid-cols-2">
            <input className="input" placeholder="SMTP 主机" value={settings.smtp_host || ''} onChange={(e) => set('smtp_host', e.target.value)} />
            <input className="input" placeholder="端口" value={settings.smtp_port || ''} onChange={(e) => set('smtp_port', e.target.value)} />
            <input className="input" placeholder="用户名/邮箱" value={settings.smtp_user || ''} onChange={(e) => set('smtp_user', e.target.value)} />
            <input className="input" type="password" placeholder="密码/授权码" value={settings.smtp_pass || ''} onChange={(e) => set('smtp_pass', e.target.value)} />
            <input className="input sm:col-span-2" placeholder="发件人 TrendHub <you@example.com>" value={settings.smtp_from || ''} onChange={(e) => set('smtp_from', e.target.value)} />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.smtp_secure === '1'} onChange={(e) => set('smtp_secure', e.target.checked ? '1' : '0')} />使用 SSL/TLS</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={settings.email_enabled === '1'} onChange={(e) => set('email_enabled', e.target.checked ? '1' : '0')} />启用自动邮件推送</label>
          </div>
        </Panel>

        <Panel title="汇总内容" desc="控制每封邮件包含的内容数量。">
          <div className="space-y-4">
            {[['top_repos', 'GitHub 项目'], ['top_news', '新闻'], ['top_papers', '论文']].map(([key, label]) => (
              <label key={key} className="flex items-center justify-between gap-4 text-sm"><span>{label}</span><input className="input w-28" type="number" min="0" max="100" value={settings[key] || '0'} onChange={(e) => set(key, e.target.value)} /></label>
            ))}
          </div>
        </Panel>
      </div>

      <Panel className="mt-6" title={`收件人 · ${recipients.filter((item) => item.enabled).length} 个启用`}>
        <div className="mb-5 flex gap-2"><input className="input" type="email" placeholder="添加收件邮箱" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} /><button className="btn" onClick={addRecipient}>添加</button></div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {recipients.map((recipient) => (
            <div key={recipient.id} className="flex items-center gap-3 py-3 text-sm">
              <input type="checkbox" checked={!!recipient.enabled} onChange={() => toggleRecipient(recipient)} />
              <span className={recipient.enabled ? '' : 'text-slate-400 line-through'}>{recipient.email}</span>
              <button className="ml-auto text-xs text-red-500" onClick={() => removeRecipient(recipient.id)}>删除</button>
            </div>
          ))}
          {!recipients.length && <div className="py-8 text-center text-sm text-slate-400">暂无收件人</div>}
        </div>
        <div className="mt-5 flex gap-2 border-t border-slate-100 pt-5 dark:border-slate-800">
          <input className="input" type="email" placeholder="发送测试邮件到…" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
          <button className="btn-ghost whitespace-nowrap" disabled={!testEmail || !!busy} onClick={() => action({ action: 'test-email', email: testEmail }, 'test')}>发送测试</button>
        </div>
      </Panel>
      <div className="mt-6 flex justify-end"><button className="btn" disabled={busy === 'save'} onClick={savePage}>{busy === 'save' ? '保存中…' : '保存邮件配置'}</button></div>
      <Toast message={message} />
    </>
  );
}
