'use client';

import { cn } from '@/lib/utils';
import { User } from 'lucide-react';

interface AvatarWithFrameProps {
  avatarUrl?: string | null;
  frameUrl?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
  showFallback?: boolean;
}

const SIZES = {
  xs: { container: 'w-6 h-6', avatar: 'w-[70%] h-[70%]', icon: 'w-3 h-3' },
  sm: { container: 'w-8 h-8', avatar: 'w-[70%] h-[70%]', icon: 'w-4 h-4' },
  md: { container: 'w-10 h-10', avatar: 'w-[70%] h-[70%]', icon: 'w-5 h-5' },
  lg: { container: 'w-12 h-12', avatar: 'w-[70%] h-[70%]', icon: 'w-6 h-6' },
  xl: { container: 'w-16 h-16', avatar: 'w-[70%] h-[70%]', icon: 'w-8 h-8' },
  '2xl': { container: 'w-24 h-24', avatar: 'w-[70%] h-[70%]', icon: 'w-10 h-10' },
};

/**
 * AvatarWithFrame Component
 * 
 * Displays a user's avatar with an optional decorative frame overlay.
 * The frame PNG should have a transparent center where the avatar shows through.
 * 
 * Usage:
 * <AvatarWithFrame 
 *   avatarUrl="/path/to/avatar.jpg" 
 *   frameUrl="/path/to/frame.png" 
 *   size="lg" 
 * />
 */
export default function AvatarWithFrame({
  avatarUrl,
  frameUrl,
  name,
  size = 'md',
  className,
  showFallback = true,
}: AvatarWithFrameProps) {
  const sizeConfig = SIZES[size];
  const initials = name?.charAt(0)?.toUpperCase() || '?';

  return (
    <div 
      className={cn(
        'relative flex-shrink-0',
        sizeConfig.container,
        className
      )}
    >
      {/* Avatar Layer (bottom) */}
      <div 
        className={cn(
          'absolute inset-0 flex items-center justify-center',
          frameUrl ? '' : 'rounded-full overflow-hidden'
        )}
      >
        <div 
          className={cn(
            'rounded-full overflow-hidden flex items-center justify-center bg-gray-800',
            frameUrl ? sizeConfig.avatar : 'w-full h-full'
          )}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name || 'Avatar'}
              className="w-full h-full object-cover"
              onError={(e) => {
                // Hide broken images
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : showFallback ? (
            <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-cyan-500/20 to-blue-500/20">
              {name ? (
                <span className="text-cyan-400 font-semibold" style={{ fontSize: `calc(${sizeConfig.container.split(' ')[0].replace('w-', '')} * 0.4rem)` }}>
                  {initials}
                </span>
              ) : (
                <User className={cn(sizeConfig.icon, 'text-gray-500')} />
              )}
            </div>
          ) : null}
        </div>
      </div>

      {/* Frame Layer (top) - only rendered if frameUrl exists */}
      {frameUrl && (
        <div className="absolute inset-0 pointer-events-none z-10">
          <img
            src={frameUrl}
            alt="Profile Frame"
            className="w-full h-full object-contain"
            onError={(e) => {
              // Hide broken frame images
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * Hook to get user's avatar and frame data
 * Can be used to fetch this data from context or API
 */
export function useAvatarWithFrame(userId?: string) {
  // This could be expanded to fetch from a context or API
  // For now, it's a placeholder that can be enhanced later
  return {
    avatarUrl: null,
    frameUrl: null,
  };
}
