'use client';
import { useEffect, useState } from 'react';

function Login({ onOk }) {
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const submit = async () => {
    const r = await fetch('/api/admin/login', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pw }),
    });
    if (r.ok) onOk(); else setErr('密码错误');
  };
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="card p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">TrendHub 管理后台</h1>
        <p className="text-sm text-slate-500 mb-6">请输入管理员密码</p>
        <input type="password" className="input mb-3" placeholder="密码"
          value={pw} onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()} />
        {err && <p className="text-red-500 text-sm mb-3">{err}</p>}
        <button className="btn w-full justify-center" onClick={submit}>登录</button>
      </div>
    </div>
  );
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm shadow-lg">
      {msg}
    </div>
  );
}

function Section({ title, children, desc }) {
  return (
    <div className="card p-6">
      <h2 className="font-semibold text-lg">{title}</h2>
      {desc && <p className="text-sm text-slate-500 mb-4">{desc}</p>}
      <div className={desc ? '' : 'mt-4'}>{children}</div>
    </div>
  );
}

export default function Admin() {
  const [authed, setAuthed] = useState(null);
  const [settings, setSettings] = useState(null);
  const [sources, setSources] = useState([]);
  const [recipients, setRecipients] = useState([]);
  const [logs, setLogs] = useState([]);
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState('');
  const [newSource, setNewSource] = useState({ name: '', url: '', category: 'tech' });
  const [newEmail, setNewEmail] = useState('');
  const [testEmail, setTestEmail] = useState('');

  const flash = (m) => { setToast(m); setTimeout(() => setToast(''), 2500); };

  const loadAll = async () => {
    const s = await fetch('/api/admin/settings');
    if (s.status === 401) { setAuthed(false); return; }
    setAuthed(true);
    setSettings(await s.json());
    setSources((await (await fetch('/api/admin/sources')).json()).items);
    setRecipients((await (await fetch('/api/admin/recipients')).json()).items);
    setLogs((await (await fetch('/api/admin/actions')).json()).logs);
  };

  useEffect(() => { loadAll(); }, []);

  const saveSettings = async () => {
    setBusy('save');
    await fetch('/api/admin/settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    setBusy(''); flash('配置已保存');
    loadAll();
  };

  const action = async (payload, label) => {
    setBusy(label);
    const r = await fetch('/api/admin/actions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await r.json();
    setBusy('');
    if (d.ok) {
      if (payload.action === 'fetch') flash(`抓取完成：仓库 ${d.repoCount} · 开发者 ${d.devCount} · 新闻 ${d.newsCount} · 论文 ${d.paperCount}`);
      else if (payload.action === 'verify-smtp') flash('SMTP 连接成功');
      else flash(`已发送 ${d.sent} 封`);
      loadAll();
    } else flash('失败：' + (d.error || '未知错误'));
  };

  const addSource = async () => {
    if (!newSource.name || !newSource.url) return flash('请填写名称和地址');
    const r = await fetch('/api/admin/sources', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newSource),
    });
    if (r.ok) { setNewSource({ name: '', url: '', category: 'tech' }); loadAll(); flash('已添加'); }
    else flash('添加失败');
  };
  const toggleSource = async (s) => {
    await fetch('/api/admin/sources', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, enabled: !s.enabled }) });
    loadAll();
  };
  const delSource = async (id) => {
    await fetch('/api/admin/sources', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadAll();
  };

  const addEmail = async () => {
    const r = await fetch('/api/admin/recipients', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail }),
    });
    const d = await r.json();
    if (r.ok) { setNewEmail(''); loadAll(); flash('已添加'); } else flash(d.error);
  };
  const delEmail = async (id) => {
    await fetch('/api/admin/recipients', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    loadAll();
  };
  const logout = async () => { await fetch('/api/admin/login', { method: 'DELETE' }); setAuthed(false); };

  if (authed === null) return <div className="min-h-screen flex items-center justify-center text-slate-400">加载中…</div>;
  if (!authed) return <Login onOk={loadAll} />;
  if (!settings) return null;

  const set = (k, v) => setSettings((s) => ({ ...s, [k]: v }));
  const CATS = [['tech', '科技'], ['economy', '经济'], ['politics', '政治']];

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 backdrop-blur bg-white/70 dark:bg-slate-950/70 border-b border-slate-200/60 dark:border-slate-800">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="font-bold flex items-center gap-2"><span className="text-brand">◆</span> 管理后台</div>
          <div className="ml-auto flex gap-2">
            <a href="/" className="btn-ghost">前台</a>
            <button className="btn-ghost" onClick={logout}>退出</button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-6">
        <div className="flex flex-wrap gap-3">
          <button className="btn" disabled={busy === 'fetch'} onClick={() => action({ action: 'fetch' }, 'fetch')}>
            {busy === 'fetch' ? '抓取中…' : '⟳ 立即抓取'}
          </button>
          <button className="btn-ghost" disabled={busy === 'send'} onClick={() => action({ action: 'send' }, 'send')}>
            ✉ 立即推送汇总
          </button>
          <button className="btn-ghost" disabled={busy === 'verify-smtp'} onClick={() => action({ action: 'verify-smtp' }, 'verify-smtp')}>
            ✓ 测试 SMTP 连接
          </button>
        </div>

        <Section title="定时任务" desc="使用标准 cron 表达式（5 段：分 时 日 月 周），保存后立即生效。">
          <div className="grid sm:grid-cols-2 gap-4">
            <label className="block">
              <span className="text-sm text-slate-500">抓取频率</span>
              <input className="input mt-1" value={settings.cron_fetch} onChange={(e) => set('cron_fetch', e.target.value)} />
              <span className="text-xs text-slate-400">默认 0 */2 * * *（每 2 小时）</span>
            </label>
            <label className="block">
              <span className="text-sm text-slate-500">邮件推送时间</span>
              <input className="input mt-1" value={settings.cron_email} onChange={(e) => set('cron_email', e.target.value)} />
              <span className="text-xs text-slate-400">默认 0 8 * * *（每日 08:00）</span>
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={settings.email_enabled === '1'}
                onChange={(e) => set('email_enabled', e.target.checked ? '1' : '0')} />
              <span className="text-sm">启用每日邮件自动推送</span>
            </label>
            <label className="block">
              <span className="text-sm text-slate-500">邮件包含 GitHub 项目数</span>
              <input className="input mt-1" type="number" value={settings.top_repos} onChange={(e) => set('top_repos', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm text-slate-500">邮件包含新闻数</span>
              <input className="input mt-1" type="number" value={settings.top_news} onChange={(e) => set('top_news', e.target.value)} />
            </label>
            <label className="block">
              <span className="text-sm text-slate-500">邮件包含论文数</span>
              <input className="input mt-1" type="number" value={settings.top_papers} onChange={(e) => set('top_papers', e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-slate-500">GitHub 语言过滤（逗号分隔，留空=全部）</span>
              <input className="input mt-1" placeholder="javascript, python, go"
                value={settings.github_languages} onChange={(e) => set('github_languages', e.target.value)} />
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-slate-500">arXiv 论文分类（逗号分隔）</span>
              <input className="input mt-1" placeholder="cs.AI, cs.CL, cs.CV, cs.LG"
                value={settings.arxiv_categories} onChange={(e) => set('arxiv_categories', e.target.value)} />
              <span className="text-xs text-slate-400">常用：cs.AI 人工智能 · cs.CL 计算语言 · cs.CV 视觉 · cs.LG 机器学习 · cs.DC 分布式</span>
            </label>
            <label className="flex items-center gap-2 sm:col-span-2">
              <input type="checkbox" checked={settings.paper_source_enabled === '1'}
                onChange={(e) => set('paper_source_enabled', e.target.checked ? '1' : '0')} />
              <span className="text-sm">启用论文抓取（arXiv 最新 + 高引用榜 + Papers with Code）</span>
            </label>
            <label className="block sm:col-span-2">
              <span className="text-sm text-slate-500">Semantic Scholar API Key（可选）</span>
              <input className="input mt-1" type="password" placeholder="留空亦可，填入可提升引用数抓取限速"
                value={settings.semantic_scholar_key || ''} onChange={(e) => set('semantic_scholar_key', e.target.value)} />
              <span className="text-xs text-slate-400">免费申请：semanticscholar.org/product/api</span>
            </label>
          </div>
        </Section>

        <Section title="SMTP 邮件配置" desc="用于发送每日汇总邮件（如 QQ/Gmail/企业邮箱）。">
          <div className="grid sm:grid-cols-2 gap-4">
            <input className="input" placeholder="SMTP 主机 如 smtp.qq.com" value={settings.smtp_host} onChange={(e) => set('smtp_host', e.target.value)} />
            <input className="input" placeholder="端口 如 465" value={settings.smtp_port} onChange={(e) => set('smtp_port', e.target.value)} />
            <input className="input" placeholder="用户名/邮箱" value={settings.smtp_user} onChange={(e) => set('smtp_user', e.target.value)} />
            <input className="input" type="password" placeholder="密码/授权码" value={settings.smtp_pass} onChange={(e) => set('smtp_pass', e.target.value)} />
            <input className="input sm:col-span-2" placeholder="发件人 如 TrendHub <you@qq.com>" value={settings.smtp_from} onChange={(e) => set('smtp_from', e.target.value)} />
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={settings.smtp_secure === '1'} onChange={(e) => set('smtp_secure', e.target.checked ? '1' : '0')} />
              <span className="text-sm">使用 SSL/TLS（465 端口勾选）</span>
            </label>
          </div>
          <div className="mt-4 flex gap-2 items-center">
            <input className="input" placeholder="发送测试邮件到…" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
            <button className="btn-ghost whitespace-nowrap" onClick={() => action({ action: 'test-email', email: testEmail }, 'test')}>发送测试</button>
          </div>
        </Section>

        <Section title="邮件收件人">
          <div className="flex gap-2 mb-4">
            <input className="input" placeholder="添加收件邮箱" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            <button className="btn" onClick={addEmail}>添加</button>
          </div>
          <ul className="space-y-2">
            {recipients.map((r) => (
              <li key={r.id} className="flex items-center gap-3 text-sm">
                <span className={r.enabled ? '' : 'line-through text-slate-400'}>{r.email}</span>
                <button className="ml-auto text-red-500 text-xs" onClick={() => delEmail(r.id)}>删除</button>
              </li>
            ))}
            {!recipients.length && <li className="text-sm text-slate-400">暂无收件人</li>}
          </ul>
        </Section>

        <Section title="新闻数据源 (RSS)">
          <div className="grid sm:grid-cols-4 gap-2 mb-4">
            <input className="input" placeholder="名称" value={newSource.name} onChange={(e) => setNewSource({ ...newSource, name: e.target.value })} />
            <input className="input sm:col-span-2" placeholder="RSS 地址" value={newSource.url} onChange={(e) => setNewSource({ ...newSource, url: e.target.value })} />
            <div className="flex gap-2">
              <select className="input" value={newSource.category} onChange={(e) => setNewSource({ ...newSource, category: e.target.value })}>
                {CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
              <button className="btn" onClick={addSource}>加</button>
            </div>
          </div>
          <div className="divide-y divide-slate-200/60 dark:divide-slate-800">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 py-2 text-sm">
                <input type="checkbox" checked={!!s.enabled} onChange={() => toggleSource(s)} />
                <span className="font-medium">{s.name}</span>
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand/10 text-brand">
                  {CATS.find(([v]) => v === s.category)?.[1] || s.category}
                </span>
                <span className="text-xs text-slate-400 truncate max-w-[240px]">{s.url}</span>
                <button className="ml-auto text-red-500 text-xs" onClick={() => delSource(s.id)}>删除</button>
              </div>
            ))}
          </div>
        </Section>

        <Section title="安全" desc="修改后台登录密码（留空则不变）。">
          <input className="input max-w-xs" type="password" placeholder="新密码"
            value={settings.admin_password === '••••••••' ? '' : settings.admin_password}
            onChange={(e) => set('admin_password', e.target.value)} />
        </Section>

        <div className="flex justify-end">
          <button className="btn" disabled={busy === 'save'} onClick={saveSettings}>
            {busy === 'save' ? '保存中…' : '保存全部配置'}
          </button>
        </div>

        <Section title="任务运行日志">
          <div className="max-h-80 overflow-auto text-sm">
            <table className="w-full">
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 pr-3 text-slate-400 whitespace-nowrap">{l.created_at}</td>
                    <td className="pr-3">{l.job}</td>
                    <td className="pr-3">
                      <span className={l.status === 'success' ? 'text-emerald-500' : 'text-red-500'}>{l.status}</span>
                    </td>
                    <td className="text-slate-500">{l.message}</td>
                  </tr>
                ))}
                {!logs.length && <tr><td className="py-3 text-slate-400">暂无日志</td></tr>}
              </tbody>
            </table>
          </div>
        </Section>
      </main>
      <Toast msg={toast} />
    </div>
  );
}
