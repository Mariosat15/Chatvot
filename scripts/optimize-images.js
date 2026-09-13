#!/usr/bin/env node
/**
 * Image Optimization Script
 * 
 * Compresses and optimizes images to a target file size (default: 100KB).
 * 
 * Usage:
 *   node scripts/optimize-images.js                    # Interactive mode
 *   node scripts/optimize-images.js ./public/icons    # Specific folder
 *   node scripts/optimize-images.js --all             # All common image folders
 * 
 * Options:
 *   --target=100     Target max file size in KB (default: 100KB)
 *   --max-width=800  Set max width (default: auto-resize to fit target)
 *   --backup         Create backups before overwriting
 *   --dry-run        Show what would be done without doing it
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Try to load sharp, install if not present
let sharp;
try {
  sharp = require('sharp');
} catch (e) {
  console.log('📦 Sharp not found. Installing...');
  require('child_process').execSync('npm install sharp --save-dev', { stdio: 'inherit' });
  sharp = require('sharp');
}

// Configuration
const CONFIG = {
  targetSizeKB: 10,  // Target max file size in KB
  maxWidth: null,
  backup: false,
  dryRun: false,
  supportedFormats: ['.png', '.jpg', '.jpeg', '.webp', '.gif'],
};

// Common image folders in the project
const COMMON_FOLDERS = [
  'public/game-icons',
  'public/icons',
  'public/images',
  'public/assets',
  'public/assets/images',
  'apps/admin/public/images',
];

// Parse command line arguments
const args = process.argv.slice(2);
let targetFolder = null;
let processAll = false;

args.forEach(arg => {
  if (arg === '--all') {
    processAll = true;
  } else if (arg === '--backup') {
    CONFIG.backup = true;
  } else if (arg === '--dry-run') {
    CONFIG.dryRun = true;
  } else if (arg.startsWith('--target=')) {
    CONFIG.targetSizeKB = parseInt(arg.split('=')[1]) || 100;
  } else if (arg.startsWith('--max-width=')) {
    CONFIG.maxWidth = parseInt(arg.split('=')[1]) || null;
  } else if (!arg.startsWith('--')) {
    targetFolder = arg;
  }
});

// Utility functions
function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function getImageFiles(folder) {
  const files = [];
  
  if (!fs.existsSync(folder)) {
    return files;
  }
  
  const items = fs.readdirSync(folder, { withFileTypes: true });
  
  for (const item of items) {
    const fullPath = path.join(folder, item.name);
    
    if (item.isDirectory()) {
      files.push(...getImageFiles(fullPath));
    } else if (item.isFile()) {
      const ext = path.extname(item.name).toLowerCase();
      if (CONFIG.supportedFormats.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

async function optimizeImage(filePath) {
  const stats = fs.statSync(filePath);
  const originalSize = stats.size;
  const ext = path.extname(filePath).toLowerCase();
  const targetBytes = CONFIG.targetSizeKB * 1024;
  
  // Skip if already under target size
  if (originalSize <= targetBytes) {
    return { skipped: true, reason: `Already under ${CONFIG.targetSizeKB}KB`, originalSize };
  }
  
  // Skip GIFs (limited compression)
  if (ext === '.gif') {
    return { skipped: true, reason: 'GIF (limited compression)', originalSize };
  }
  
  try {
    const imageBuffer = fs.readFileSync(filePath);
    const metadata = await sharp(imageBuffer).metadata();
    
    let outputBuffer;
    let bestBuffer = null;
    let bestSize = Infinity;
    
    // Calculate initial resize based on how much we need to compress
    const compressionRatio = targetBytes / originalSize;
    let currentWidth = metadata.width;
    
    // If we need heavy compression, start with aggressive resize
    if (compressionRatio < 0.3) {
      // Need to reduce to less than 30% - start smaller
      currentWidth = Math.floor(metadata.width * Math.sqrt(compressionRatio) * 1.5);
    } else if (compressionRatio < 0.5) {
      currentWidth = Math.floor(metadata.width * 0.7);
    }
    
    // Ensure minimum width
    currentWidth = Math.max(currentWidth, 50);
    
    // Apply user's max width constraint
    if (CONFIG.maxWidth) {
      currentWidth = Math.min(CONFIG.maxWidth, currentWidth);
    }
    
    // Try multiple quality/size combinations to hit target
    const qualityLevels = [85, 70, 55, 40, 30, 20];
    const widthMultipliers = [1.0, 0.8, 0.6, 0.5, 0.4, 0.3];
    
    for (const widthMult of widthMultipliers) {
      const targetWidth = Math.max(50, Math.floor(currentWidth * widthMult));
      
      for (const quality of qualityLevels) {
        let image = sharp(imageBuffer);
        
        // Resize
        if (targetWidth < metadata.width) {
          image = image.resize(targetWidth, null, {
            withoutEnlargement: true,
            fit: 'inside',
          });
        }
        
        // Apply compression based on format
        if (ext === '.png') {
          outputBuffer = await image
            .png({
              compressionLevel: 9,
              palette: true,
              colors: Math.max(16, Math.floor(256 * (quality / 100))),
            })
            .toBuffer();
        } else if (ext === '.jpg' || ext === '.jpeg') {
          outputBuffer = await image
            .jpeg({
              quality: quality,
              mozjpeg: true,
            })
            .toBuffer();
        } else if (ext === '.webp') {
          outputBuffer = await image
            .webp({
              quality: quality,
            })
            .toBuffer();
        } else {
          return { skipped: true, reason: 'Unsupported format', originalSize };
        }
        
        // Track best result
        if (outputBuffer.length < bestSize) {
          bestSize = outputBuffer.length;
          bestBuffer = outputBuffer;
        }
        
        // Check if we hit target
        if (outputBuffer.length <= targetBytes) {
          break;
        }
      }
      
      // If we hit target, stop trying
      if (bestSize <= targetBytes) {
        break;
      }
    }
    
    // Use best result we found
    outputBuffer = bestBuffer;
    const newSize = outputBuffer.length;
    
    // Only save if we actually made it smaller
    if (newSize < originalSize) {
      if (!CONFIG.dryRun) {
        // Create backup if requested
        if (CONFIG.backup) {
          const backupPath = filePath + '.backup';
          fs.copyFileSync(filePath, backupPath);
        }
        
        // Write optimized image
        fs.writeFileSync(filePath, outputBuffer);
      }
      
      return {
        success: true,
        originalSize,
        newSize,
        saved: originalSize - newSize,
        percentage: Math.round((1 - newSize / originalSize) * 100),
        underTarget: newSize <= targetBytes,
      };
    } else {
      return {
        skipped: true,
        reason: 'Already optimized',
        originalSize,
      };
    }
  } catch (error) {
    return {
      error: true,
      message: error.message,
      originalSize,
    };
  }
}

async function processFolder(folder) {
  console.log(`\n📁 Processing: ${folder}`);
  console.log('─'.repeat(50));
  
  const files = getImageFiles(folder);
  
  if (files.length === 0) {
    console.log('   No images found.');
    return { totalFiles: 0, totalSaved: 0 };
  }
  
  let totalSaved = 0;
  let optimizedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  let underTargetCount = 0;
  
  for (const file of files) {
    const relativePath = path.relative(process.cwd(), file);
    const result = await optimizeImage(file);
    
    if (result.success) {
      const targetStatus = result.underTarget ? '✅' : '⚠️';
      const sizeIndicator = result.newSize <= CONFIG.targetSizeKB * 1024 ? '🎯' : '📦';
      console.log(`   ${targetStatus} ${relativePath}`);
      console.log(`      ${formatBytes(result.originalSize)} → ${formatBytes(result.newSize)} (−${result.percentage}%) ${sizeIndicator}`);
      if (!result.underTarget) {
        console.log(`      ⚠️  Could not reduce below ${CONFIG.targetSizeKB}KB (min achievable)`);
      }
      totalSaved += result.saved;
      optimizedCount++;
      if (result.underTarget) underTargetCount++;
    } else if (result.skipped) {
      console.log(`   ⏭️  ${relativePath} - ${result.reason}`);
      skippedCount++;
    } else if (result.error) {
      console.log(`   ❌ ${relativePath} - Error: ${result.message}`);
      errorCount++;
    }
  }
  
  return {
    totalFiles: files.length,
    optimizedCount,
    skippedCount,
    errorCount,
    totalSaved,
    underTargetCount,
  };
}

async function selectFolderInteractive() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  
  // Find existing folders
  const existingFolders = COMMON_FOLDERS.filter(f => fs.existsSync(f));
  
  console.log('\n🖼️  Image Optimization Script');
  console.log('═'.repeat(50));
  console.log('\nAvailable folders:');
  
  existingFolders.forEach((folder, index) => {
    const files = getImageFiles(folder);
    console.log(`  ${index + 1}. ${folder} (${files.length} images)`);
  });
  
  console.log(`  ${existingFolders.length + 1}. Enter custom path`);
  console.log(`  ${existingFolders.length + 2}. Process ALL folders`);
  console.log(`  0. Exit`);
  
  return new Promise((resolve) => {
    rl.question('\nSelect option: ', async (answer) => {
      const choice = parseInt(answer);
      
      if (choice === 0) {
        rl.close();
        resolve(null);
        return;
      }
      
      if (choice >= 1 && choice <= existingFolders.length) {
        rl.close();
        resolve([existingFolders[choice - 1]]);
        return;
      }
      
      if (choice === existingFolders.length + 1) {
        rl.question('Enter folder path: ', (customPath) => {
          rl.close();
          resolve([customPath]);
        });
        return;
      }
      
      if (choice === existingFolders.length + 2) {
        rl.close();
        resolve(existingFolders);
        return;
      }
      
      console.log('Invalid choice.');
      rl.close();
      resolve(null);
    });
  });
}

async function main() {
  console.log('\n🚀 Image Optimizer for Chartvolt');
  console.log(`   Target Size: ${CONFIG.targetSizeKB}KB max`);
  if (CONFIG.maxWidth) console.log(`   Max Width: ${CONFIG.maxWidth}px`);
  if (CONFIG.backup) console.log('   Backup: Enabled');
  if (CONFIG.dryRun) console.log('   Mode: DRY RUN (no changes)');
  
  let foldersToProcess = [];
  
  if (targetFolder) {
    foldersToProcess = [targetFolder];
  } else if (processAll) {
    foldersToProcess = COMMON_FOLDERS.filter(f => fs.existsSync(f));
  } else {
    foldersToProcess = await selectFolderInteractive();
  }
  
  if (!foldersToProcess || foldersToProcess.length === 0) {
    console.log('\n👋 Exiting.');
    return;
  }
  
  let grandTotalSaved = 0;
  let grandTotalFiles = 0;
  let grandTotalOptimized = 0;
  let grandTotalUnderTarget = 0;
  
  for (const folder of foldersToProcess) {
    if (fs.existsSync(folder)) {
      const result = await processFolder(folder);
      grandTotalSaved += result.totalSaved;
      grandTotalFiles += result.totalFiles;
      grandTotalOptimized += result.optimizedCount || 0;
      grandTotalUnderTarget += result.underTargetCount || 0;
    } else {
      console.log(`\n⚠️  Folder not found: ${folder}`);
    }
  }
  
  // Summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 SUMMARY');
  console.log('═'.repeat(50));
  console.log(`   Target size: ${CONFIG.targetSizeKB}KB`);
  console.log(`   Total files scanned: ${grandTotalFiles}`);
  console.log(`   Files optimized: ${grandTotalOptimized}`);
  console.log(`   Files under target: ${grandTotalUnderTarget} 🎯`);
  console.log(`   Total space saved: ${formatBytes(grandTotalSaved)}`);
  
  if (CONFIG.dryRun) {
    console.log('\n⚠️  DRY RUN - No files were modified.');
    console.log('   Run without --dry-run to apply changes.');
  }
  
  console.log('\n✨ Done!\n');
}

// Run
main().catch(console.error);
