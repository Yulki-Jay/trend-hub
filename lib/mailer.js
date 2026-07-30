const nodemailer = require('nodemailer');
const db = require('./db');
const { getSettings } = require('./settings');

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
}

function safeHref(value) {
  try {
    const url = new URL(String(value || ''));
    return ['http:', 'https:'].includes(url.protocol) ? escapeHtml(url.toString()) : '#';
  } catch { return '#'; }
}

function buildTransport(s) {
  if (!s.smtp_host || !s.smtp_user) return null;
  return nodemailer.createTransport({
    host: s.smtp_host,
    port: parseInt(s.smtp_port, 10) || 465,
    secure: s.smtp_secure === '1',
    auth: { user: s.smtp_user, pass: s.smtp_pass },
  });
}

const CATS = { tech: '科技', economy: '经济', politics: '政治' };

function buildHtml({ repos, news, papers }) {
  const repoRows = repos
    .map(
      (r, i) => `
      <tr>
        <td style="padding:8px 6px;color:#6366f1;font-weight:700;">#${i + 1}</td>
        <td style="padding:8px 6px;">
          <a href="${safeHref(r.url)}" style="color:#111827;font-weight:600;text-decoration:none;">${escapeHtml(r.full_name)}</a>
          <div style="color:#6b7280;font-size:13px;margin-top:2px;">${escapeHtml((r.description || '').slice(0, 100))}</div>
          <div style="color:#9ca3af;font-size:12px;margin-top:2px;">${escapeHtml(r.language || '')} · ⭐ ${Number(r.stars) || 0} · 今日 +${Number(r.today_stars) || 0}</div>
        </td>
      </tr>`
    )
    .join('');

  const newsByCat = {};
  for (const n of news) (newsByCat[n.category] ||= []).push(n);
  const newsBlocks = Object.entries(newsByCat)
    .map(
      ([cat, list]) => `
      <h3 style="margin:18px 0 8px;color:#111827;">${escapeHtml(CATS[cat] || cat)}</h3>
      ${list
        .map(
          (n) => `<div style="margin-bottom:10px;">
            <a href="${safeHref(n.url)}" style="color:#1f2937;text-decoration:none;font-weight:600;">${escapeHtml(n.title)}</a>
            <div style="color:#9ca3af;font-size:12px;">${escapeHtml(n.source)}</div>
          </div>`
        )
        .join('')}`
    )
    .join('');

  const paperBlock = papers && papers.length
    ? `<h2 style="margin:24px 0 8px;color:#111827;">📄 前沿论文</h2>` +
      papers.map((p) => `<div style="margin-bottom:12px;">
        <a href="${safeHref(p.url)}" style="color:#1f2937;text-decoration:none;font-weight:600;">${escapeHtml(p.title)}</a>
        <div style="color:#9ca3af;font-size:12px;">${escapeHtml(p.source)} · ${escapeHtml(p.category)}${p.stars ? ' · ⭐' + (Number(p.stars) || 0) : ''}</div>
      </div>`).join('')
    : '';

  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;padding:24px;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <div style="max-width:640px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06);">
      <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);padding:28px 24px;color:#fff;">
        <h1 style="margin:0;font-size:22px;">TrendHub 每日资讯汇总</h1>
        <p style="margin:6px 0 0;opacity:.9;">${new Date().toLocaleDateString('zh-CN')} · GitHub 热榜 + 全网热点 + 前沿论文</p>
      </div>
      <div style="padding:24px;">
        <h2 style="margin:0 0 12px;color:#111827;">🔥 GitHub Trending</h2>
        <table style="width:100%;border-collapse:collapse;">${repoRows}</table>
        <h2 style="margin:24px 0 4px;color:#111827;">📰 热点新闻</h2>
        ${newsBlocks}
        ${paperBlock}
      </div>
      <div style="padding:16px 24px;background:#f9fafb;color:#9ca3af;font-size:12px;text-align:center;">
        本邮件由 TrendHub 自动生成
      </div>
    </div>
  </body></html>`;
}

function getDigestData() {
  const s = getSettings();
  const topRepos = parseInt(s.top_repos, 10) || 10;
  const topNews = parseInt(s.top_news, 10) || 15;
  const topPapers = parseInt(s.top_papers, 10) || 8;
  const today = new Date().toLocaleDateString('en-CA'); // 本地日期 YYYY-MM-DD
  const repos = db
    .prepare(
      `SELECT * FROM repos WHERE range='daily' AND fetched_date=? ORDER BY rank ASC LIMIT ?`
    )
    .all(today, topRepos);
  const news = db
    .prepare(
      `SELECT * FROM news ORDER BY published_at DESC LIMIT ?`
    )
    .all(topNews);
  const papers = db
    .prepare(`SELECT * FROM papers ORDER BY published_at DESC LIMIT ?`)
    .all(topPapers);
  return { repos, news, papers };
}

async function sendDigest(overrideEmails) {
  const s = getSettings();
  const transport = buildTransport(s);
  if (!transport) throw new Error('SMTP 未配置');

  const emails =
    overrideEmails ||
    db.prepare('SELECT email FROM recipients WHERE enabled=1').all().map((r) => r.email);
  if (!emails.length) throw new Error('无有效收件人');

  const data = getDigestData();
  const html = buildHtml(data);
  await transport.sendMail({
    from: s.smtp_from || s.smtp_user,
    to: emails.join(','),
    subject: `TrendHub 每日汇总 · ${new Date().toLocaleDateString('zh-CN')}`,
    html,
  });
  db.prepare('INSERT INTO job_logs(job,status,message,count) VALUES(?,?,?,?)').run(
    'email', 'success', `已发送至 ${emails.length} 个邮箱`, emails.length
  );
  return emails.length;
}

async function verifySmtp() {
  const s = getSettings();
  const t = buildTransport(s);
  if (!t) throw new Error('SMTP 未配置');
  await t.verify();
  return true;
}

module.exports = { sendDigest, verifySmtp, getDigestData };
