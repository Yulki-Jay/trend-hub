import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import { getSettings, setSettings } from '../../../../lib/settings';
import { reloadScheduler } from '../../../../lib/scheduler';

function mask(s) {
  const out = { ...s };
  if (out.smtp_pass) out.smtp_pass = '••••••••';
  if (out.admin_password) out.admin_password = '••••••••';
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
  for (const k of ['smtp_pass', 'admin_password']) {
    if (body[k] === '••••••••' || body[k] === '') delete body[k];
  }
  setSettings(body);
  reloadScheduler();
  return NextResponse.json({ ok: true });
}
