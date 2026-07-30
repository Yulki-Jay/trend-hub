import { NextResponse } from 'next/server';
import { getCurrentUser } from '../../../../lib/user-auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = getCurrentUser();
  const response = NextResponse.json({ user, isAdmin: user?.role === 'admin' });
  response.headers.set('Cache-Control', 'private, no-store, max-age=0');
  return response;
}
