'use client';
import { useState } from 'react';
import { Loading, PageHeader, Panel, Toast } from '../components';
import { runAdminAction, useAdminSettings, useFlash } from '../hooks';

export default function GithubAdmin() {
  const { settings, setSettings, save } = useAdminSettings();
  const { message, flash } = useFlash();
  const [busy, setBusy] = useState('');
  if (!settings) return <Loading />;
  const set = (key, value) => setSettings((current) => ({ ...current, [key]: value }));

  const action = async (name) => {
    setBusy(name);
    try {
      const result = await runAdminAction({ action: name });
      flash(name === 'fetch-explore'
        ? `探索候选池已更新 ${result.exploreCount} 个项目`
        : `热榜更新完成：仓库 ${result.repoCount} · 开发者 ${result.devCount}`);
    } catch (e) { flash('失败：' + e.message); }
    setBusy('');
  };
  const savePage = async () => {
    setBusy('save');
    try {
      await save({
        github_languages: settings.github_languages || '',
        explore_batch_size: settings.explore_batch_size || '18',
      });
      flash('GitHub 配置已保存');
    } catch (e) { flash('失败：' + e.message); }
    setBusy('');
  };

  return (
    <>
      <PageHeader eyebrow="内容运营" title="GitHub 运营" desc="管理 Trending 抓取范围、探索推荐规模以及手动数据更新。"
        actions={<>
          <button className="btn-ghost" disabled={!!busy} onClick={() => action('fetch-explore')}>{busy === 'fetch-explore' ? '更新中…' : '✨ 更新探索池'}</button>
          <button className="btn" disabled={!!busy} onClick={() => action('fetch-github')}>{busy === 'fetch-github' ? '抓取中…' : '⟳ 更新 GitHub 数据'}</button>
        </>} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Trending 抓取" desc="系统会抓取日榜、周榜和月榜；语言配置会额外抓取指定语言榜单。">
          <label className="block">
            <span className="text-sm font-medium">额外语言</span>
            <input className="input mt-2" placeholder="javascript, python, go"
              value={settings.github_languages || ''} onChange={(e) => set('github_languages', e.target.value)} />
            <span className="mt-2 block text-xs text-slate-400">使用英文语言标识，逗号分隔；留空只抓取全语言榜单。</span>
          </label>
        </Panel>

        <Panel title="探索推荐" desc="控制用户每次点击“换一批”时获得的项目数量。">
          <label className="block">
            <span className="text-sm font-medium">每批推荐数量</span>
            <input className="input mt-2 max-w-xs" type="number" min="6" max="60"
              value={settings.explore_batch_size || '18'} onChange={(e) => set('explore_batch_size', e.target.value)} />
            <span className="mt-2 block text-xs text-slate-400">允许 6～60 个，建议桌面端使用 18～24 个。</span>
          </label>
          <div className="mt-5 rounded-xl bg-violet-500/10 p-4 text-xs text-violet-700 dark:text-violet-300">
            候选池会避开最近 Trending 项目，并结合活跃度、新鲜度、Star 增长和多样性进行推荐。
          </div>
        </Panel>
      </div>
      <div className="mt-6 flex justify-end"><button className="btn" disabled={busy === 'save'} onClick={savePage}>{busy === 'save' ? '保存中…' : '保存 GitHub 配置'}</button></div>
      <Toast message={message} />
    </>
  );
}
