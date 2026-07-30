import { redirect } from 'next/navigation';
import { getCurrentUser } from '../../lib/user-auth';
import AdminShell from './AdminShell';

export const dynamic = 'force-dynamic';

export default function AdminLayout({ children }) {
  const user = getCurrentUser();
  if (!user) redirect('/login?next=/admin');
  if (user.must_change_password) redirect('/account?security=required');
  if (user.role !== 'admin') redirect('/access-denied');
  return <AdminShell user={{ username: user.username, display_name: user.display_name }}>{children}</AdminShell>;
}
