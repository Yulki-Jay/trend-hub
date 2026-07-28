import { NextResponse } from 'next/server';
import { deleteCurrentSession } from '../../../../lib/user-auth';

export async function POST() {
  deleteCurrentSession();
  return NextResponse.json({ ok: true });
}
