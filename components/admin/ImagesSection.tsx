'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Upload, RefreshCw, Image as ImageIconLucide, Info, Palette } from 'lucide-react';
import Image from 'next/image';

interface ImageSettings {
  appLogo: string;
  emailLogo: string;
  profileImage: string;
  dashboardPreview: string;
}

export default function ImagesSection() {
  const [images, setImages] = useState<ImageSettings>({
    appLogo: '',
    emailLogo: '',
    profileImage: '',
    dashboardPreview: '',
  });
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  useEffect(() => {
    fetchImages();
  }, []);

  const fetchImages = async () => {
    setIsFetching(true);
    try {
      const response = await fetch('/api/admin/images');
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

  const handleFileUpload = async (
    field: keyof ImageSettings,
    file: File
  ) => {
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

      const response = await fetch('/api/admin/images/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        setImages((prev) => ({ ...prev, [field]: data.path }));
        toast.success(`${field} uploaded successfully`);
      } else {
        toast.error(data.error || 'Upload failed');
      }
    } catch (error) {
      toast.error('An error occurred during upload');
    } finally {
      setUploading((prev) => ({ ...prev, [field]: false }));
    }
  };

  const handleSave = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/admin/images', {
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
              <Image
                src={currentPath}
                alt={title}
                fill
                className="object-contain p-3"
                unoptimized
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
            <input
              type="file"
              id={`upload-${field}`}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileUpload(field, file);
              }}
            />
            <label htmlFor={`upload-${field}`}>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading[field]}
                className="cursor-pointer border-purple-500 text-purple-400 hover:bg-purple-500 hover:text-white"
                asChild
              >
                <span>
                  {uploading[field] ? (
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
    </div>
  );
}

