'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

// Note: In production, import from shared components
// import { Button } from '@components/ui/button';
// import { Input } from '@components/ui/input';

export default function AdminLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  // API URL - points to main app's API
  const API_BASE = process.env.NEXT_PUBLIC_MAIN_APP_URL || 'http://localhost:3000';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/api/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
        credentials: 'include', // Important for cookies
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Login successful!');
        
        if (data.isFirstLogin) {
          router.push('/dashboard?firstLogin=true');
        } else {
          router.push('/dashboard');
        }
      } else {
        toast.error(data.error || 'Login failed');
      }
    } catch {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="w-full max-w-md">
        <div className="bg-gray-800 border border-gray-700 rounded-lg p-8">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div className="h-16 w-16 bg-yellow-500 rounded-full flex items-center justify-center mb-4">
              <svg className="h-8 w-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-100">
              Admin Panel
            </h1>
            <p className="text-gray-400 text-sm mt-2">
              Sign in to access the dashboard
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-300">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="mt-2 w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="admin@email.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-300">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="mt-2 w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-gray-100 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold rounded-md disabled:opacity-50"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Default Credentials Info */}
          <div className="mt-6 p-4 bg-gray-700/50 border border-gray-600 rounded-lg">
            <p className="text-xs text-gray-400 text-center">
              Default: This is your Admin Panel Dashboard
            </p>
            <p className="text-xs text-gray-500 text-center mt-1">
              Change credentials after first login
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

