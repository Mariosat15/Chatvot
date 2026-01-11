'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Save, Upload, RefreshCw, Image as ImageIconLucide, Info, Palette, Star, Users, Quote } from 'lucide-react';
import Image from 'next/image';

// File input refs for each field
const fileInputRefs: Record<string, HTMLInputElement | null> = {};

interface ImageSettings {
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
  favicon: string;
}

interface AuthPageSettings {
  authPageTestimonialText: string;
  authPageTestimonialAuthor: string;
  authPageTestimonialRole: string;
  authPageTestimonialRating: number;
  authPageDashboardImage: string;
}

export default function ImagesSection() {
  const [images, setImages] = useState<ImageSettings>({
    appLogo: '',
    emailLogo: '',
    profileImage: '',
    dashboardPreview: '',
    favicon: '',
  });
  const [authSettings, setAuthSettings] = useState<AuthPageSettings>({
    authPageTestimonialText: '',
    authPageTestimonialAuthor: '',
    authPageTestimonialRole: '',
    authPageTestimonialRating: 5,
    authPageDashboardImage: '',
  });
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchImages();
    fetchAuthSettings();
  }, []);

  const fetchImages = async () => {
    setIsFetching(true);
    try {
      const response = await fetch('/api/images');
      if (response.ok) {
        const data = await response.json();
        setImages(data);
      }
    } catch (error) {
      toast.error('Failed to load images');
    } finally {
      setIsFetching(false);
    }
  };

  const fetchAuthSettings = async () => {
    try {
      const response = await fetch('/api/hero-settings');
      if (response.ok) {
        const data = await response.json();
        // API returns { settings: {...} } so access the nested object
        const settings = data.settings || data;
        setAuthSettings({
          authPageTestimonialText: settings.authPageTestimonialText || '',
          authPageTestimonialAuthor: settings.authPageTestimonialAuthor || '',
          authPageTestimonialRole: settings.authPageTestimonialRole || '',
          authPageTestimonialRating: settings.authPageTestimonialRating || 5,
          authPageDashboardImage: settings.authPageDashboardImage || '',
        });
      }
    } catch (error) {
      console.error('Failed to load auth settings:', error);
    }
  };

  const handleFileUpload = async (
    field: keyof ImageSettings,
    file: File
  ) => {
    console.log(`[Upload] Starting upload for ${field}:`, file.name, file.type, file.size);
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading((prev) => ({ ...prev, [field]: true }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('field', field);

      console.log(`[Upload] Sending request to /api/images/upload`);
      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      console.log(`[Upload] Response status:`, response.status);
      const data = await response.json();
      console.log(`[Upload] Response data:`, data);

      if (response.ok) {
        const newImages = { ...images, [field]: data.path };
        setImages(newImages);
        console.log(`[Upload] New images state:`, newImages);
        
        // Auto-save to database immediately after upload
        console.log(`[Upload] Saving to database...`);
        const saveResponse = await fetch('/api/images', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newImages),
        });
        
        console.log(`[Upload] Save response:`, saveResponse.status);
        
        if (saveResponse.ok) {
          toast.success(`${field} uploaded and saved! Changes will appear after page refresh.`);
        } else {
          const saveError = await saveResponse.json();
          console.error(`[Upload] Save error:`, saveError);
          toast.warning(`${field} uploaded but not saved. Click "Save" to persist.`);
        }
      } else {
        console.error(`[Upload] Upload failed:`, data);
        toast.error(data.error || 'Upload failed');
      }
    } catch (error) {
      console.error(`[Upload] Exception:`, error);
      toast.error('An error occurred during upload: ' + (error instanceof Error ? error.message : 'Unknown'));
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/images', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(images),
      });

      if (response.ok) {
        toast.success('Images configuration saved');
        toast.info('Changes will be visible after page refresh');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Save failed');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAuthImageUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    setUploading((prev) => ({ ...prev, authPageDashboardImage: true }));

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('field', 'authPageDashboardImage');

      const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setAuthSettings((prev) => ({ ...prev, authPageDashboardImage: data.path }));
        toast.success('Auth page image uploaded successfully');
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (error) {
      toast.error('An error occurred during upload');
    } finally {
      setUploading((prev) => ({ ...prev, authPageDashboardImage: false }));
    }
  };

  const handleSaveAuthSettings = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/hero-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authSettings),
      });

      if (response.ok) {
        toast.success('Auth page settings saved');
        toast.info('Changes will be visible on login/signup pages');
      } else {
        const data = await response.json();
        toast.error(data.error || 'Save failed');
      }
    } catch (error) {
      toast.error('An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const ImageUploadCard = ({
    title,
    description,
    field,
    currentPath,
    recommendations,
  }: {
    title: string;
    description: string;
    field: keyof ImageSettings;
    currentPath: string;
    recommendations: string;
  }) => (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 hover:border-purple-500/50 transition-all">
      <div className="flex items-start gap-6">
        {/* Preview */}
        <div className="flex-shrink-0">
          {currentPath ? (
            <div className="relative h-32 w-32 bg-gray-900 border-2 border-gray-700 rounded-xl overflow-hidden shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                key={currentPath}
                src={currentPath}
                alt={title}
                className="absolute inset-0 w-full h-full object-contain p-3"
                onError={(e) => {
                  console.error(`Failed to load image: ${currentPath}`);
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
          ) : (
            <div className="h-32 w-32 bg-gray-900 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center">
              <ImageIconLucide className="h-12 w-12 text-gray-600" />
            </div>
          )}
        </div>

        {/* Info & Upload */}
        <div className="flex-1 min-w-0">
          <h3 className="text-lg font-semibold text-gray-100">{title}</h3>
          <p className="text-sm text-gray-400 mt-1">{description}</p>
          <p className="text-xs text-purple-400 mt-2 flex items-center gap-1">
            <ImageIconLucide className="h-3 w-3" />
            {recommendations}
          </p>

          <div className="mt-4">
            {/* SIMPLE TEST - just alert on change */}
            <input
              type="file"
              accept="image/*"
              style={{ border: '2px solid red', padding: '10px' }}
              onInput={(e: any) => {
                window.alert('onInput fired! File: ' + (e.target.files?.[0]?.name || 'none'));
              }}
              onChange={(e: any) => {
                window.alert('onChange fired! File: ' + (e.target.files?.[0]?.name || 'none'));
                const file = e.target.files?.[0];
                if (file) {
                  console.log(`[Upload] File selected for ${field}:`, file.name, file.size);
                  toast.info(`Uploading ${file.name}...`);
                  handleFileUpload(field, file);
                }
              }}
            />
            {uploading[field] && (
              <div className="flex items-center gap-2 mt-2 text-purple-400 text-sm">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Uploading...
              </div>
            )}
          </div>

          {currentPath && (
            <p className="text-xs text-gray-600 mt-3 font-mono truncate">
              {currentPath}
            </p>
          )}
        </div>
      </div>
    </div>
  );

  if (isFetching) {
    return (
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-6">
        <div className="flex items-center justify-center py-12">
          <RefreshCw className="h-8 w-8 text-purple-400 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-purple-500/50 rounded-2xl shadow-2xl shadow-purple-500/10 overflow-hidden">
        <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-16 w-16 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Palette className="h-8 w-8 text-purple-600" />
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-bold text-white flex items-center gap-2">
                Branding & Images
              </h2>
              <p className="text-purple-100 mt-1">
                Upload custom logos and images for white-label branding
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Content */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl p-8 shadow-xl">

      <div className="space-y-4">
        <ImageUploadCard
          title="App Logo"
          description="Main application logo displayed in header and navigation"
          field="appLogo"
          currentPath={images.appLogo}
          recommendations="Recommended: 150x50px, PNG with transparency"
        />

        <ImageUploadCard
          title="Email Logo"
          description="Logo used in email templates (welcome, alerts, summaries)"
          field="emailLogo"
          currentPath={images.emailLogo}
          recommendations="Recommended: 150x50px, PNG with transparency"
        />

        <ImageUploadCard
          title="Profile Image"
          description="Default user profile avatar image"
          field="profileImage"
          currentPath={images.profileImage}
          recommendations="Recommended: 200x200px, Square format, PNG"
        />

        <ImageUploadCard
          title="Dashboard Preview"
          description="Preview image used in welcome emails"
          field="dashboardPreview"
          currentPath={images.dashboardPreview}
          recommendations="Recommended: 600x400px, JPEG or PNG"
        />

        <ImageUploadCard
          title="Favicon"
          description="Browser tab icon for the application (appears in browser tabs and bookmarks)"
          field="favicon"
          currentPath={images.favicon}
          recommendations="Recommended: 32x32px or 64x64px, ICO, PNG, or SVG"
        />
      </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-blue-400 mt-0.5" />
            <div>
              <h4 className="text-sm font-semibold text-blue-400">Storage Information</h4>
              <p className="text-xs text-gray-400 mt-1">
                Images are stored in <code className="bg-gray-700 px-2 py-0.5 rounded text-blue-300">public/assets/images/</code> and will be used throughout the application automatically.
              </p>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <Button
          onClick={handleSave}
          disabled={isLoading}
          className="w-full mt-6 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-white font-bold h-14 text-lg shadow-lg shadow-purple-500/50"
        >
          <Save className="h-5 w-5 mr-2" />
          {isLoading ? 'Saving Changes...' : 'Save Image Configuration'}
        </Button>
      </div>

      {/* Auth Page Branding Section */}
      <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-gradient-to-r from-indigo-500 to-indigo-600 p-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="absolute inset-0 bg-white rounded-xl blur-lg opacity-50"></div>
              <div className="relative h-14 w-14 bg-white rounded-xl flex items-center justify-center shadow-xl">
                <Users className="h-7 w-7 text-indigo-600" />
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                Auth Page Branding
              </h2>
              <p className="text-indigo-100 mt-1">
                Customize the login & signup page testimonial and image
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Testimonial Quote */}
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <Quote className="h-4 w-4 text-indigo-400" />
              Testimonial Quote
            </Label>
            <Textarea
              value={authSettings.authPageTestimonialText}
              onChange={(e) => setAuthSettings(prev => ({ ...prev, authPageTestimonialText: e.target.value }))}
              className="bg-gray-900 border-gray-700 text-white min-h-[100px]"
              placeholder="Chatvolt turned my watchlist into a winning list..."
            />
          </div>

          {/* Author & Role */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-gray-300">Author Name</Label>
              <Input
                value={authSettings.authPageTestimonialAuthor}
                onChange={(e) => setAuthSettings(prev => ({ ...prev, authPageTestimonialAuthor: e.target.value }))}
                className="bg-gray-900 border-gray-700 text-white"
                placeholder="- Ethan R."
              />
            </div>
            <div className="space-y-2">
              <Label className="text-gray-300">Author Role</Label>
              <Input
                value={authSettings.authPageTestimonialRole}
                onChange={(e) => setAuthSettings(prev => ({ ...prev, authPageTestimonialRole: e.target.value }))}
                className="bg-gray-900 border-gray-700 text-white"
                placeholder="Retail Investor"
              />
            </div>
          </div>

          {/* Star Rating */}
          <div className="space-y-2">
            <Label className="text-gray-300 flex items-center gap-2">
              <Star className="h-4 w-4 text-yellow-400" />
              Star Rating (1-5)
            </Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={authSettings.authPageTestimonialRating}
                onChange={(e) => setAuthSettings(prev => ({ ...prev, authPageTestimonialRating: Math.min(5, Math.max(0, parseInt(e.target.value) || 0)) }))}
                className="bg-gray-900 border-gray-700 text-white w-24"
                min={0}
                max={5}
              />
              <span className="text-xs text-gray-500">(0 = hide stars)</span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-5 w-5 ${star <= authSettings.authPageTestimonialRating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-600'}`}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Auth Page Dashboard Image */}
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
            <div className="flex items-start gap-6">
              {/* Preview */}
              <div className="flex-shrink-0">
                {authSettings.authPageDashboardImage ? (
                  <div className="relative h-32 w-48 bg-gray-900 border-2 border-gray-700 rounded-xl overflow-hidden shadow-lg">
                    <Image
                      src={authSettings.authPageDashboardImage}
                      alt="Auth Page Dashboard"
                      fill
                      className="object-contain p-2"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="h-32 w-48 bg-gray-900 border-2 border-dashed border-gray-600 rounded-xl flex items-center justify-center">
                    <ImageIconLucide className="h-12 w-12 text-gray-600" />
                  </div>
                )}
              </div>

              {/* Info & Upload */}
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-semibold text-gray-100">Auth Page Dashboard Image</h3>
                <p className="text-sm text-gray-400 mt-1">
                  The dashboard preview shown on the right side of login/signup pages
                </p>
                <p className="text-xs text-indigo-400 mt-2 flex items-center gap-1">
                  <ImageIconLucide className="h-3 w-3" />
                  Recommended: 1440x1150px, PNG or JPEG
                </p>

                <div className="mt-4">
                  <input
                    type="file"
                    id="upload-authPageDashboardImage"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleAuthImageUpload(file);
                    }}
                  />
                  <label htmlFor="upload-authPageDashboardImage">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={uploading.authPageDashboardImage}
                      className="cursor-pointer border-indigo-500 text-indigo-400 hover:bg-indigo-500 hover:text-white"
                      asChild
                    >
                      <span>
                        {uploading.authPageDashboardImage ? (
                          <>
                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="h-4 w-4 mr-2" />
                            Upload New
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>

                {authSettings.authPageDashboardImage && (
                  <p className="text-xs text-gray-600 mt-3 font-mono truncate">
                    {authSettings.authPageDashboardImage}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Save Auth Settings Button */}
          <Button
            onClick={handleSaveAuthSettings}
            disabled={isLoading}
            className="w-full bg-gradient-to-r from-indigo-500 to-indigo-600 hover:from-indigo-600 hover:to-indigo-700 text-white font-bold h-14 text-lg shadow-lg shadow-indigo-500/50"
          >
            <Save className="h-5 w-5 mr-2" />
            {isLoading ? 'Saving...' : 'Save Auth Page Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}
