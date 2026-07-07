const cron = require('node-cron');
const { getSetting } = require('./settings');
const { runFetchAll } = require('./jobs');
const { sendDigest } = require('./mailer');
const db = require('./db');

let tasks = [];
let started = false;

function stopAll() {
  tasks.forEach((t) => t.stop());
  tasks = [];
}

function schedule() {
  stopAll();
  const cronFetch = getSetting('cron_fetch', '0 */2 * * *');
  const cronEmail = getSetting('cron_email', '0 8 * * *');
  const emailEnabled = getSetting('email_enabled', '0') === '1';

  if (cron.validate(cronFetch)) {
    tasks.push(cron.schedule(cronFetch, () => { runFetchAll().catch(() => {}); }));
  }
  if (emailEnabled && cron.validate(cronEmail)) {
    tasks.push(
      cron.schedule(cronEmail, () => {
        sendDigest().catch((e) =>
          db.prepare('INSERT INTO job_logs(job,status,message) VALUES(?,?,?)').run('email', 'error', e.message)
        );
      })
    );
  }
}

function startScheduler() {
  if (started) return;
  started = true;
  schedule();
  console.log('[TrendHub] scheduler started');
}

function reloadScheduler() {
  if (!started) return startScheduler();
  schedule();
}

module.exports = { startScheduler, reloadScheduler };
