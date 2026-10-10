#!/usr/bin/env node
/**
 * Optimize Marketplace Images Script
 * 
 * This script finds all marketplace images and optimizes them:
 * - Resizes based on cosmetic type
 * - Converts to WebP format
 * - Reduces file size significantly
 * 
 * Usage: node scripts/optimize-marketplace-images.mjs [--dry-run]
 */

import { readdir, stat, rename, unlink } from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

// Image optimization settings based on cosmetic type
const IMAGE_SETTINGS = {
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
  './public/uploads/marketplace',
];

async function findMarketplaceDir() {
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

function getCosmeticType(filename) {
  const lower = filename.toLowerCase();
  if (lower.startsWith('avatar')) return 'avatar';
  if (lower.startsWith('badge')) return 'badge';
  if (lower.startsWith('border')) return 'border';
  if (lower.startsWith('background')) return 'background';
  if (lower.startsWith('effect')) return 'effect';
  return 'default';
}

async function optimizeImage(filePath, dryRun = false) {
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase();
  
  // Skip if already WebP and small
  const fileStats = await stat(filePath);
  if (ext === '.webp' && fileStats.size < 100 * 1024) { // Skip WebP under 100KB
    console.log(`⏭️  Skip (already optimized): ${filename}`);
    return { skipped: true, reason: 'already optimized' };
  }
  
  const cosmeticType = getCosmeticType(filename);
  const settings = IMAGE_SETTINGS[cosmeticType] || IMAGE_SETTINGS.default;
  
  console.log(`\n📷 Processing: ${filename}`);
  console.log(`   Type: ${cosmeticType}, Target: ${settings.width}x${settings.height}, Quality: ${settings.quality}`);
  console.log(`   Original size: ${(fileStats.size / 1024).toFixed(1)} KB`);
  
  if (dryRun) {
    console.log(`   [DRY RUN] Would optimize this file`);
    return { dryRun: true };
  }
  
  try {
    // Read and optimize
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
    
    // Generate new filename (replace extension with .webp)
    const newFilename = filename.replace(/\.[^.]+$/, '.webp');
    const newFilePath = path.join(path.dirname(filePath), newFilename);
    
    // Write optimized file
    await sharp(optimizedBuffer).toFile(newFilePath);
    
    const newStats = await stat(newFilePath);
    const savedBytes = fileStats.size - newStats.size;
    const savedPercent = ((savedBytes / fileStats.size) * 100).toFixed(1);
    
    console.log(`   ✅ Optimized: ${(newStats.size / 1024).toFixed(1)} KB (saved ${savedPercent}%)`);
    
    // Delete original if it's different from new file
    if (filePath !== newFilePath) {
      await unlink(filePath);
      console.log(`   🗑️  Deleted original: ${filename}`);
    }
    
    return {
      success: true,
      originalSize: fileStats.size,
      newSize: newStats.size,
      savedBytes,
      savedPercent: parseFloat(savedPercent),
    };
  } catch (error) {
    console.error(`   ❌ Error: ${error.message}`);
    return { error: error.message };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  
  console.log('🖼️  Marketplace Image Optimizer');
  console.log('================================');
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No files will be modified\n');
  }
  
  const marketplaceDir = await findMarketplaceDir();
  if (!marketplaceDir) {
    console.error('❌ No marketplace directory found!');
    console.log('   Checked:', MARKETPLACE_DIRS.join(', '));
    process.exit(1);
  }
  
  console.log(`📁 Found marketplace directory: ${marketplaceDir}\n`);
  
  // Get all files
  const files = await readdir(marketplaceDir);
  const imageFiles = files.filter(f => 
    /\.(jpg|jpeg|png|gif|webp|bmp|tiff)$/i.test(f)
  );
  
  console.log(`📊 Found ${imageFiles.length} images to process\n`);
  
  if (imageFiles.length === 0) {
    console.log('✨ No images to optimize!');
    return;
  }
  
  // Process each file
  const results = {
    processed: 0,
    skipped: 0,
    errors: 0,
    totalSaved: 0,
  };
  
  for (const file of imageFiles) {
    const filePath = path.join(marketplaceDir, file);
    const result = await optimizeImage(filePath, dryRun);
    
    if (result.skipped) {
      results.skipped++;
    } else if (result.error) {
      results.errors++;
    } else if (result.success) {
      results.processed++;
      results.totalSaved += result.savedBytes;
    }
  }
  
  // Summary
  console.log('\n================================');
  console.log('📊 SUMMARY');
  console.log('================================');
  console.log(`✅ Optimized: ${results.processed} files`);
  console.log(`⏭️  Skipped: ${results.skipped} files`);
  console.log(`❌ Errors: ${results.errors} files`);
  if (results.totalSaved > 0) {
    console.log(`💾 Total saved: ${(results.totalSaved / 1024 / 1024).toFixed(2)} MB`);
  }
  
  if (dryRun) {
    console.log('\n💡 Run without --dry-run to actually optimize files');
  }
}

main().catch(console.error);
