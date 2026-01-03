'use client';

import { useState, useEffect } from 'react';
import {useForm} from "react-hook-form";
import {Button} from "@/components/ui/button";
import InputField from "@/components/forms/InputField";
import {CountrySelectField} from "@/components/forms/CountrySelectField";
import FooterLink from "@/components/forms/FooterLink";
import {signUpWithEmail} from "@/lib/actions/auth.actions";
import {useRouter} from "next/navigation";
import {toast} from "sonner";
import {useDeviceFingerprint} from "@/hooks/useDeviceFingerprint";
import { Check, X } from 'lucide-react';

// Password strength requirements
const PASSWORD_REQUIREMENTS = [
    { id: 'length', label: 'At least 8 characters', test: (p: string) => p.length >= 8 },
    { id: 'uppercase', label: 'At least 1 uppercase letter (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
    { id: 'lowercase', label: 'At least 1 lowercase letter (a-z)', test: (p: string) => /[a-z]/.test(p) },
    { id: 'number', label: 'At least 1 number (0-9)', test: (p: string) => /[0-9]/.test(p) },
    { id: 'special', label: 'At least 1 special character (!@#$%^&*)', test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p) },
];

const SignUp = () => {
    const router = useRouter();
    const { track: trackFingerprint } = useDeviceFingerprint({ auto: false });
    const [passwordStrength, setPasswordStrength] = useState<Record<string, boolean>>({});
    const [showRequirements, setShowRequirements] = useState(false);
    
    const {
        register,
        handleSubmit,
        control,
        watch,
        formState: { errors, isSubmitting },
    } = useForm<SignUpFormData>({
        defaultValues: {
            fullName: '',
            email: '',
            password: '',
            confirmPassword: '',
            country: '',
            address: '',
            city: '',
            postalCode: '',
        },
        mode: 'onBlur'
    });

    const password = watch('password');
    
    // Update password strength indicators
    useEffect(() => {
        const strength: Record<string, boolean> = {};
        PASSWORD_REQUIREMENTS.forEach(req => {
            strength[req.id] = req.test(password || '');
        });
        setPasswordStrength(strength);
    }, [password]);

    // Check if all password requirements are met
    const allRequirementsMet = PASSWORD_REQUIREMENTS.every(req => passwordStrength[req.id]);

    const onSubmit = async (data: SignUpFormData) => {
        // Validate password meets all requirements
        if (!allRequirementsMet) {
            toast.error('Password does not meet security requirements');
            return;
        }

        try {
            const result = await signUpWithEmail(data);
            if(result.success) {
                // Track device fingerprint after successful sign-up
                await trackFingerprint();
                // Redirect to verification pending page instead of home
                toast.success('Account created!', {
                    description: 'Please check your email to verify your account before signing in.'
                });
                router.push('/sign-in?verification=pending');
            } else if (result.error) {
                toast.error('Sign up failed', {
                    description: result.error
                });
            }
        } catch (e) {
            console.error(e);
            toast.error('Sign up failed', {
                description: e instanceof Error ? e.message : 'Failed to create an account.'
            });
        }
    };

    return (
        <>
            <h1 className="form-title">Sign Up</h1>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                <InputField
                    name="fullName"
                    label="Full Name"
                    placeholder="John Doe"
                    register={register}
                    error={errors.fullName}
                    validation={{ required: 'Full name is required', minLength: 2 }}
                />

                <InputField
                    name="email"
                    label="Email"
                    placeholder="contact@example.com"
                    register={register}
                    error={errors.email}
                    validation={{ required: 'Email is required', pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Valid email address is required' }}
                />

                <div className="space-y-2">
                    <InputField
                        name="password"
                        label="Password"
                        placeholder="Enter a strong password"
                        type="password"
                        register={register}
                        error={errors.password}
                        validation={{ 
                            required: 'Password is required',
                            validate: () => allRequirementsMet || 'Password does not meet security requirements'
                        }}
                        onFocus={() => setShowRequirements(true)}
                    />
                    
                    {/* Password Requirements Checklist */}
                    {showRequirements && (
                        <div className="bg-gray-800/50 rounded-lg p-3 border border-gray-700">
                            <p className="text-xs text-gray-400 mb-2">Password must contain:</p>
                            <ul className="space-y-1">
                                {PASSWORD_REQUIREMENTS.map(req => (
                                    <li key={req.id} className="flex items-center gap-2 text-xs">
                                        {passwordStrength[req.id] ? (
                                            <Check className="h-3 w-3 text-green-500" />
                                        ) : (
                                            <X className="h-3 w-3 text-red-500" />
                                        )}
                                        <span className={passwordStrength[req.id] ? 'text-green-400' : 'text-gray-400'}>
                                            {req.label}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>

                <InputField
                    name="confirmPassword"
                    label="Confirm Password"
                    placeholder="Re-enter your password"
                    type="password"
                    register={register}
                    error={errors.confirmPassword}
                    validation={{ 
                        required: 'Please confirm your password',
                        validate: (value: string) => value === password || 'Passwords do not match'
                    }}
                />

                <CountrySelectField
                    name="country"
                    label="Country"
                    control={control}
                    error={errors.country}
                    required
                />

                <InputField
                    name="address"
                    label="Address"
                    placeholder="123 Main Street"
                    register={register}
                    error={errors.address}
                    validation={{ required: 'Address is required' }}
                />

                <div className="grid grid-cols-2 gap-4">
                    <InputField
                        name="city"
                        label="City"
                        placeholder="London"
                        register={register}
                        error={errors.city}
                        validation={{ required: 'City is required' }}
                    />

                    <InputField
                        name="postalCode"
                        label="Postal Code"
                        placeholder="SW1A 1AA"
                        register={register}
                        error={errors.postalCode}
                        validation={{ required: 'Postal code is required' }}
                    />
                </div>

                <Button type="submit" disabled={isSubmitting} className="yellow-btn w-full mt-5">
                    {isSubmitting ? 'Creating Account' : 'Create Account'}
                </Button>

                <FooterLink text="Already have an account?" linkText="Sign in" href="/sign-in" />
            </form>
        </>
    );
};
export default SignUp;
