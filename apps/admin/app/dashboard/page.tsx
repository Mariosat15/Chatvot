import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

// This is a placeholder - in production, import from shared
// import { verifyAdminAuth } from '@lib/admin/auth';
// import AdminDashboard from '@components/admin/AdminDashboard';

async function verifyAdminAuth() {
  // API URL - points to main app's API
  const API_BASE = process.env.MAIN_APP_URL || 'http://localhost:3000';
  
  try {
    const cookieStore = await cookies();
    const adminToken = cookieStore.get('admin_token');
    
    if (!adminToken) {
      return { isAuthenticated: false };
    }

    const response = await fetch(`${API_BASE}/api/admin/auth/verify`, {
      headers: {
        Cookie: `admin_token=${adminToken.value}`,
      },
    });

    if (!response.ok) {
      return { isAuthenticated: false };
    }

    const data = await response.json();
    return {
      isAuthenticated: true,
      email: data.email,
      name: data.name,
    };
  } catch {
    return { isAuthenticated: false };
  }
}

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
    <div className="min-h-screen bg-gray-900 text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-gray-400 mt-2">
            Welcome back, {auth.name || auth.email}
            {isFirstLogin && ' - Please change your password in settings'}
          </p>
        </div>

        {/* Placeholder Content */}
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-4">Separate Admin App</h2>
          <p className="text-gray-400 mb-4">
            This is the standalone admin application running on port 3001.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-yellow-500">Status</h3>
              <p className="text-2xl font-bold mt-2">Running</p>
              <p className="text-gray-400 text-sm">Port 3001</p>
            </div>
            
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-green-500">API</h3>
              <p className="text-2xl font-bold mt-2">Connected</p>
              <p className="text-gray-400 text-sm">Main app @ 3000</p>
            </div>
            
            <div className="bg-gray-700/50 p-4 rounded-lg">
              <h3 className="text-lg font-medium text-blue-500">Worker</h3>
              <p className="text-2xl font-bold mt-2">Active</p>
              <p className="text-gray-400 text-sm">Background jobs</p>
            </div>
          </div>

          <div className="mt-8 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-yellow-500 text-sm">
              <strong>Note:</strong> This is a minimal standalone admin app. 
              The full AdminDashboard component can be imported from the shared packages 
              once the migration is complete.
            </p>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-4">
          <a href="/competitions/create" className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-lg text-center transition-colors">
            <span className="text-yellow-500">+</span> Create Competition
          </a>
          <a href="http://localhost:3000/admin/dashboard" target="_blank" className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-lg text-center transition-colors">
            Full Dashboard →
          </a>
          <a href="/login" className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-lg text-center transition-colors">
            Logout
          </a>
          <a href="http://localhost:3000" target="_blank" className="bg-gray-800 hover:bg-gray-700 border border-gray-700 p-4 rounded-lg text-center transition-colors">
            User App →
          </a>
        </div>
      </div>
    </div>
  );
}

