import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

/**
 * POST /api/marketplace/generate-content
 * Uses OpenAI to generate title, short description, and full description
 * for ANY marketplace item type (indicators, strategies, game master packages, cosmetics)
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      category, 
      imageUrl, 
      // Cosmetic specific
      cosmeticType,
      // Indicator specific
      indicatorType,
      defaultSettings,
      // Strategy specific
      strategyConfig,
      // Game Master specific
      gameMasterConfig,
      // Existing values (optional - for refinement)
      existingName,
      existingDescription,
    } = body;

    if (!category) {
      return NextResponse.json({ error: 'Category is required' }, { status: 400 });
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ [AI Generate] OPENAI_API_KEY not configured');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    console.log(`🤖 [AI Generate] Processing ${category} item`);

    // Build the prompt based on category
    let systemPrompt = '';
    let userPrompt = '';
    let imageData: string | null = null;

    if (category === 'cosmetic') {
      // For cosmetics, use image analysis
      if (!imageUrl) {
        return NextResponse.json({ error: 'Image URL is required for cosmetics' }, { status: 400 });
      }
      
      // Convert image to base64
      imageData = await getImageBase64(imageUrl);
      if (!imageData) {
        return NextResponse.json({ 
          error: 'Could not find image file. Please try uploading again.' 
        }, { status: 400 });
      }

      systemPrompt = getCosmeticPrompt(cosmeticType);
      userPrompt = 'Carefully analyze this avatar image. Note all visual details: colors, weapons, armor, effects, pose, expression. Then create a unique name, tagline, and detailed backstory that accurately reflects what you see:';
    
    } else if (category === 'indicator') {
      systemPrompt = getIndicatorPrompt(indicatorType, defaultSettings);
      userPrompt = `Generate compelling marketplace content for this trading indicator:\n\nIndicator Type: ${indicatorType || 'custom'}\nSettings: ${JSON.stringify(defaultSettings || {}, null, 2)}`;
    
    } else if (category === 'strategy') {
      systemPrompt = getStrategyPrompt(strategyConfig);
      userPrompt = `Generate compelling marketplace content for this trading strategy:\n\nStrategy Configuration: ${JSON.stringify(strategyConfig || {}, null, 2)}`;
    
    } else if (category === 'gamemaster') {
      systemPrompt = getGameMasterPrompt(gameMasterConfig);
      userPrompt = `Generate compelling marketplace content for this Game Master package:\n\nPackage Configuration: ${JSON.stringify(gameMasterConfig || {}, null, 2)}`;
    
    } else {
      return NextResponse.json({ error: `Unsupported category: ${category}` }, { status: 400 });
    }

    console.log(`🤖 [AI Generate] Calling OpenAI API for ${category}...`);
    
    // Build messages array
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (imageData && category === 'cosmetic') {
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: userPrompt },
          { 
            type: 'image_url', 
            image_url: { url: imageData, detail: 'high' } 
          }
        ]
      });
    } else {
      messages.push({ role: 'user', content: userPrompt });
    }

    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages,
      max_tokens: 1200,
      temperature: 0.85,
    });
    
    console.log(`✅ [AI Generate] OpenAI response received`);

    const content = response.choices[0]?.message?.content;
    
    if (!content) {
      return NextResponse.json({ error: 'Failed to generate content' }, { status: 500 });
    }

    console.log(`🤖 [AI Generate] Raw response:`, content);

    // Parse the JSON response
    let parsed;
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return NextResponse.json({
        success: true,
        generated: {
          name: 'Generated Item',
          shortDescription: content.slice(0, 100),
          fullDescription: content
        }
      });
    }

    console.log(`🤖 [AI Generate] Parsed result:`, parsed);

    return NextResponse.json({
      success: true,
      generated: {
        name: parsed.name || 'Generated Item',
        shortDescription: parsed.shortDescription || parsed.tagline || '',
        fullDescription: parsed.fullDescription || parsed.description || ''
      }
    });

  } catch (error) {
    console.error('❌ [AI Generate] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to generate content: ' + (error instanceof Error ? error.message : 'Unknown error') 
    }, { status: 500 });
  }
}

// Helper function to get image as base64
async function getImageBase64(imageUrl: string): Promise<string | null> {
  const urlPath = imageUrl.split('?')[0];
  const filename = urlPath.split('/').pop() || '';
  
  let mimeType = 'image/png';
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
  else if (ext === 'gif') mimeType = 'image/gif';
  else if (ext === 'webp') mimeType = 'image/webp';
  
  const possiblePaths = [
    path.join('/var/www/chartvolt', 'public', 'uploads', 'marketplace', filename),
    path.join(process.cwd(), '..', '..', 'public', 'uploads', 'marketplace', filename),
    path.join(process.cwd(), 'public', 'uploads', 'marketplace', filename),
  ];
  
  for (const filePath of possiblePaths) {
    try {
      await access(filePath, constants.R_OK);
      const fileBuffer = await readFile(filePath);
      console.log(`✅ [AI Generate] Found image at: ${filePath}`);
      return `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    } catch {
      // Try next path
    }
  }
  
  return null;
}

// Prompt for cosmetic avatars
function getCosmeticPrompt(cosmeticType?: string): string {
  return `You are a creative writer for a trading platform marketplace. You create compelling, unique names and rich backstories for cosmetic avatar items that traders can purchase.

IMPORTANT: Carefully analyze the actual image - note colors, weapons/items, clothing, pose, mood, and any distinctive features. Your description MUST match what's actually in the image.

Your task is to create:

1. **Name** (2-3 words max) - Epic, memorable, trading/gaming themed. Based on what you SEE in the image.

2. **Short Tagline** (max 100 characters) - Catchy one-liner describing the character.

3. **Full Description** - Use this EXACT format:

**Origin Story**
[2-3 paragraphs of creative lore about who this character is, their background, and their role in the trading world. Connect their appearance to their story.]

**Symbolism**
[List 4-5 visual elements you can see in the image and explain their trading-related meaning]
• [Visible Item/Feature]: [Trading symbolism]
• [Visible Color/Effect]: [What it represents]
• [Visible Armor/Clothing]: [Its meaning]
• [Visible Expression/Pose]: [What it conveys]

*"[A memorable quote from the character about trading]"*

The cosmetic type is: ${cosmeticType || 'avatar'}

Respond in JSON format:
{
  "name": "Character Name",
  "shortDescription": "Short catchy tagline under 100 chars",
  "fullDescription": "**Origin Story**\\n[story paragraphs]\\n\\n**Symbolism**\\n• Item: Meaning\\n\\n*\\"Quote here\\"*"
}`;
}

// Prompt for trading indicators
function getIndicatorPrompt(indicatorType?: string, settings?: Record<string, unknown>): string {
  const indicatorNames: Record<string, string> = {
    sma: 'Simple Moving Average',
    ema: 'Exponential Moving Average',
    bb: 'Bollinger Bands',
    rsi: 'Relative Strength Index',
    macd: 'MACD',
    support_resistance: 'Support & Resistance Levels',
  };

  const indicatorName = indicatorType ? indicatorNames[indicatorType] || indicatorType : 'Custom Indicator';

  return `You are a professional trading platform content writer. Create compelling marketplace content for a trading indicator.

The indicator type is: ${indicatorName}
Default settings: ${JSON.stringify(settings || {}, null, 2)}

Create content that:
1. Explains what the indicator does in simple terms
2. Highlights its benefits for traders
3. Mentions use cases and trading scenarios
4. Is professional but engaging

Your task is to create:

1. **Name** (2-4 words max) - Professional, memorable. Can be creative but clear about what it does.

2. **Short Description** (max 120 characters) - One-liner explaining the indicator's main benefit.

3. **Full Description** - Use this EXACT format:

# [Indicator Name]

## Overview
[1-2 paragraphs explaining what the indicator does and why traders use it]

## How It Works
[Bullet points explaining the calculation/methodology]
- [Point 1]
- [Point 2]
- [Point 3]

## Settings
[List the configurable settings and what they do]
- **[Setting Name]**: [What it controls]

## Best Used For
[Bullet points of ideal use cases]
- [Use case 1]
- [Use case 2]
- [Use case 3]

## Pro Tips
[1-2 practical tips for using this indicator effectively]

Respond in JSON format:
{
  "name": "Indicator Name",
  "shortDescription": "Short description under 120 chars",
  "fullDescription": "# Title\\n\\n## Overview\\n[content]\\n\\n## How It Works\\n- [points]\\n\\n..."
}`;
}

// Prompt for trading strategies
function getStrategyPrompt(strategyConfig?: Record<string, unknown>): string {
  return `You are a professional trading platform content writer. Create compelling marketplace content for an automated trading strategy.

Strategy configuration: ${JSON.stringify(strategyConfig || {}, null, 2)}

Create content that:
1. Explains the strategy logic clearly
2. Highlights when and why it generates signals
3. Mentions risk level and ideal market conditions
4. Is professional and builds confidence

Your task is to create:

1. **Name** (2-4 words max) - Professional, memorable strategy name.

2. **Short Description** (max 120 characters) - One-liner explaining the strategy's approach.

3. **Full Description** - Use this EXACT format:

# [Strategy Name]

## Overview
[1-2 paragraphs explaining the strategy philosophy and what makes it effective]

## Buy Signal (When to Enter Long)
[Clear explanation of buy conditions]
- [Condition 1]
- [Condition 2]

## Sell Signal (When to Exit/Short)
[Clear explanation of sell conditions]
- [Condition 1]
- [Condition 2]

## How It Works
[Step-by-step explanation of the strategy logic]
1. [Step 1]
2. [Step 2]
3. [Step 3]

## Best Used For
[Ideal market conditions and trading styles]
- [Use case 1]
- [Use case 2]

## Risk Level
[Assessment of risk with brief explanation]

*"[A memorable trading wisdom quote related to the strategy]"*

Respond in JSON format:
{
  "name": "Strategy Name",
  "shortDescription": "Short description under 120 chars",
  "fullDescription": "# Title\\n\\n## Overview\\n[content]\\n\\n..."
}`;
}

// Prompt for Game Master packages
function getGameMasterPrompt(config?: Record<string, unknown>): string {
  const gmConfig = config || {};
  
  return `You are a professional content writer for a trading competition platform. Create compelling marketplace content for a Game Master subscription package.

Package configuration:
- Subscription Duration: ${gmConfig.subscriptionDurationDays || 30} days
- Referral Fee Percentage: ${gmConfig.referralFeePercentage || 5}%
- Max Competitions Per Day: ${gmConfig.maxCompetitionsPerDay || 1}
- Max Users Per Competition: ${gmConfig.maxUsersPerCompetition || 30}
- Can Create Competitions: ${gmConfig.canCreateCompetitions !== false ? 'Yes' : 'No (Referral Only)'}
- Can Earn From Challenges: ${gmConfig.canEarnFromChallenges ? 'Yes' : 'No'}
- Challenge Referral Fee: ${gmConfig.challengeReferralFeePercentage || 'N/A'}%

Create content that:
1. Highlights the value proposition for community builders
2. Explains the earning potential from referrals
3. Makes the package feel exclusive and valuable
4. Uses aspirational language that appeals to traders

Your task is to create:

1. **Name** (2-4 words max) - Tier name that conveys value (e.g., "Pro", "Elite", "Ultimate").

2. **Short Description** (max 120 characters) - Compelling one-liner about the package benefits.

3. **Full Description** - Use this EXACT format:

# [Package Name - Aspirational Title]

[Opening hook - 1 sentence about what this package enables]

## What You Get

- **[Number] Competition[s] per Day** - [Brief benefit]
- **Up to [Number] Participants** - [Brief benefit]
- **[X]% Referral Earnings** - [Brief benefit]
- **[X] Days Duration** - [Brief benefit]
${gmConfig.canEarnFromChallenges ? `- **Challenge Earnings** - Earn ${gmConfig.challengeReferralFeePercentage || 5}% from 1v1 challenges` : ''}

## How Referral Earnings Work

[2-3 sentences explaining the passive income model]

## Ideal For

- [Target audience 1]
- [Target audience 2]
- [Target audience 3]

${gmConfig.canCreateCompetitions === false ? '## Note\\nThis is a referral-only package - perfect for influencers who want to earn without managing competitions.' : ''}

*"[Aspirational quote about building a trading community]"*

Respond in JSON format:
{
  "name": "Package Name",
  "shortDescription": "Short description under 120 chars",
  "fullDescription": "# Title\\n\\n[Opening]\\n\\n## What You Get\\n- [benefits]\\n\\n..."
}`;
}
