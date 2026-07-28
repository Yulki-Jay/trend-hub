import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/user-auth';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }) {
  const user = getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.role !== 'admin') redirect('/');
  return children;
}
