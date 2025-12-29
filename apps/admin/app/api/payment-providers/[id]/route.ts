import { NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import PaymentProvider from '@/database/models/payment-provider.model';
import { requireAdminAuth } from '@/lib/admin/auth';
import * as fs from 'fs/promises';
import * as path from 'path';

/**
 * PUT /api/admin/payment-providers/[id]
 * Update a payment provider
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;
    const body = await request.json();

    const provider = await PaymentProvider.findById(id);
    if (!provider) {
      return NextResponse.json(
        { error: 'Payment provider not found' },
        { status: 404 }
      );
    }

    // Update fields
    if (body.displayName !== undefined) provider.displayName = body.displayName;
    if (body.logo !== undefined) provider.logo = body.logo;
    if (body.isActive !== undefined) provider.isActive = body.isActive;
    if (body.saveToEnv !== undefined) provider.saveToEnv = body.saveToEnv;
    if (body.credentials !== undefined) provider.credentials = body.credentials;
    if (body.webhookUrl !== undefined) provider.webhookUrl = body.webhookUrl;
    if (body.testMode !== undefined) provider.testMode = body.testMode;
    if (body.processingFee !== undefined) provider.processingFee = body.processingFee;
    if (body.priority !== undefined) provider.priority = body.priority;

    await provider.save();

    // Update .env file
    await updateEnvFile();

    return NextResponse.json({
      success: true,
      message: 'Payment provider updated successfully',
      provider,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Update payment provider error:', error);
    return NextResponse.json(
      { error: 'Failed to update payment provider' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/payment-providers/[id]
 * Delete a payment provider
 */
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdminAuth();
    await connectToDatabase();

    const { id } = await params;

    const provider = await PaymentProvider.findById(id);
    if (!provider) {
      return NextResponse.json(
        { error: 'Payment provider not found' },
        { status: 404 }
      );
    }

    // Prevent deletion of built-in providers
    if (provider.isBuiltIn) {
      return NextResponse.json(
        { error: 'Cannot delete built-in payment providers' },
        { status: 400 }
      );
    }

    await PaymentProvider.findByIdAndDelete(id);

    // Update .env file
    await updateEnvFile();

    return NextResponse.json({
      success: true,
      message: 'Payment provider deleted successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Delete payment provider error:', error);
    return NextResponse.json(
      { error: 'Failed to delete payment provider' },
      { status: 500 }
    );
  }
}

/**
 * Helper function to update .env file with all payment provider credentials
 * Uses a robust approach to prevent duplicate entries
 */
async function updateEnvFile() {
  try {
    const envPath = path.join(process.cwd(), '.env');
    console.log('📍 .env path:', envPath);
    
    // Read existing .env content
    let existingContent = '';
    try {
      existingContent = await fs.readFile(envPath, 'utf-8');
      console.log('📖 Read existing .env file, length:', existingContent.length);
    } catch {
      console.log('⚠️ .env file does not exist, will create new one');
    }

    // Get all providers that should be saved to .env
    const providers = await PaymentProvider.find({ saveToEnv: true });
    console.log('🔍 Found', providers.length, 'providers to save to .env:', providers.map(p => p.slug));

    // Get list of all provider slugs (including inactive ones to clean up)
    const allProviders = await PaymentProvider.find({});
    const allSlugs = allProviders.map(p => p.slug.toUpperCase());
    
    // Add known payment provider slugs
    const knownSlugs = ['STRIPE', 'PADDLE', 'NUVEI', 'POLAR', 'PAYPAL', 'RAZORPAY'];
    const slugsToClean = [...new Set([...allSlugs, ...knownSlugs])];

    // Remove ALL existing payment provider lines (line by line)
    const lines = existingContent.split('\n');
    const cleanedLines: string[] = [];
    let inPaymentSection = false;
    let skipUntilNextSection = false;
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Check if this is the payment providers section header
      if (trimmedLine === '# PAYMENT PROVIDERS') {
        inPaymentSection = true;
        skipUntilNextSection = true;
        continue;
      }
      
      // Check if this is a section header (starts a new section)
      if (trimmedLine.startsWith('# ===') && inPaymentSection) {
        // Skip the separator line before payment providers section
        continue;
      }
      
      // Check if this is a different section header (not payment related)
      if (trimmedLine.startsWith('# ') && !trimmedLine.includes('PAYMENT') && 
          !slugsToClean.some(slug => trimmedLine.toUpperCase().includes(slug))) {
        if (trimmedLine.startsWith('# ===')) {
          skipUntilNextSection = false;
          inPaymentSection = false;
        }
      }
      
      // Skip lines that are payment provider variables
      const isProviderLine = slugsToClean.some(slug => 
        trimmedLine.startsWith(`${slug}_`) || 
        trimmedLine.startsWith(`# ${slug}`) ||
        (trimmedLine.startsWith('#') && trimmedLine.toUpperCase().includes(slug))
      );
      
      // Skip auto-generated comment
      if (trimmedLine === '# Auto-generated by Admin Panel') {
        continue;
      }
      
      if (isProviderLine || (inPaymentSection && skipUntilNextSection)) {
        console.log('   🗑️ Removing line:', trimmedLine.substring(0, 50));
        continue;
      }
      
      cleanedLines.push(line);
    }
    
    // Remove trailing empty lines
    while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1].trim() === '') {
      cleanedLines.pop();
    }
    
    let newContent = cleanedLines.join('\n');
    console.log('   ✂️ Cleaned content length:', newContent.length);

    // Build payment providers section
    const providerLines: string[] = [];
    providerLines.push('');
    providerLines.push('# ============================================');
    providerLines.push('# PAYMENT PROVIDERS');
    providerLines.push('# Auto-generated by Admin Panel');
    providerLines.push('# ============================================');

    for (const provider of providers) {
      providerLines.push('');
      providerLines.push(`# ${provider.displayName}`);
      console.log(`  📝 Processing provider: ${provider.displayName} (${provider.credentials.length} credentials)`);
      
      for (const cred of provider.credentials) {
        const envKey = `${provider.slug.toUpperCase()}_${cred.key.toUpperCase()}`;
        const maskedValue = cred.isSecret ? '[HIDDEN]' : cred.value;
        console.log(`    - ${envKey}=${maskedValue}`);
        providerLines.push(`${envKey}=${cred.value || ''}`);
      }

      if (provider.webhookUrl) {
        console.log(`    - ${provider.slug.toUpperCase()}_WEBHOOK_URL=${provider.webhookUrl}`);
        providerLines.push(`${provider.slug.toUpperCase()}_WEBHOOK_URL=${provider.webhookUrl}`);
      }
      
      console.log(`    - ${provider.slug.toUpperCase()}_TEST_MODE=${provider.testMode}`);
      console.log(`    - ${provider.slug.toUpperCase()}_ACTIVE=${provider.isActive}`);
      providerLines.push(`${provider.slug.toUpperCase()}_TEST_MODE=${provider.testMode}`);
      providerLines.push(`${provider.slug.toUpperCase()}_ACTIVE=${provider.isActive}`);
    }

    // Append new payment providers section
    newContent = newContent.trimEnd() + '\n' + providerLines.join('\n') + '\n';
    console.log('   ➕ Added new section,', providerLines.length, 'lines');
    console.log('   📊 Final content length:', newContent.length);

    // Write to .env file
    console.log('💾 Writing to .env file...');
    await fs.writeFile(envPath, newContent, 'utf-8');
    console.log('✅ Updated .env file with payment provider credentials');
  } catch (error) {
    console.error('❌ Error updating .env file:', error);
    throw error;
  }
}

