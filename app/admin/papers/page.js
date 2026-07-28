'use client';
import { useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { runAdminAction, useAdminSettings, useFlash } from '../hooks';

export default function PapersAdmin() {
  const { settings, setSettings, save } = useAdminSettings();
  const { message, flash } = useFlash();
  const [busy, setBusy] = useState('');
  if (!settings) return <Loading />;
  const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }));
  const savePage = async () => {
    setBusy('save');
    try {
      await save({
        paper_source_enabled: settings.paper_source_enabled || '0',
        arxiv_categories: settings.arxiv_categories || '',
        semantic_scholar_key: settings.semantic_scholar_key || '',
      });
      flash('论文配置已保存');
    } catch (e) { flash('失败：' + e.message); }
    setBusy('');
  };
  const fetchPapers = async () => {
    setBusy('fetch');
    try { const result = await runAdminAction({ action: 'fetch-papers' }); flash(`论文抓取完成：${result.paperCount} 条`); }
    catch (e) { flash('失败：' + e.message); }
    setBusy('');
  };

  return (
    <>
      <PageHeader eyebrow="内容运营" title="论文运营" desc="配置论文数据来源、研究分类和引用数据增强。"
        actions={<button className="btn" disabled={!!busy} onClick={fetchPapers}>{busy === 'fetch' ? '抓取中…' : '⟳ 立即抓取论文'}</button>} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="数据源状态" desc="关闭后定时任务将跳过论文抓取。">
          <label className="flex items-center justify-between rounded-xl border border-slate-200/70 p-4 dark:border-slate-800">
            <div><div className="text-sm font-medium">启用论文数据源</div><div className="mt-1 text-xs text-slate-400">arXiv 最新、高引用榜和 Papers with Code</div></div>
            <input type="checkbox" className="h-4 w-4" checked={settings.paper_source_enabled === '1'} onChange={(e) => set('paper_source_enabled', e.target.checked ? '1' : '0')} />
          </label>
        </Panel>
        <Panel title="Semantic Scholar" desc="可选 API Key，用于提高引用数据抓取配额。">
          <input className="input" type="password" placeholder="留空也可运行"
            value={settings.semantic_scholar_key || ''} onChange={(e) => set('semantic_scholar_key', e.target.value)} />
          <p className="mt-2 text-xs text-slate-400">密钥只保存在服务器数据库，接口返回时会掩码。</p>
        </Panel>
      </div>
      <Panel className="mt-6" title="arXiv 分类" desc="使用 arXiv 分类代码并以逗号分隔。">
        <input className="input" placeholder="cs.AI, cs.CL, cs.CV, cs.LG"
          value={settings.arxiv_categories || ''} onChange={(e) => set('arxiv_categories', e.target.value)} />
        <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-500">
          {['cs.AI 人工智能', 'cs.CL 计算语言', 'cs.CV 计算机视觉', 'cs.LG 机器学习', 'cs.DC 分布式系统'].map((item) => <span key={item} className="rounded-full bg-slate-100 px-3 py-1 dark:bg-slate-800">{item}</span>)}
        </div>
      </Panel>
      <div className="mt-6 flex justify-end"><button className="btn" disabled={busy === 'save'} onClick={savePage}>{busy === 'save' ? '保存中…' : '保存论文配置'}</button></div>
      <Toast message={message} />
    </>
  );
}
