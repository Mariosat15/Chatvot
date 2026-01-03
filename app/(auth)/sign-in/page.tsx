'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import InputField from '@/components/forms/InputField';
import FooterLink from '@/components/forms/FooterLink';
import {signInWithEmail} from "@/lib/actions/auth.actions";
import {toast} from "sonner";
import {useRouter} from "next/navigation";
import {trackDeviceFingerprint} from "@/lib/services/device-fingerprint.service";
import { CheckCircle2, AlertTriangle, Mail, Loader2 } from 'lucide-react';

const SignIn = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
    const [resendingEmail, setResendingEmail] = useState(false);
    const [resendEmail, setResendEmail] = useState<string | null>(null);
    
    const {
        register,
        handleSubmit,
        getValues,
        formState: { errors, isSubmitting },
    } = useForm<SignInFormData>({
        defaultValues: {
            email: '',
            password: '',
        },
        mode: 'onBlur',
    });

    // Check for verification status from URL
    useEffect(() => {
        const verification = searchParams.get('verification');
        if (verification) {
            setVerificationStatus(verification);
            
            // Show appropriate toast
            if (verification === 'success') {
                toast.success('Email verified!', {
                    description: 'Your email has been verified. You can now sign in.'
                });
            } else if (verification === 'expired') {
                toast.error('Verification link expired', {
                    description: 'Please request a new verification email.'
                });
            } else if (verification === 'invalid') {
                toast.error('Invalid verification link', {
                    description: 'The verification link is invalid or has already been used.'
                });
            } else if (verification === 'pending') {
                toast.info('Verification required', {
                    description: 'Please check your email to verify your account.'
                });
            }
        }
    }, [searchParams]);

    const handleResendVerification = async () => {
        const email = resendEmail || getValues('email');
        if (!email) {
            toast.error('Please enter your email address');
            return;
        }
        
        setResendingEmail(true);
        try {
            const response = await fetch('/api/auth/verify-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });
            
            const data = await response.json();
            
            if (data.success) {
                toast.success('Verification email sent!', {
                    description: 'Please check your inbox for the verification link.'
                });
                setVerificationStatus('pending');
            } else {
                toast.error('Failed to send verification email', {
                    description: data.error || 'Please try again later.'
                });
            }
        } catch (error) {
            console.error('Resend verification error:', error);
            toast.error('Failed to send verification email');
        } finally {
            setResendingEmail(false);
        }
    };

    const onSubmit = async (data: SignInFormData) => {
        try {
            const result = await signInWithEmail(data);
            if(result.success) {
                // Track device fingerprint after successful sign-in
                try {
                    await trackDeviceFingerprint();
                    console.log('✅ Device fingerprint tracked on login');
                } catch (fpError) {
                    console.error('Failed to track fingerprint:', fpError);
                    // Don't block login if fingerprint fails
                }
                router.push('/');
            } else if (result.needsVerification) {
                // User needs to verify email
                setVerificationStatus('needs_verification');
                setResendEmail(result.email || data.email);
                toast.error('Email not verified', {
                    description: result.error || 'Please verify your email before signing in.'
                });
            } else {
                toast.error('Sign in failed', {
                    description: result.error || 'Invalid email or password.'
                });
            }
        } catch (e) {
            console.error(e);
            toast.error('Sign in failed', {
                description: e instanceof Error ? e.message : 'Failed to sign in.'
            });
        }
    };

    return (
        <>
            <h1 className="form-title">Welcome back</h1>

            {/* Verification Status Banners */}
            {verificationStatus === 'success' && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-500/30 rounded-lg flex items-center gap-3">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                    <p className="text-green-400 text-sm">
                        Your email has been verified! You can now sign in.
                    </p>
                </div>
            )}

            {verificationStatus === 'pending' && (
                <div className="mb-6 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <Mail className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                        <p className="text-yellow-400 text-sm font-medium">
                            Verification email sent!
                        </p>
                    </div>
                    <p className="text-gray-400 text-xs">
                        Please check your inbox and click the verification link to activate your account.
                    </p>
                </div>
            )}

            {(verificationStatus === 'needs_verification' || verificationStatus === 'expired') && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                        <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0" />
                        <p className="text-red-400 text-sm font-medium">
                            {verificationStatus === 'expired' 
                                ? 'Verification link expired' 
                                : 'Email verification required'}
                        </p>
                    </div>
                    <p className="text-gray-400 text-xs mb-3">
                        {verificationStatus === 'expired'
                            ? 'Your verification link has expired. Please request a new one.'
                            : 'Please verify your email before signing in.'}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleResendVerification}
                        disabled={resendingEmail}
                        className="text-xs"
                    >
                        {resendingEmail ? (
                            <>
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <Mail className="h-3 w-3 mr-2" />
                                Resend Verification Email
                            </>
                        )}
                    </Button>
                </div>
            )}

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="email"
                    label="Email"
                    placeholder="contact@example.com"
                    register={register}
                    error={errors.email}
                    validation={{ required: 'Email is required', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/ }}
                />

                <InputField
                    name="password"
                    label="Password"
                    placeholder="Enter your password"
                    type="password"
                    register={register}
                    error={errors.password}
                    validation={{ required: 'Password is required', minLength: 8 }}
                />

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'Signing In' : 'Sign In'}
                </Button>

                <FooterLink text="Don't have an account?" linkText="Create an account" href="/sign-up" />
            </form>
        </>
    );
};
export default SignIn;
