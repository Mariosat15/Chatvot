'use client';

import { useState, useEffect, useRef } from 'react';
import { User, MapPin, Building2, Mail, Save, Loader2, CheckCircle2, Globe, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import countryList from 'react-select-country-list';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isEUCountry } from '@/lib/utils/country-vat';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  country?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function ProfileSettingsSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  
  // Track original values to detect changes
  const originalValues = useRef<{ name: string; country: string; address: string; city: string; postalCode: string } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const countries = countryList().getData();

  // Helper function to get flag emoji
  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return '';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  // Check if profile has changes
  const hasProfileChanges = () => {
    if (!originalValues.current) return false;
    return (
      name !== originalValues.current.name ||
      country !== originalValues.current.country ||
      address !== originalValues.current.address ||
      city !== originalValues.current.city ||
      postalCode !== originalValues.current.postalCode
    );
  };

  // Check if password form is valid
  const isPasswordFormValid = () => {
    return currentPassword.length >= 8 && newPassword.length >= 8 && newPassword === confirmPassword;
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/user/profile');
      if (response.ok) {
        const data = await response.json();
        setProfile(data);
        setName(data.name || '');
        setCountry(data.country || '');
        setAddress(data.address || '');
        setCity(data.city || '');
        setPostalCode(data.postalCode || '');
        
        // Store original values
        originalValues.current = {
          name: data.name || '',
          country: data.country || '',
          address: data.address || '',
          city: data.city || '',
          postalCode: data.postalCode || '',
        };
      } else {
        toast.error('Failed to load profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          country,
          address,
          city,
          postalCode,
        }),
      });

      if (response.ok) {
        const updatedProfile = await response.json();
        setProfile(updatedProfile);
        
        // Update original values
        originalValues.current = {
          name: updatedProfile.name || '',
          country: updatedProfile.country || '',
          address: updatedProfile.address || '',
          city: updatedProfile.city || '',
          postalCode: updatedProfile.postalCode || '',
        };
        
        toast.success('Profile updated successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (newPassword.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch('/api/user/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (response.ok) {
        toast.success('Password changed successfully!');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to change password');
      }
    } catch (error) {
      console.error('Error changing password:', error);
      toast.error('Failed to change password');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-dark-700/50 rounded-2xl p-8 shadow-xl border border-dark-600">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
          <span className="ml-3 text-gray-400">Loading profile...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Personal Information */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <div className="flex items-center gap-3 mb-6">
          <User className="h-6 w-6 text-primary-500" />
          <h2 className="text-2xl font-bold text-white">Personal Information</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">Full Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="bg-dark-800 border-dark-600 text-white"
            />
          </div>

          {/* Email (Read-only) */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-gray-300 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Address
            </Label>
            <Input
              id="email"
              value={profile?.email || ''}
              disabled
              className="bg-dark-900 border-dark-700 text-gray-500 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500">Email cannot be changed</p>
          </div>
        </div>
      </div>

      {/* Address Information */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <div className="flex items-center gap-3 mb-6">
          <MapPin className="h-6 w-6 text-green-500" />
          <h2 className="text-2xl font-bold text-white">Address Information</h2>
        </div>

        <div className="space-y-6">
          {/* Country */}
          <div className="space-y-2">
            <Label htmlFor="country" className="text-gray-300 flex items-center gap-2">
              <Globe className="h-4 w-4" />
              Country
            </Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="bg-gray-900 border-dark-600 text-white">
                <SelectValue placeholder="Select your country">
                  {country && (
                    <span className="flex items-center gap-2">
                      <span>{getFlagEmoji(country)}</span>
                      <span>{countries.find((c) => c.value === country)?.label}</span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-dark-600 max-h-60">
                {countries.map((c) => (
                  <SelectItem key={c.value} value={c.value} className="text-white hover:bg-gray-800 focus:bg-gray-800">
                    <span className="flex items-center gap-2">
                      <span>{getFlagEmoji(c.value)}</span>
                      <span>{c.label}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {country && isEUCountry(country) && (
              <p className="text-xs text-yellow-500 flex items-center gap-1">
                <span>🇪🇺</span>
                EU country - VAT will apply on credit purchases
              </p>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <Label htmlFor="address" className="text-gray-300">Street Address</Label>
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="123 Main Street"
              className="bg-dark-800 border-dark-600 text-white"
            />
          </div>

          {/* City & Postal Code */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="city" className="text-gray-300 flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                City
              </Label>
              <Input
                id="city"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="London"
                className="bg-dark-800 border-dark-600 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="postalCode" className="text-gray-300">Postal Code</Label>
              <Input
                id="postalCode"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="SW1A 1AA"
                className="bg-dark-800 border-dark-600 text-white"
              />
            </div>
          </div>
        </div>

        {/* Save Profile Button */}
        <div className="flex justify-end mt-6">
          <Button
            onClick={handleSaveProfile}
            disabled={saving}
            className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Profile
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Change Password */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <div className="flex items-center gap-3 mb-6">
          <Lock className="h-6 w-6 text-red-500" />
          <h2 className="text-2xl font-bold text-white">Change Password</h2>
        </div>

        <div className="space-y-4 max-w-md">
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-gray-300">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                className="bg-dark-800 border-dark-600 text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showCurrentPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-gray-300">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 8 characters)"
                className="bg-dark-800 border-dark-600 text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {newPassword && newPassword.length < 8 && (
              <p className="text-xs text-red-400">Password must be at least 8 characters</p>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-gray-300">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm new password"
                className="bg-dark-800 border-dark-600 text-white pr-10"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400">Passwords do not match</p>
            )}
            {confirmPassword && newPassword === confirmPassword && newPassword.length >= 8 && (
              <p className="text-xs text-green-400">Passwords match ✓</p>
            )}
          </div>

          {/* Change Password Button */}
          <div className="pt-2">
            <Button
              onClick={handleChangePassword}
              disabled={savingPassword || !isPasswordFormValid()}
              className={`px-6 py-2 font-semibold ${
                isPasswordFormValid()
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-dark-700 text-gray-500 cursor-not-allowed'
              }`}
            >
              {savingPassword ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Changing...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Change Password
                </>
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Account Information */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <div className="flex items-center gap-3 mb-4">
          <CheckCircle2 className="h-6 w-6 text-blue-500" />
          <h2 className="text-2xl font-bold text-white">Account Information</h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
            <p className="text-gray-400 mb-1">Account Created</p>
            <p className="text-white font-medium">
              {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }) : 'N/A'}
            </p>
          </div>
          <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
            <p className="text-gray-400 mb-1">Last Updated</p>
            <p className="text-white font-medium">
              {profile?.updatedAt ? new Date(profile.updatedAt).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              }) : 'N/A'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

