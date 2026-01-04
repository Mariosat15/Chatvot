'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { authClient } from '@/lib/better-auth/auth-client';

export default function VerifyEmailRequiredPage() {
  const router = useRouter();
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);

  const handleResendEmail = async () => {
    setResending(true);
    try {
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (response.ok) {
        setResent(true);
        toast.success('Verification email sent! Check your inbox.');
      } else {
        toast.error(data.error || 'Failed to send verification email');
      }
    } catch (error) {
      console.error('Error resending verification email:', error);
      toast.error('Failed to send verification email');
    } finally {
      setResending(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await authClient.signOut();
      router.push('/sign-in');
    } catch (error) {
      console.error('Error signing out:', error);
      router.push('/sign-in');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-950 via-gray-900 to-gray-950 flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-gray-900/80 border-gray-800 backdrop-blur-sm">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-yellow-500/20 flex items-center justify-center">
            <Mail className="h-8 w-8 text-yellow-500" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            Verify Your Email
          </CardTitle>
          <CardDescription className="text-gray-400">
            Please verify your email address to access your account.
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-sm text-yellow-200">
              We sent a verification link to your email address. Click the link in the email to verify your account.
            </p>
          </div>

          {resent && (
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
              <p className="text-sm text-green-200">
                Verification email sent! Check your inbox (and spam folder).
              </p>
            </div>
          )}

          <div className="space-y-3">
            <Button
              onClick={handleResendEmail}
              disabled={resending}
              className="w-full bg-yellow-500 hover:bg-yellow-600 text-black font-semibold"
            >
              {resending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4 mr-2" />
                  Resend Verification Email
                </>
              )}
            </Button>

            <Button
              onClick={handleSignOut}
              variant="outline"
              className="w-full bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          <p className="text-xs text-gray-500 text-center">
            Having trouble? Contact support at{' '}
            <a href="mailto:support@chartvolt.com" className="text-yellow-500 hover:underline">
              support@chartvolt.com
            </a>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

