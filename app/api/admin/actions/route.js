import { NextResponse } from 'next/server';
import { checkAuth } from '../../../../lib/auth';
import { runFetchAll, runExploreJob } from '../../../../lib/jobs';
import { sendDigest, verifySmtp } from '../../../../lib/mailer';
import db from '../../../../lib/db';

export const dynamic = 'force-dynamic';

export async function POST(req) {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const { action, email } = await req.json();
  try {
    if (action === 'fetch') {
      const r = await runFetchAll();
      return NextResponse.json({ ok: true, ...r });
    }
    if (action === 'fetch-explore') {
      const exploreCount = await runExploreJob();
      return NextResponse.json({ ok: true, exploreCount });
    }
    if (action === 'send') {
      const n = await sendDigest();
      return NextResponse.json({ ok: true, sent: n });
    }
    if (action === 'test-email') {
      if (!email) return NextResponse.json({ error: '请填写测试邮箱' }, { status: 400 });
      const n = await sendDigest([email]);
      return NextResponse.json({ ok: true, sent: n });
    }
    if (action === 'verify-smtp') {
      await verifySmtp();
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: '未知操作' }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 });
  }
}

export async function GET() {
  if (!checkAuth()) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  const logs = db.prepare('SELECT * FROM job_logs ORDER BY id DESC LIMIT 50').all();
  return NextResponse.json({ logs });
}
