import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/user-auth';
import { checkAuth } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ user: getCurrentUser(), isAdmin: checkAuth() });
}
