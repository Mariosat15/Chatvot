'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Save, Key, Mail, Lock, Shield, AlertCircle, CheckCircle2, User } from 'lucide-react';

interface CredentialsSectionProps {
  currentEmail: string;
  currentName?: string;
}

export default function CredentialsSection({
  currentEmail,
  currentName = 'Admin',
}: CredentialsSectionProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: currentName,
    email: currentEmail,
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.newPassword !== formData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (formData.newPassword && formData.newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/credentials', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          currentPassword: formData.currentPassword,
          newPassword: formData.newPassword || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Credentials updated successfully');
        setFormData({
          name: data.name || formData.name,
          email: data.email,
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
        
        // If email changed, logout and redirect to login
        if (data.email !== currentEmail) {
          toast.info('Please login with your new email');
          setTimeout(() => {
            router.push('/admin/login');
          }, 2000);
        } else {
          router.refresh();
        }
      } else {
        toast.error(data.error || 'Update failed');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-yellow-500/50 rounded-2xl shadow-2xl shadow-yellow-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-yellow-500 to-yellow-600 p-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Key className="h-8 w-8 text-yellow-600" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                Admin Credentials
              </h2>
              <p className="text-yellow-100 mt-1">
                Update your admin email and password securely
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8 shadow-xl">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Name Section */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                <User className="h-5 w-5 text-cyan-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Admin Name</h3>
            </div>
            <Label htmlFor="name" className="text-gray-300 flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-cyan-400" />
              Display Name
            </Label>
            <Input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-cyan-500"
              placeholder="Enter your name"
            />
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <User className="h-3 w-3" />
              This name will be shown in the admin dashboard
            </p>
          </div>

          {/* Email Section */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                <Mail className="h-5 w-5 text-blue-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Email Address</h3>
            </div>
            <Label htmlFor="email" className="text-gray-300 flex items-center gap-2 mb-2">
              <Mail className="h-4 w-4 text-blue-400" />
              Admin Email
            </Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="bg-gray-800 border-gray-600 text-gray-100 h-12 text-lg focus:ring-2 focus:ring-blue-500"
              required
            />
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Changing your email will require re-login
            </p>
          </div>

          {/* Current Password */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                <Shield className="h-5 w-5 text-purple-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-100">Verification</h3>
            </div>
            <Label htmlFor="currentPassword" className="text-gray-300 flex items-center gap-2 mb-2">
              <Lock className="h-4 w-4 text-purple-400" />
              Current Password *
            </Label>
            <Input
              id="currentPassword"
              type="password"
              value={formData.currentPassword}
              onChange={(e) =>
                setFormData({ ...formData, currentPassword: e.target.value })
              }
              className="bg-gray-800 border-gray-600 text-gray-100 h-12 focus:ring-2 focus:ring-purple-500"
              placeholder="Enter current password to confirm changes"
              required
            />
            <p className="text-xs text-gray-500 mt-2 flex items-center gap-1">
              <Shield className="h-3 w-3" />
              Required to verify your identity
            </p>
          </div>

          {/* Change Password Section */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 bg-green-500/20 rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-green-400" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-100">Change Password</h3>
                <p className="text-sm text-gray-400">Optional - leave blank to keep current password</p>
              </div>
            </div>

            <div className="space-y-6">
              <div>
                <Label htmlFor="newPassword" className="text-gray-300 flex items-center gap-2 mb-2">
                  <Lock className="h-4 w-4 text-green-400" />
                  New Password
                </Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, newPassword: e.target.value })
                  }
                  className="bg-gray-800 border-gray-600 text-gray-100 h-12 focus:ring-2 focus:ring-green-500"
                  placeholder="Leave blank to keep current password"
                />
                <p className="text-xs text-gray-500 mt-2">
                  Minimum 6 characters required
                </p>
              </div>

              <div>
                <Label htmlFor="confirmPassword" className="text-gray-300 flex items-center gap-2 mb-2">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  Confirm New Password
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={(e) =>
                    setFormData({ ...formData, confirmPassword: e.target.value })
                  }
                  className="bg-gray-800 border-gray-600 text-gray-100 h-12 focus:ring-2 focus:ring-green-500"
                  placeholder="Re-enter new password"
                />
                {formData.newPassword && formData.confirmPassword && (
                  <p className={`text-xs mt-2 flex items-center gap-1 ${
                    formData.newPassword === formData.confirmPassword ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {formData.newPassword === formData.confirmPassword ? (
                      <><CheckCircle2 className="h-3 w-3" /> Passwords match</>
                    ) : (
                      <><AlertCircle className="h-3 w-3" /> Passwords don't match</>
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Warning */}
          <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-yellow-400 mt-0.5" />
              <div>
                <h4 className="text-sm font-semibold text-yellow-400">Security Notice</h4>
                <p className="text-xs text-gray-400 mt-1">
                  Make sure to use a strong password with a mix of letters, numbers, and special characters.
                  You'll be logged out if you change your email.
                </p>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-gray-900 font-bold h-14 text-lg shadow-lg shadow-yellow-500/50"
          >
            <Save className="h-5 w-5 mr-2" />
            {isLoading ? 'Saving Changes...' : 'Save Credentials'}
          </Button>
        </form>
      </div>
    </div>
  );
}

