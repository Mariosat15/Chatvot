'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield } from 'lucide-react';

export default function AdminLogin() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    console.log('🔐 [CLIENT] Login attempt:', { email: formData.email, passwordLength: formData.password.length });

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      console.log('🔐 [CLIENT] Response status:', response.status);
      const data = await response.json();
      console.log('🔐 [CLIENT] Response data:', data);

      if (response.ok) {
        toast.success('Login successful!');
        
        if (data.isFirstLogin) {
          router.push('/dashboard?firstLogin=true');
        } else {
          router.push('/dashboard');
        }
      } else {
        console.error('🔐 [CLIENT] Login failed:', data.error, data.details);
        toast.error(data.error || 'Login failed');
      }
    } catch (error) {
      console.error('🔐 [CLIENT] Network/fetch error:', error);
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
              <Shield className="h-8 w-8 text-gray-900" />
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
              <Label htmlFor="email" className="text-gray-300">
                Email Address
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) =>
                  setFormData({ ...formData, email: e.target.value })
                }
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
                placeholder="admin@email.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="password" className="text-gray-300">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                className="mt-2 bg-gray-700 border-gray-600 text-gray-100"
                placeholder="••••••••"
                required
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-gray-900 font-semibold"
            >
              {isLoading ? 'Signing in...' : 'Sign In'}
            </Button>
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

