const db = require('./db');
const { runRepoFetch, runDeveloperFetch } = require('./github');
const { runNewsFetch } = require('./news');
const { runPaperFetch } = require('./papers');
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
  const ranges = ['daily', 'weekly', 'monthly'];
  try {
    const langs = (getSetting('github_languages', '') || '')
      .split(',').map((s) => s.trim()).filter(Boolean);
    repoCount = await runRepoFetch(ranges, langs.length ? ['', ...langs] : ['']);
    log('github', 'success', `抓取仓库 ${repoCount} 条`, repoCount);
  } catch (e) {
    log('github', 'error', e.message);
  }
  try {
    devCount = await runDeveloperFetch(ranges, ['']);
    log('developers', 'success', `抓取开发者 ${devCount} 条`, devCount);
  } catch (e) {
    log('developers', 'error', e.message);
  }
  try {
    newsCount = await runNewsFetch();
    log('news', 'success', `抓取 ${newsCount} 条`, newsCount);
  } catch (e) {
    log('news', 'error', e.message);
  }
  try {
    paperCount = await runPaperFetch();
    log('paper', 'success', `抓取 ${paperCount} 条`, paperCount);
  } catch (e) {
    log('paper', 'error', e.message);
  }
  return { repoCount, devCount, newsCount, paperCount };
}

module.exports = { runFetchAll, log };
