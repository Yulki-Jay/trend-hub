const db = require('./db');
const { runRepoFetch, runDeveloperFetch } = require('./github');
const { runNewsFetch } = require('./news');
const { runPaperFetch } = require('./papers');
const { runExploreFetch } = require('./explore');
const { getSetting } = require('./settings');

function log(job, status, message, count = 0) {
  db.prepare('INSERT INTO job_logs(job,status,message,count) VALUES(?,?,?,?)').run(
    job, status, message, count
  );
}

async function runFetchAll() {
  let repoCount = 0;
  let devCount = 0;
  let newsCount = 0;
  let paperCount = 0;
  try {
    ({ repoCount, devCount } = await runGithubJob());
  } catch {}
  try { newsCount = await runNewsJob(); } catch {}
  try { paperCount = await runPaperJob(); } catch {}
  return { repoCount, devCount, newsCount, paperCount };
}

async function runGithubJob() {
  const ranges = ['daily', 'weekly', 'monthly'];
  let repoCount = 0;
  let devCount = 0;
  let firstError = null;
  try {
    const langs = (getSetting('github_languages', '') || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    repoCount = await runRepoFetch(ranges, langs.length ? ['', ...langs] : ['']);
    log('github', 'success', `抓取仓库 ${repoCount} 条`, repoCount);
  } catch (e) {
    log('github', 'error', e.message);
    firstError = e;
  }
  try {
    devCount = await runDeveloperFetch(ranges, ['']);
    log('developers', 'success', `抓取开发者 ${devCount} 条`, devCount);
  } catch (e) {
    log('developers', 'error', e.message);
    firstError ||= e;
  }
  if (!repoCount && !devCount && firstError) throw firstError;
  return { repoCount, devCount };
}

async function runNewsJob() {
  try {
    const newsCount = await runNewsFetch();
    log('news', 'success', `抓取 ${newsCount} 条`, newsCount);
    return newsCount;
  } catch (e) {
    log('news', 'error', e.message);
    throw e;
  }
}

async function runPaperJob() {
  try {
    const paperCount = await runPaperFetch();
    log('paper', 'success', `抓取 ${paperCount} 条`, paperCount);
    return paperCount;
  } catch (e) {
    log('paper', 'error', e.message);
    throw e;
  }
}

async function runExploreJob() {
  try {
    const count = await runExploreFetch();
    log('explore', 'success', `更新探索候选 ${count} 条`, count);
    return count;
  } catch (e) {
    log('explore', 'error', e.message);
    throw e;
  }
}

module.exports = {
  runFetchAll,
  runGithubJob,
  runNewsJob,
  runPaperJob,
  runExploreJob,
  log,
};
