import { NextResponse } from 'next/server';
import { deleteCurrentSession } from '../../../../lib/user-auth';

export async function POST(req) {
  deleteCurrentSession(req);
  return NextResponse.json({ ok: true });
}
