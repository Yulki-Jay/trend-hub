import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/user-auth';

export const dynamic = 'force-dynamic';

export default function AccountLayout({ children }) {
  if (!getCurrentUser()) redirect('/login?next=/account');
  return children;
}
