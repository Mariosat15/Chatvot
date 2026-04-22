"use client";

import { useState, useEffect, useRef } from "react";
import {
  User,
  MapPin,
  Building2,
  Mail,
  Save,
  Loader2,
  CheckCircle2,
  Globe,
  Lock,
  Eye,
  EyeOff,
  Camera,
  FileText,
  Phone,
  Shield,
  UserPlus,
  AlertTriangle,
  Power,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import countryList from "react-select-country-list";
import Image from "next/image";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { isEUCountry } from "@/lib/utils/country-vat";
import TwoFactorSection from "@/components/profile/TwoFactorSection";

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
  const originalValues = useRef<{
    name: string;
    bio: string;
    country: string;
    address: string;
    city: string;
    postalCode: string;
    phone: string;
  } | null>(null);

  // Form fields
  const [name, setName] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [bio, setBio] = useState("");
  const [country, setCountry] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postalCode, setPostalCode] = useState("");
  const [phone, setPhone] = useState("");

  // Password change fields
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // 2FA step-up for password change (only shown when the server demands it)
  const [passwordTwoFactorRequired, setPasswordTwoFactorRequired] =
    useState(false);
  const [passwordTwoFactorCode, setPasswordTwoFactorCode] = useState("");

  // Privacy settings
  const [allowFriendRequests, setAllowFriendRequests] = useState(true);
  const [savingPrivacy, setSavingPrivacy] = useState(false);

  // Account deactivation
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [deactivateConfirmText, setDeactivateConfirmText] = useState("");
  const [deactivating, setDeactivating] = useState(false);

  const countries = countryList().getData();

  // Helper function to get flag emoji
  const getFlagEmoji = (countryCode: string) => {
    if (!countryCode) return "";
    const codePoints = countryCode
      .toUpperCase()
      .split("")
      .map((char) => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  };

  // Check if profile has changes
  const _hasProfileChanges = () => {
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
    return (
      currentPassword.length >= 8 &&
      newPassword.length >= 8 &&
      newPassword === confirmPassword
    );
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const response = await fetch("/api/user/profile");
      if (response.ok) {
        const data = await response.json();
        const userData = data.user || data; // Handle both new and old response format
        setProfile(userData);
        setName(userData.name || "");
        setProfileImage(userData.profileImage || "");
        setBio(userData.bio || "");
        setCountry(userData.country || "");
        setAddress(userData.address || "");
        setCity(userData.city || "");
        setPostalCode(userData.postalCode || "");
        setPhone(userData.phone || "");

        // Load privacy settings
        setAllowFriendRequests(
          userData.settings?.privacy?.allowFriendRequests ?? true,
        );

        // Store original values
        originalValues.current = {
          name: userData.name || "",
          bio: userData.bio || "",
          country: userData.country || "",
          address: userData.address || "",
          city: userData.city || "",
          postalCode: userData.postalCode || "",
          phone: userData.phone || "",
        };
      } else {
        toast.error("Failed to load profile");
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
      toast.error("Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleDeactivateAccount = async () => {
    if (deactivateConfirmText !== "DEACTIVATE") return;
    setDeactivating(true);
    try {
      const response = await fetch("/api/user/deactivate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (response.ok && data.success) {
        toast.success("Account deactivated. You will be signed out.");
        // Reason: Immediate redirect to sign-in. The backend has already deleted
        // all sessions from the DB, so the auth cookie is now invalid. A hard
        // navigation ensures the client state is fully cleared.
        setTimeout(() => {
          window.location.href = "/sign-in";
        }, 1000);
      } else {
        toast.error(data.error || "Failed to deactivate account");
        setDeactivating(false);
        setShowDeactivateConfirm(false);
        setDeactivateConfirmText("");
      }
    } catch (error) {
      console.error("Error deactivating account:", error);
      toast.error("Something went wrong. Please contact support.");
      setDeactivating(false);
      setShowDeactivateConfirm(false);
      setDeactivateConfirmText("");
    }
  };

  const handleToggleFriendRequests = async () => {
    const newValue = !allowFriendRequests;
    setSavingPrivacy(true);

    try {
      const response = await fetch("/api/user/privacy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ allowFriendRequests: newValue }),
      });

      if (response.ok) {
        setAllowFriendRequests(newValue);
        toast.success(
          newValue ? "Friend requests enabled" : "Friend requests disabled",
        );
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update privacy settings");
      }
    } catch (error) {
      console.error("Error updating privacy settings:", error);
      toast.error("Failed to update privacy settings");
    } finally {
      setSavingPrivacy(false);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/user/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
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
          name: updatedProfile.name || "",
          bio: updatedProfile.bio || "",
          country: updatedProfile.country || "",
          address: updatedProfile.address || "",
          city: updatedProfile.city || "",
          postalCode: updatedProfile.postalCode || "",
          phone: updatedProfile.phone || "",
        };

        toast.success("Profile updated successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to update profile");
      }
    } catch (error) {
      console.error("Error saving profile:", error);
      toast.error("Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const validTypes = [
      "image/jpeg",
      "image/jpg",
      "image/png",
      "image/webp",
      "image/gif",
    ];
    if (!validTypes.includes(file.type)) {
      toast.error("Invalid file type. Please use JPEG, PNG, WebP, or GIF.");
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File too large. Maximum size is 5MB.");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);

      const response = await fetch("/api/user/profile/upload-image", {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setProfileImage(data.profileImage);
        toast.success("Profile image uploaded successfully!");
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to upload image");
      }
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSavingPassword(true);
    try {
      const response = await fetch("/api/user/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword,
          newPassword,
          // Reason: Only send the code when the server has already asked for
          // it. Sending an empty string is fine — the gate treats it as "no
          // code provided" and will respond with TWO_FACTOR_REQUIRED.
          twoFactorCode: passwordTwoFactorRequired
            ? passwordTwoFactorCode.trim()
            : undefined,
        }),
      });

      if (response.ok) {
        toast.success("Password changed successfully!");
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setPasswordTwoFactorRequired(false);
        setPasswordTwoFactorCode("");
      } else {
        const error = await response.json();
        const code = error?.code as string | undefined;

        if (code === "TWO_FACTOR_REQUIRED" || code === "TWO_FACTOR_INVALID") {
          setPasswordTwoFactorRequired(true);
          toast.error(
            error.error ||
              "Enter your authenticator code to confirm the password change.",
          );
        } else if (code === "TWO_FACTOR_NOT_ENABLED") {
          toast.error(
            error.error ||
              "Enable two-factor authentication first, then try again.",
          );
        } else {
          toast.error(error.error || "Failed to change password");
        }
      }
    } catch (error) {
      console.error("Error changing password:", error);
      toast.error("Failed to change password");
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
          <h2 className="text-2xl font-bold text-white">
            Profile Picture & Bio
          </h2>
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
                      {name ? name.charAt(0).toUpperCase() : "?"}
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
            <p className="text-xs text-gray-500">
              Max 5MB (JPEG, PNG, WebP, GIF)
            </p>
          </div>

          {/* Bio */}
          <div className="flex-1 space-y-2">
            <Label
              htmlFor="bio"
              className="text-gray-300 flex items-center gap-2"
            >
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
              <p className="text-xs text-gray-500">
                This will be shown on your profile card
              </p>
              <p
                className={`text-xs ${bio.length > 450 ? "text-yellow-400" : "text-gray-500"}`}
              >
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
          <h2 className="text-2xl font-bold text-white">
            Personal Information
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-gray-300">
              Full Name
            </Label>
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
            <Label
              htmlFor="email"
              className="text-gray-300 flex items-center gap-2"
            >
              <Mail className="h-4 w-4" />
              Email Address
            </Label>
            <Input
              id="email"
              value={profile?.email || ""}
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
            <Label
              htmlFor="country"
              className="text-gray-300 flex items-center gap-2"
            >
              <Globe className="h-4 w-4" />
              Country
            </Label>
            <Select value={country} onValueChange={setCountry}>
              <SelectTrigger className="bg-gray-900 border-dark-600 text-white">
                <SelectValue placeholder="Select your country">
                  {country && (
                    <span className="flex items-center gap-2">
                      <span>{getFlagEmoji(country)}</span>
                      <span>
                        {countries.find((c) => c.value === country)?.label}
                      </span>
                    </span>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-dark-600 max-h-60">
                {countries.map((c) => (
                  <SelectItem
                    key={c.value}
                    value={c.value}
                    className="text-white hover:bg-gray-800 focus:bg-gray-800"
                  >
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
            <Label htmlFor="address" className="text-gray-300">
              Street Address
            </Label>
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
              <Label
                htmlFor="city"
                className="text-gray-300 flex items-center gap-2"
              >
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
              <Label htmlFor="postalCode" className="text-gray-300">
                Postal Code
              </Label>
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
            <Label
              htmlFor="phone"
              className="text-gray-300 flex items-center gap-2"
            >
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
            <p className="text-xs text-gray-500">
              Include country code for international numbers
            </p>
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

        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleChangePassword();
          }}
          className="space-y-4 max-w-md"
        >
          {/* Current Password */}
          <div className="space-y-2">
            <Label htmlFor="currentPassword" className="text-gray-300">
              Current Password
            </Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrentPassword ? "text" : "password"}
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
                {showCurrentPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div className="space-y-2">
            <Label htmlFor="newPassword" className="text-gray-300">
              New Password
            </Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNewPassword ? "text" : "password"}
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
                {showNewPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {newPassword && newPassword.length < 8 && (
              <p className="text-xs text-red-400">
                Password must be at least 8 characters
              </p>
            )}
          </div>

          {/* Confirm New Password */}
          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-gray-300">
              Confirm New Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
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
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-xs text-red-400">Passwords do not match</p>
            )}
            {confirmPassword &&
              newPassword === confirmPassword &&
              newPassword.length >= 8 && (
                <p className="text-xs text-green-400">Passwords match ✓</p>
              )}
          </div>

          {/* 2FA Step-Up Prompt (shown only after the server asks for it) */}
          {passwordTwoFactorRequired && (
            <div className="space-y-2 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <Label
                htmlFor="passwordTwoFactorCode"
                className="text-amber-200 flex items-center gap-2"
              >
                <Shield className="h-4 w-4" />
                Two-Factor Code Required
              </Label>
              <p className="text-xs text-amber-300/80">
                Enter the 6-digit code from your authenticator app (or a backup
                code) to confirm this password change.
              </p>
              <Input
                id="passwordTwoFactorCode"
                value={passwordTwoFactorCode}
                onChange={(e) => setPasswordTwoFactorCode(e.target.value)}
                placeholder="123456"
                inputMode="numeric"
                autoComplete="one-time-code"
                className="bg-dark-800 border-dark-600 text-white tracking-widest"
                maxLength={10}
              />
            </div>
          )}

          {/* Change Password Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={savingPassword || !isPasswordFormValid()}
              className={`px-6 py-2 font-semibold ${
                isPasswordFormValid()
                  ? "bg-red-600 hover:bg-red-700 text-white"
                  : "bg-dark-700 text-gray-500 cursor-not-allowed"
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

      {/* Two-Factor Authentication */}
      <TwoFactorSection />

      {/* Privacy Settings */}
      <div className="bg-dark-700/50 rounded-2xl p-6 shadow-xl border border-dark-600">
        <div className="flex items-center gap-3 mb-6">
          <Shield className="h-6 w-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">Privacy Settings</h2>
        </div>

        <div className="space-y-4">
          {/* Allow Friend Requests Toggle */}
          <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg border border-dark-600">
            <div className="flex items-center gap-3">
              <UserPlus className="h-5 w-5 text-cyan-400" />
              <div>
                <p className="text-white font-medium">Allow Friend Requests</p>
                <p className="text-sm text-gray-400">
                  {allowFriendRequests
                    ? "Other users can send you friend requests from the leaderboard"
                    : "Friend requests from the leaderboard are disabled"}
                </p>
              </div>
            </div>
            <button
              onClick={handleToggleFriendRequests}
              disabled={savingPrivacy}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                allowFriendRequests ? "bg-cyan-500" : "bg-dark-600"
              } ${savingPrivacy ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              <span
                className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                  allowFriendRequests ? "translate-x-7" : "translate-x-0"
                }`}
              />
              {savingPrivacy && (
                <Loader2 className="absolute top-1.5 left-1/2 -translate-x-1/2 h-4 w-4 animate-spin text-white" />
              )}
            </button>
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
              {profile?.createdAt
                ? new Date(profile.createdAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "N/A"}
            </p>
          </div>
          <div className="bg-dark-800/50 rounded-lg p-4 border border-dark-600">
            <p className="text-gray-400 mb-1">Last Updated</p>
            <p className="text-white font-medium">
              {profile?.updatedAt
                ? new Date(profile.updatedAt).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })
                : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Deactivate Account */}
      <div className="bg-red-950/30 rounded-2xl p-6 shadow-xl border border-red-900/50">
        <div className="flex items-center gap-3 mb-4">
          <Power className="h-6 w-6 text-red-500" />
          <h2 className="text-2xl font-bold text-red-400">Deactivate Account</h2>
        </div>

        <div className="space-y-3">
          <p className="text-gray-300 text-sm">
            Deactivating your account will prevent you from logging in.
            Your data will be preserved and can be reactivated by contacting support.
          </p>
          <div className="flex items-start gap-2 text-sm text-yellow-400/80 bg-yellow-500/10 rounded-lg p-3 border border-yellow-500/20">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              This action is immediate. You will be signed out and will not be able to log back in
              until support reactivates your account.
            </span>
          </div>

          {!showDeactivateConfirm ? (
            <Button
              variant="destructive"
              onClick={() => setShowDeactivateConfirm(true)}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <Power className="mr-2 h-4 w-4" />
              Deactivate My Account
            </Button>
          ) : (
            <div className="space-y-3 bg-red-950/50 rounded-lg p-4 border border-red-800/50">
              <p className="text-sm text-red-300 font-medium">
                Type <span className="font-mono font-bold text-white">DEACTIVATE</span> to confirm:
              </p>
              <Input
                value={deactivateConfirmText}
                onChange={(e) => setDeactivateConfirmText(e.target.value)}
                placeholder="Type DEACTIVATE"
                className="bg-dark-800 border-red-700/50 text-white"
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  disabled={deactivateConfirmText !== "DEACTIVATE" || deactivating}
                  onClick={handleDeactivateAccount}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {deactivating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deactivating...
                    </>
                  ) : (
                    "Confirm Deactivation"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDeactivateConfirm(false);
                    setDeactivateConfirmText("");
                  }}
                  className="border-gray-600 text-gray-300"
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
