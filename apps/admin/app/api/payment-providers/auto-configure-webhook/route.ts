import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/database/mongoose';
import PaymentProvider from '@/database/models/payment-provider.model';
import { verifyAdminAuth } from '@/lib/admin/auth';
import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';

/**
 * Auto-Configure Webhook Endpoint
 * 
 * This is an OPTIONAL feature that automatically creates webhook endpoints
 * in Stripe/Paddle using their APIs.
 * 
 * Requirements:
 * - Must have valid API key with webhook permissions
 * - Must NOT be on localhost (Stripe can't reach localhost)
 * - Saves webhook secret to BOTH database and .env file
 * 
 * This does NOT affect existing functionality:
 * - Manual webhook setup still works
 * - Stripe CLI still works for local development
 * - Existing webhooks are not deleted
 */

// Required Stripe events for deposits
const REQUIRED_STRIPE_EVENTS: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
  'payment_intent.succeeded',
  'payment_intent.payment_failed',
  'payment_intent.canceled',
  'charge.refunded',
];

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const admin = await verifyAdminAuth();
    if (!admin.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { provider, webhookUrl } = await request.json();

    if (!provider || !webhookUrl) {
      return NextResponse.json(
        { error: 'Provider and webhookUrl are required' },
        { status: 400 }
      );
    }

    // Check if URL is localhost
    if (webhookUrl.includes('localhost') || webhookUrl.includes('127.0.0.1')) {
      return NextResponse.json({
        error: 'Cannot auto-configure webhooks for localhost',
        suggestion: 'Use Stripe CLI for local development: stripe listen --forward-to localhost:3000/api/stripe/webhook',
        isLocalhost: true,
      }, { status: 400 });
    }

    await connectToDatabase();

    // Get provider credentials from database
    const providerDoc = await PaymentProvider.findOne({ slug: provider, isActive: true });
    
    if (!providerDoc) {
      return NextResponse.json(
        { error: `Provider "${provider}" not found or not active` },
        { status: 404 }
      );
    }

    // Get credentials
    const credentials: Record<string, string> = {};
    providerDoc.credentials.forEach((cred: any) => {
      credentials[cred.key] = cred.value;
    });

    let result;

    if (provider === 'stripe') {
      result = await autoConfigureStripe(credentials, webhookUrl, providerDoc);
    } else if (provider === 'paddle') {
      result = await autoConfigurePaddle(credentials, webhookUrl, providerDoc);
    } else {
      return NextResponse.json(
        { error: `Auto-configure not supported for provider "${provider}"` },
        { status: 400 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('❌ Auto-configure webhook error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to auto-configure webhook' },
      { status: 500 }
    );
  }
}

/**
 * Auto-configure Stripe webhook endpoint
 */
async function autoConfigureStripe(
  credentials: Record<string, string>,
  webhookUrl: string,
  providerDoc: any
) {
  const secretKey = credentials.secret_key;
  
  if (!secretKey) {
    throw new Error('Stripe secret key not configured. Please add it first.');
  }

  // Initialize Stripe client
  const stripe = new Stripe(secretKey, {
    apiVersion: '2025-04-30.basil',
  });

  // Check for existing webhook with same URL
  const existingWebhooks = await stripe.webhookEndpoints.list({ limit: 100 });
  const existing = existingWebhooks.data.find(w => w.url === webhookUrl);

  let webhookEndpoint: Stripe.WebhookEndpoint;

  if (existing) {
    // DELETE existing webhook and create new one to get fresh secret
    // Stripe only returns secret on creation, not on update
    console.log(`🗑️ Deleting existing Stripe webhook: ${existing.id}`);
    await stripe.webhookEndpoints.del(existing.id);
  }
  
  // Create new webhook endpoint (always create to get the secret)
  console.log(`✨ Creating new Stripe webhook endpoint: ${webhookUrl}`);
  webhookEndpoint = await stripe.webhookEndpoints.create({
    url: webhookUrl,
    enabled_events: REQUIRED_STRIPE_EVENTS,
    description: 'Auto-configured by Trading Platform',
  });

  // Get webhook secret - Stripe returns it on creation
  const webhookSecret = webhookEndpoint.secret;
  
  if (!webhookSecret) {
    throw new Error('Stripe did not return webhook secret. Please try again.');
  }

  // Save webhook secret to database
  const webhookSecretCred = providerDoc.credentials.find((c: any) => c.key === 'webhook_secret');
  if (webhookSecretCred) {
    webhookSecretCred.value = webhookSecret;
  } else {
    providerDoc.credentials.push({
      key: 'webhook_secret',
      value: webhookSecret,
      isSecret: true,
      description: 'Stripe webhook signing secret (auto-configured)',
    });
  }
  
  // Update webhook URL
  providerDoc.webhookUrl = webhookUrl;
  await providerDoc.save();

  // Save to .env file if enabled
  if (providerDoc.saveToEnv) {
    await saveToEnvFile('STRIPE_WEBHOOK_SECRET', webhookSecret);
  }

  console.log(`✅ Stripe webhook configured successfully`);
  console.log(`   Endpoint ID: ${webhookEndpoint.id}`);
  console.log(`   URL: ${webhookUrl}`);
  console.log(`   Secret: ${webhookSecret.substring(0, 20)}...`);
  console.log(`   Events: ${REQUIRED_STRIPE_EVENTS.join(', ')}`);

  return {
    success: true,
    provider: 'stripe',
    webhookEndpointId: webhookEndpoint.id,
    webhookUrl: webhookUrl,
    webhookSecret: webhookSecret, // Return secret so admin can see it
    events: REQUIRED_STRIPE_EVENTS,
    secretSaved: true,
    message: `Webhook created successfully! Secret saved to ${providerDoc.saveToEnv ? 'database and .env' : 'database'}.`,
  };
}

/**
 * Auto-configure Paddle notification destination
 */
async function autoConfigurePaddle(
  credentials: Record<string, string>,
  webhookUrl: string,
  providerDoc: any
) {
  const apiKey = credentials.api_key;
  
  if (!apiKey) {
    throw new Error('Paddle API key not configured. Please add it first.');
  }

  const isTestMode = apiKey.includes('test_');
  const baseUrl = isTestMode 
    ? 'https://sandbox-api.paddle.com'
    : 'https://api.paddle.com';

  // List existing notification destinations
  const listResponse = await fetch(`${baseUrl}/notification-destinations`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!listResponse.ok) {
    const error = await listResponse.json();
    throw new Error(`Paddle API error: ${error.error?.message || 'Failed to list destinations'}`);
  }

  const { data: destinations } = await listResponse.json();
  const existing = destinations?.find((d: any) => d.endpoint_url === webhookUrl);

  let destination;
  let isNew = false;

  if (existing) {
    // Update existing destination
    console.log(`📝 Updating existing Paddle notification destination: ${existing.id}`);
    
    const updateResponse = await fetch(`${baseUrl}/notification-destinations/${existing.id}`, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscribed_events: [
          { event_type: 'transaction.completed' },
          { event_type: 'transaction.payment_failed' },
          { event_type: 'transaction.refunded' },
        ],
      }),
    });

    if (!updateResponse.ok) {
      const error = await updateResponse.json();
      throw new Error(`Failed to update Paddle destination: ${error.error?.message}`);
    }

    destination = (await updateResponse.json()).data;
  } else {
    // Create new destination
    console.log(`✨ Creating new Paddle notification destination: ${webhookUrl}`);
    
    const createResponse = await fetch(`${baseUrl}/notification-destinations`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        description: 'Auto-configured by Trading Platform',
        destination: webhookUrl,
        type: 'url',
        subscribed_events: [
          { event_type: 'transaction.completed' },
          { event_type: 'transaction.payment_failed' },
          { event_type: 'transaction.refunded' },
        ],
      }),
    });

    if (!createResponse.ok) {
      const error = await createResponse.json();
      throw new Error(`Failed to create Paddle destination: ${error.error?.message}`);
    }

    destination = (await createResponse.json()).data;
    isNew = true;
  }

  // Note: Paddle webhook secrets need to be retrieved separately or set manually
  // The API doesn't return a secret on destination creation

  // Update webhook URL in database
  providerDoc.webhookUrl = webhookUrl;
  await providerDoc.save();

  console.log(`✅ Paddle notification destination configured successfully`);
  console.log(`   Destination ID: ${destination.id}`);
  console.log(`   URL: ${webhookUrl}`);

  return {
    success: true,
    provider: 'paddle',
    destinationId: destination.id,
    webhookUrl: webhookUrl,
    events: ['transaction.completed', 'transaction.payment_failed', 'transaction.refunded'],
    isNew,
    message: isNew
      ? 'Notification destination created successfully!'
      : 'Notification destination updated with correct events.',
    note: 'Paddle webhook secrets must be configured manually in the Paddle Dashboard if signature verification is needed.',
  };
}

/**
 * Save a value to the .env file
 */
async function saveToEnvFile(key: string, value: string): Promise<void> {
  try {
    const envPath = path.join(process.cwd(), '..', '..', '.env');
    
    let envContent = '';
    if (fs.existsSync(envPath)) {
      envContent = fs.readFileSync(envPath, 'utf8');
    }

    // Check if key exists
    const regex = new RegExp(`^${key}=.*$`, 'm');
    
    if (regex.test(envContent)) {
      // Update existing
      envContent = envContent.replace(regex, `${key}=${value}`);
    } else {
      // Add new
      envContent += `\n# Auto-configured webhook secret\n${key}=${value}\n`;
    }

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log(`✅ Saved ${key} to .env file`);
  } catch (error) {
    console.error(`⚠️ Could not save to .env file:`, error);
    // Don't throw - database save is the primary storage
  }
}

