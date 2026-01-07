import { redirect } from 'next/navigation';
import { verifyAdminAuth } from '@/lib/admin/auth';
import AdminDashboard from '@/components/admin/AdminDashboard';

export default async function AdminDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ firstLogin?: string }>;
}) {
  const auth = await verifyAdminAuth();

  if (!auth.isAuthenticated) {
    redirect('/login');
  }

  const params = await searchParams;
  const isFirstLogin = params.firstLogin === 'true';

  return (
    <AdminDashboard 
      isFirstLogin={isFirstLogin} 
      adminEmail={auth.email!} 
      adminName={auth.name}
      isSuperAdmin={auth.isSuperAdmin || false}
      role={auth.role || 'Employee'}
      allowedSections={auth.allowedSections || []}
    />
  );
}

