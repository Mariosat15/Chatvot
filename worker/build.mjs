/**
 * Worker Build Script
 * 
 * Bundles the worker into a single production-ready JavaScript file
 * using esbuild. This handles all imports and produces optimized output.
 */

import * as esbuild from 'esbuild';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function build() {
  console.log('🔨 Building worker for production...');
  
  try {
    const result = await esbuild.build({
      entryPoints: [path.join(__dirname, 'index.ts')],
      bundle: true,
      platform: 'node',
      target: 'node18',
      outfile: path.join(__dirname, '..', 'dist', 'worker', 'index.js'),
      format: 'cjs',
      sourcemap: true,
      minify: false, // Keep readable for debugging
      external: [
        // Keep native modules external
        'mongoose',
        'mongodb',
        'agenda',
        'bcryptjs',
        'dotenv',
        // Keep optional peer deps external
        'bufferutil',
        'utf-8-validate',
        // Reason: jsdom (pulled in via isomorphic-dompurify) uses
        // require.resolve('./xhr-sync-worker.js') at runtime. Bundling it
        // breaks that lookup and triggers the esbuild "require-resolve-not-external"
        // warning. Keep it external so Node resolves the worker file from
        // node_modules at runtime.
        'jsdom',
        'isomorphic-dompurify',
        // canvas is an optional peer dep of jsdom — keep external to match.
        'canvas',
      ],
      logLevel: 'info',
    });
    
    console.log('✅ Worker build complete!');
    console.log(`   Output: dist/worker/index.js`);
    
    if (result.warnings.length > 0) {
      console.log('⚠️  Warnings:', result.warnings);
    }
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

build();

