import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import { getSettings, setSettings } from '../../../../lib/settings';
import { reloadScheduler } from '../../../../lib/scheduler';

function mask(s) {
  const out = { ...s };
  if (out.smtp_pass) out.smtp_pass = '••••••••';
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
  // 不覆盖被掩码的敏感字段
  for (const k of ['smtp_pass']) {
    if (body[k] === '••••••••' || body[k] === '') delete body[k];
  }
  delete body.admin_password;
  if (body.explore_batch_size !== undefined) {
    body.explore_batch_size = String(Math.min(60, Math.max(6, Number(body.explore_batch_size) || 18)));
  }
  setSettings(body);
  reloadScheduler();
  return NextResponse.json({ ok: true });
}
