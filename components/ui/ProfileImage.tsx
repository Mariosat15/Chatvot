'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';

interface ProfileImageProps {
  src?: string | null;
  alt?: string;
  fallbackLetter: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  fallbackClassName?: string;
}

const sizeClasses = {
  sm: 'w-8 h-8 text-sm',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-2xl',
  xl: 'w-24 h-24 text-4xl',
};

/**
 * Profile image component with automatic fallback to initial letter
 * when image fails to load or is not provided.
 */
export default function ProfileImage({
  src,
  alt = '',
  fallbackLetter,
  size = 'md',
  className,
  fallbackClassName,
}: ProfileImageProps) {
  const [hasError, setHasError] = useState(false);
  const showImage = src && !hasError;

  return (
    <div
      className={cn(
        'rounded-full overflow-hidden flex items-center justify-center font-bold',
        sizeClasses[size],
        !showImage && (fallbackClassName || 'bg-gradient-to-br from-primary-500/30 to-cyan-500/30 text-primary-400 border border-primary-500/30'),
        className
      )}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover"
          onError={() => setHasError(true)}
        />
      ) : (
        <span>{fallbackLetter.charAt(0).toUpperCase()}</span>
      )}
    </div>
  );
}
