'use client';

import { useState, useEffect, useRef } from 'react';
import { User, MapPin, Building2, Mail, Save, Loader2, CheckCircle2, Globe, Lock, Eye, EyeOff, Camera, FileText, Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import countryList from 'react-select-country-list';
import Image from 'next/image';
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
  profileImage?: string;
  bio?: string;
  country?: string;
  address?: string;
  city?: string;
  postalCode?: string;
  phone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export default function ProfileSettingsSection() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Track original values to detect changes
  const originalValues = useRef<{ name: string; bio: string; country: string; address: string; city: string; postalCode: string; phone: string } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [bio, setBio] = useState('');
  const [country, setCountry] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');

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
      bio !== originalValues.current.bio ||
      country !== originalValues.current.country ||
      address !== originalValues.current.address ||
      city !== originalValues.current.city ||
      postalCode !== originalValues.current.postalCode ||
      phone !== originalValues.current.phone
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
        const userData = data.user || data; // Handle both new and old response format
        setProfile(userData);
        setName(userData.name || '');
        setProfileImage(userData.profileImage || '');
        setBio(userData.bio || '');
        setCountry(userData.country || '');
        setAddress(userData.address || '');
        setCity(userData.city || '');
        setPostalCode(userData.postalCode || '');
        setPhone(userData.phone || '');
        
        // Store original values
        originalValues.current = {
          name: userData.name || '',
          bio: userData.bio || '',
          country: userData.country || '',
          address: userData.address || '',
          city: userData.city || '',
          postalCode: userData.postalCode || '',
          phone: userData.phone || '',
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
          bio,
          country,
          address,
          city,
          postalCode,
          phone,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const updatedProfile = data.user || data;
        setProfile(updatedProfile);
        
        // Update original values
        originalValues.current = {
          name: updatedProfile.name || '',
          bio: updatedProfile.bio || '',
          country: updatedProfile.country || '',
          address: updatedProfile.address || '',
          city: updatedProfile.city || '',
          postalCode: updatedProfile.postalCode || '',
          phone: updatedProfile.phone || '',
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

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
    if (!validTypes.includes(file.type)) {
      toast.error('Invalid file type. Please use JPEG, PNG, WebP, or GIF.');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('File too large. Maximum size is 5MB.');
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('/api/user/profile/upload-image', {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfileImage(data.profileImage);
        toast.success('Profile image uploaded successfully!');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Failed to upload image');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      toast.error('Failed to upload image');
    } finally {
      setUploadingImage(false);
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
      {/* Profile Picture & Bio */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <div className="flex items-center gap-3 mb-6">
          <Camera className="h-6 w-6 text-pink-500" />
          <h2 className="text-2xl font-bold text-white">Profile Picture & Bio</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-8">
          {/* Profile Image */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative group">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-pink-500 to-purple-600 p-1">
                <div className="w-full h-full rounded-full overflow-hidden bg-dark-800 flex items-center justify-center">
                  {profileImage ? (
                    <Image
                      src={profileImage}
                      alt="Profile"
                      width={128}
                      height={128}
                      className="w-full h-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <span className="text-4xl font-bold text-gray-400">
                      {name ? name.charAt(0).toUpperCase() : '?'}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingImage}
                className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingImage ? (
                  <Loader2 className="h-8 w-8 text-white animate-spin" />
                ) : (
                  <Camera className="h-8 w-8 text-white" />
                )}
              </button>
            </div>
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImageUpload}
              accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
              className="hidden"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              className="text-pink-400 border-pink-500/50 hover:bg-pink-500/10"
            >
              {uploadingImage ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Camera className="mr-2 h-4 w-4" />
                  Change Photo
                </>
              )}
            </Button>
            <p className="text-xs text-gray-500">Max 5MB (JPEG, PNG, WebP, GIF)</p>
          </div>

          {/* Bio */}
          <div className="flex-1 space-y-2">
            <Label htmlFor="bio" className="text-gray-300 flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Bio / About Me
            </Label>
            <Textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell others about yourself, your trading style, and your goals..."
              className="bg-dark-800 border-dark-600 text-white min-h-[120px] resize-none"
              maxLength={500}
            />
            <div className="flex justify-between">
              <p className="text-xs text-gray-500">This will be shown on your profile card</p>
              <p className={`text-xs ${bio.length > 450 ? 'text-yellow-400' : 'text-gray-500'}`}>
                {bio.length}/500
              </p>
            </div>
          </div>
        </div>
      </div>

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

          {/* Phone */}
          <div className="space-y-2">
            <Label htmlFor="phone" className="text-gray-300 flex items-center gap-2">
              <Phone className="h-4 w-4" />
              Phone Number
            </Label>
            <Input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="bg-dark-800 border-dark-600 text-white"
            />
            <p className="text-xs text-gray-500">Include country code for international numbers</p>
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

        <form onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }} className="space-y-4 max-w-md">
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
                autoComplete="current-password"
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
                autoComplete="new-password"
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
                autoComplete="new-password"
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
              type="submit"
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
        </form>
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

