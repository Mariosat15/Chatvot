import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { verifyAdminAuth } from '@/lib/admin/auth';
import { readFile, access } from 'fs/promises';
import { constants } from 'fs';
import path from 'path';

/**
 * POST /api/marketplace/generate-cosmetic
 * Uses OpenAI Vision to generate title and description for a cosmetic based on the uploaded image
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const auth = await verifyAdminAuth();
    if (!auth.isAuthenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { imageUrl, cosmeticType } = await request.json();

    if (!imageUrl) {
      return NextResponse.json({ error: 'Image URL is required' }, { status: 400 });
    }

    // Check for OpenAI API key
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      console.error('❌ [AI Generate] OPENAI_API_KEY not configured');
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });

    console.log(`🤖 [AI Generate] Processing image: ${imageUrl}`);

    // Convert image to base64 for OpenAI (since URLs may not be publicly accessible)
    let imageData: string;
    let mimeType: string = 'image/png';
    
    // Extract filename from URL (handles /api/assets/marketplace/filename.png?t=123)
    const urlPath = imageUrl.split('?')[0];
    const filename = urlPath.split('/').pop() || '';
    
    // Determine mime type from extension
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'jpg' || ext === 'jpeg') mimeType = 'image/jpeg';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';
    
    // Try to read the file from disk
    const possiblePaths = [
      // Production
      path.join('/var/www/chartvolt', 'public', 'uploads', 'marketplace', filename),
      // Monorepo local dev
      path.join(process.cwd(), '..', '..', 'public', 'uploads', 'marketplace', filename),
      // Admin app local
      path.join(process.cwd(), 'public', 'uploads', 'marketplace', filename),
    ];
    
    let fileBuffer: Buffer | null = null;
    for (const filePath of possiblePaths) {
      try {
        await access(filePath, constants.R_OK);
        fileBuffer = await readFile(filePath);
        console.log(`✅ [AI Generate] Found image at: ${filePath}`);
        break;
      } catch {
        // Try next path
      }
    }
    
    if (!fileBuffer) {
      console.error(`❌ [AI Generate] Could not find image file: ${filename}`);
      console.error(`   Searched paths:`, possiblePaths);
      return NextResponse.json({ 
        error: 'Could not find image file. Please try uploading again.' 
      }, { status: 400 });
    }
    
    // Convert to base64
    imageData = `data:${mimeType};base64,${fileBuffer.toString('base64')}`;
    console.log(`🤖 [AI Generate] Converted image to base64 (${Math.round(fileBuffer.length / 1024)}KB)`);

    // Use OpenAI Vision to analyze the image and generate content
    console.log(`🤖 [AI Generate] Calling OpenAI Vision API...`);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: `You are a creative writer for a trading platform marketplace. You create compelling, unique names and descriptions for cosmetic avatar items that traders can purchase.

Your task is to analyze the provided avatar image and create:
1. A unique, memorable name (2-3 words max, creative trading/gaming themed)
2. A short tagline (max 100 characters) - catchy and intriguing
3. A full backstory/description (2-3 paragraphs) - creative lore about this avatar character

The cosmetic type is: ${cosmeticType || 'avatar'}

Guidelines:
- Names should be epic, memorable, and relate to trading/markets/finance themes creatively
- Think of themes like: market warriors, trading legends, financial mystics, chart masters, etc.
- Backstories should be creative fiction about who this character is
- Make it feel like a collectible character with history and personality
- Keep it professional but fun - this is for a trading platform

Respond in JSON format:
{
  "name": "Character Name",
  "shortDescription": "Short catchy tagline",
  "fullDescription": "Full backstory and description..."
}`
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Analyze this avatar image and create a unique name, tagline, and backstory for it:'
            },
            {
              type: 'image_url',
              image_url: {
                url: imageData, // Use base64 data URL
                detail: 'low' // Use low detail to reduce token usage
              }
            }
          ]
        }
      ],
      max_tokens: 800,
      temperature: 0.9, // Higher creativity
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
      // Try to extract JSON from the response (it might be wrapped in markdown code blocks)
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        parsed = JSON.parse(content);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      // Return raw content as fallback
      return NextResponse.json({
        success: true,
        generated: {
          name: 'Generated Avatar',
          shortDescription: content.slice(0, 100),
          fullDescription: content
        }
      });
    }

    console.log(`🤖 [AI Generate] Parsed result:`, parsed);

    return NextResponse.json({
      success: true,
      generated: {
        name: parsed.name || 'Generated Avatar',
        shortDescription: parsed.shortDescription || parsed.tagline || '',
        fullDescription: parsed.fullDescription || parsed.backstory || parsed.description || ''
      }
    });

  } catch (error) {
    console.error('❌ [AI Generate] Error:', error);
    
    if (error instanceof Error) {
      // Check for specific OpenAI errors
      if (error.message.includes('Could not process image')) {
        return NextResponse.json({ 
          error: 'Could not analyze image. Make sure the image is publicly accessible.' 
        }, { status: 400 });
      }
    }
    
    return NextResponse.json({ 
      error: 'Failed to generate content: ' + (error instanceof Error ? error.message : 'Unknown error') 
    }, { status: 500 });
  }
}
