import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import { getSettings, setSettings } from '../../../../lib/settings';
import { reloadScheduler } from '../../../../lib/scheduler';
import { getCurrentUser } from '../../../../lib/user-auth';
import { audit } from '../../../../lib/security';
import cron from 'node-cron';

const ALLOWED_SETTINGS = new Set([
  'site_name', 'site_description', 'registration_enabled',
  'smtp_host', 'smtp_port', 'smtp_secure', 'smtp_user', 'smtp_pass', 'smtp_from',
  'cron_fetch', 'cron_explore', 'cron_email', 'email_enabled',
  'explore_batch_size', 'github_languages', 'top_repos', 'top_news', 'top_papers',
  'arxiv_categories', 'paper_source_enabled', 'semantic_scholar_key',
]);

function mask(s) {
  const out = { ...s };
  if (out.smtp_pass) out.smtp_pass = '••••••••';
  if (out.semantic_scholar_key) out.semantic_scholar_key = '••••••••';
  delete out.admin_password;
  return out;
}

export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  return NextResponse.json(mask(getSettings()));
}

export async function POST(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const body = await req.json();
  if (!body || Array.isArray(body) || typeof body !== 'object') {
    return NextResponse.json({ error: '请求格式错误' }, { status: 400 });
  }
  for (const key of Object.keys(body)) {
    if (!ALLOWED_SETTINGS.has(key)) delete body[key];
  }
  // 不覆盖被掩码的敏感字段
  for (const k of ['smtp_pass', 'semantic_scholar_key']) {
    if (body[k] === '••••••••' || body[k] === '') delete body[k];
  }
  delete body.admin_password;
  if (body.explore_batch_size !== undefined) {
    body.explore_batch_size = String(Math.min(60, Math.max(6, Number(body.explore_batch_size) || 18)));
  }
  for (const key of ['cron_fetch', 'cron_explore', 'cron_email']) {
    if (body[key] !== undefined) {
      body[key] = String(body[key]).trim().slice(0, 100);
      if (!cron.validate(body[key])) return NextResponse.json({ error: `${key} 不是有效的 cron 表达式` }, { status: 400 });
    }
  }
  for (const key of ['registration_enabled', 'smtp_secure', 'email_enabled', 'paper_source_enabled']) {
    if (body[key] !== undefined) body[key] = String(body[key]) === '1' ? '1' : '0';
  }
  for (const key of ['top_repos', 'top_news', 'top_papers']) {
    if (body[key] !== undefined) body[key] = String(Math.min(100, Math.max(0, Number(body[key]) || 0)));
  }
  if (body.smtp_port !== undefined) body.smtp_port = String(Math.min(65535, Math.max(1, Number(body.smtp_port) || 465)));
  if (body.site_name !== undefined) body.site_name = String(body.site_name).trim().slice(0, 60) || 'TrendHub';
  if (body.site_description !== undefined) body.site_description = String(body.site_description).trim().slice(0, 240);
  for (const key of ['smtp_host', 'smtp_user', 'smtp_from', 'github_languages', 'arxiv_categories']) {
    if (body[key] !== undefined) body[key] = String(body[key]).replace(/[\r\n]/g, ' ').trim().slice(0, 500);
  }
  for (const key of ['smtp_pass', 'semantic_scholar_key']) {
    if (body[key] !== undefined) body[key] = String(body[key]).slice(0, 2000);
  }
  setSettings(body);
  reloadScheduler();
  audit({
    actorUserId: getCurrentUser().id,
    action: 'admin.settings_updated',
    request: req,
    metadata: { keys: Object.keys(body).filter((key) => !['smtp_pass', 'semantic_scholar_key'].includes(key)) },
  });
  return NextResponse.json({ ok: true });
}
