'use server';

import { NextRequest, NextResponse } from 'next/server';
import { readdir, stat, unlink, writeFile } from 'fs/promises';
import path from 'path';

// Dynamically import sharp to handle potential import issues
async function getSharp() {
  try {
    const sharp = (await import('sharp')).default;
    return sharp;
  } catch {
    return null;
  }
}

// Image optimization settings based on cosmetic type
const IMAGE_SETTINGS: Record<string, { width: number; height: number; quality: number }> = {
  avatar: { width: 256, height: 256, quality: 85 },
  badge: { width: 128, height: 128, quality: 85 },
  border: { width: 512, height: 512, quality: 80 },
  background: { width: 1920, height: 1080, quality: 75 },
  effect: { width: 512, height: 512, quality: 80 },
  default: { width: 512, height: 512, quality: 80 },
};

// Paths to check for marketplace images
const MARKETPLACE_DIRS = [
  '/var/www/chartvolt/public/uploads/marketplace',
  path.join(process.cwd(), '..', '..', 'public', 'uploads', 'marketplace'),
  path.join(process.cwd(), 'public', 'uploads', 'marketplace'),
];

async function findMarketplaceDir(): Promise<string | null> {
  for (const dir of MARKETPLACE_DIRS) {
    try {
      await stat(dir);
      return dir;
    } catch {
      continue;
    }
  }
  return null;
}

function getCosmeticType(filename: string): string {
  const lower = filename.toLowerCase();
  if (lower.startsWith('avatar')) return 'avatar';
  if (lower.startsWith('badge')) return 'badge';
  if (lower.startsWith('border')) return 'border';
  if (lower.startsWith('background')) return 'background';
  if (lower.startsWith('effect')) return 'effect';
  return 'default';
}

interface ImageInfo {
  filename: string;
  size: number;
  cosmeticType: string;
  isOptimized: boolean;
  canOptimize: boolean;
}

interface OptimizeResult {
  filename: string;
  originalSize: number;
  newSize: number;
  savedBytes: number;
  savedPercent: number;
  newFilename: string;
  success: boolean;
  error?: string;
}

// GET - Scan images and return stats
export async function GET() {
  try {
    const marketplaceDir = await findMarketplaceDir();
    
    if (!marketplaceDir) {
      return NextResponse.json({
        success: false,
        error: 'No marketplace directory found',
        checkedDirs: MARKETPLACE_DIRS,
      }, { status: 404 });
    }

    const files = await readdir(marketplaceDir);
    const imageFiles = files.filter(f => 
      /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f)
    );

    const images: ImageInfo[] = [];
    let totalSize = 0;
    let optimizableSize = 0;
    let optimizedCount = 0;

    for (const filename of imageFiles) {
      const filePath = path.join(marketplaceDir, filename);
      const fileStats = await stat(filePath);
      const ext = path.extname(filename).toLowerCase();
      const cosmeticType = getCosmeticType(filename);
      
      // Consider optimized if WebP and under 100KB
      const isOptimized = ext === '.webp' && fileStats.size < 100 * 1024;
      const canOptimize = !isOptimized && fileStats.size > 10 * 1024; // Skip tiny files
      
      images.push({
        filename,
        size: fileStats.size,
        cosmeticType,
        isOptimized,
        canOptimize,
      });

      totalSize += fileStats.size;
      if (canOptimize) {
        optimizableSize += fileStats.size;
      }
      if (isOptimized) {
        optimizedCount++;
      }
    }

    // Sort by size descending
    images.sort((a, b) => b.size - a.size);

    return NextResponse.json({
      success: true,
      directory: marketplaceDir,
      stats: {
        totalImages: images.length,
        totalSize,
        totalSizeFormatted: formatBytes(totalSize),
        optimizedCount,
        needsOptimization: images.filter(i => i.canOptimize).length,
        potentialSavings: formatBytes(optimizableSize * 0.7), // Estimate 70% savings
      },
      images: images.slice(0, 50), // Return top 50 largest
    });
  } catch (error) {
    console.error('Error scanning images:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

// POST - Optimize images
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { mode = 'all', filenames = [] } = body;
    
    const sharp = await getSharp();
    if (!sharp) {
      return NextResponse.json({
        success: false,
        error: 'Sharp library not available. Run: npm install sharp',
      }, { status: 500 });
    }

    const marketplaceDir = await findMarketplaceDir();
    if (!marketplaceDir) {
      return NextResponse.json({
        success: false,
        error: 'No marketplace directory found',
      }, { status: 404 });
    }

    const files = await readdir(marketplaceDir);
    const imageFiles = files.filter(f => 
      /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f)
    );

    // Filter based on mode
    let filesToProcess: string[];
    if (mode === 'selected' && filenames.length > 0) {
      filesToProcess = imageFiles.filter(f => filenames.includes(f));
    } else {
      // Process all non-optimized images
      filesToProcess = [];
      for (const filename of imageFiles) {
        const filePath = path.join(marketplaceDir, filename);
        const fileStats = await stat(filePath);
        const ext = path.extname(filename).toLowerCase();
        const isOptimized = ext === '.webp' && fileStats.size < 100 * 1024;
        if (!isOptimized && fileStats.size > 10 * 1024) {
          filesToProcess.push(filename);
        }
      }
    }

    const results: OptimizeResult[] = [];
    let totalSaved = 0;

    for (const filename of filesToProcess) {
      const filePath = path.join(marketplaceDir, filename);
      
      try {
        const fileStats = await stat(filePath);
        const cosmeticType = getCosmeticType(filename);
        const settings = IMAGE_SETTINGS[cosmeticType] || IMAGE_SETTINGS.default;

        // Optimize
        const optimizedBuffer = await sharp(filePath)
          .resize(settings.width, settings.height, {
            fit: 'inside',
            withoutEnlargement: true,
          })
          .webp({
            quality: settings.quality,
            effort: 4,
          })
          .toBuffer();

        // Generate new filename
        const newFilename = filename.replace(/\.[^.]+$/, '.webp');
        const newFilePath = path.join(marketplaceDir, newFilename);

        // Write optimized file
        await writeFile(newFilePath, optimizedBuffer);

        const savedBytes = fileStats.size - optimizedBuffer.length;
        const savedPercent = (savedBytes / fileStats.size) * 100;
        totalSaved += savedBytes;

        // Delete original if different
        if (filePath !== newFilePath) {
          await unlink(filePath);
        }

        results.push({
          filename,
          originalSize: fileStats.size,
          newSize: optimizedBuffer.length,
          savedBytes,
          savedPercent,
          newFilename,
          success: true,
        });

        console.log(`✅ Optimized ${filename}: ${formatBytes(fileStats.size)} → ${formatBytes(optimizedBuffer.length)} (${savedPercent.toFixed(1)}% saved)`);
      } catch (error) {
        results.push({
          filename,
          originalSize: 0,
          newSize: 0,
          savedBytes: 0,
          savedPercent: 0,
          newFilename: filename,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
        console.error(`❌ Failed to optimize ${filename}:`, error);
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      totalSaved,
      totalSavedFormatted: formatBytes(totalSaved),
      results,
    });
  } catch (error) {
    console.error('Error optimizing images:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
