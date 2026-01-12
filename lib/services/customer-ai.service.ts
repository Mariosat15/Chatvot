/**
 * Customer Support AI Service
 * 
 * RAG-ONLY implementation for customer-facing AI support.
 * 
 * SECURITY RULES:
 * - ONLY uses vector database for knowledge retrieval
 * - NO access to company statistics
 * - NO database query capabilities
 * - NO access to internal data (user counts, revenue, VAT, etc.)
 */

import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

interface SearchResult {
  content: string;
  similarity: number;
  source: string;
  section?: string;
}

/**
 * Generate embeddings using OpenAI
 */
async function generateEmbedding(text: string): Promise<number[]> {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text.slice(0, 8000),
    }),
  });
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
  }
  
  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Search the vector database for relevant knowledge
 * Returns ONLY public knowledge - NO company stats
 */
async function searchKnowledgeBase(
  query: string,
  maxResults: number = 5,
  minSimilarity: number = 0.65
): Promise<SearchResult[]> {
  await connectToDatabase();
  
  const db = mongoose.connection.db;
  if (!db) {
    console.error('[CustomerAI] Database not connected');
    return [];
  }
  
  try {
    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(query);
    
    // Get all active chunks
    const chunks = await db.collection('aiknowledgechunks')
      .find({ isActive: true })
      .toArray();
    
    if (chunks.length === 0) {
      console.log('[CustomerAI] No knowledge chunks available');
      return [];
    }
    
    // Get sources for reference
    const sourceIds = [...new Set(chunks.map(c => c.sourceId?.toString()))];
    const sources = await db.collection('aiknowledgesources')
      .find({ 
        _id: { $in: sourceIds.map(id => new mongoose.Types.ObjectId(id)) },
        isActive: true 
      })
      .toArray();
    
    const sourceMap = new Map(sources.map(s => [s._id.toString(), s.name]));
    
    // Calculate similarities and filter
    const results = chunks
      .map(chunk => ({
        content: chunk.content,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding || []),
        source: sourceMap.get(chunk.sourceId?.toString()) || 'Knowledge Base',
        section: chunk.headingPath?.join(' > ') || undefined,
      }))
      .filter(r => r.similarity >= minSimilarity)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
    
    console.log(`[CustomerAI] Found ${results.length} relevant chunks for query`);
    return results;
  } catch (error) {
    console.error('[CustomerAI] Error searching knowledge base:', error);
    return [];
  }
}

/**
 * Build context from search results
 */
function buildContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }
  
  let context = '';
  for (const result of results) {
    context += `---\n`;
    if (result.section) {
      context += `[${result.section}]\n`;
    }
    context += `${result.content}\n\n`;
  }
  
  return context.trim();
}

/**
 * Generate AI response for customer support
 * 
 * SECURITY: This function ONLY uses the vector database for knowledge.
 * It has NO access to:
 * - User counts or statistics
 * - Revenue or financial data
 * - Internal company metrics
 * - Employee information
 * - Any database query capabilities
 */
export async function generateCustomerSupportResponse(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  platformName: string = 'ChartVolt'
): Promise<{ content: string; usedRAG: boolean; sourcesUsed: string[] }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  // Step 1: Search vector database for relevant knowledge
  const searchResults = await searchKnowledgeBase(userMessage, 5, 0.6);
  const context = buildContext(searchResults);
  const sourcesUsed = [...new Set(searchResults.map(r => r.source))];
  
  // Step 2: Build RAG-constrained system prompt
  const systemPrompt = context
    ? `You are a helpful customer support assistant for ${platformName}.

IMPORTANT RULES:
1. ONLY use the information provided in the CONTEXT below to answer questions.
2. If the answer is not in the CONTEXT, politely say you don't have that information and offer to connect them with a human agent.
3. NEVER make up information or use knowledge outside the provided CONTEXT.
4. Be friendly, professional, and concise.
5. If the user seems frustrated or asks for a human, offer to connect them with support staff.

CONTEXT:
${context}

Remember: Only answer based on the CONTEXT above. If unsure, say "I don't have specific information about that, but I can connect you with our support team who can help further."`
    : `You are a helpful customer support assistant for ${platformName}.

IMPORTANT: I don't have specific knowledge loaded right now. Please provide general assistance and offer to connect the user with a human support agent for specific questions.

Be friendly and professional. If you cannot help, suggest: "I'd be happy to connect you with our support team who can provide more detailed assistance."`;
  
  // Step 3: Call OpenAI with RAG-constrained prompt
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-8), // Last 8 messages for context
        { role: 'user', content: userMessage },
      ],
      max_tokens: 500,
      temperature: 0.5, // Lower temperature for more factual responses
    }),
  });
  
  if (!response.ok) {
    const errorText = await response.text().catch(() => 'Unknown error');
    throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  
  if (!content) {
    throw new Error('No response from OpenAI');
  }
  
  return {
    content,
    usedRAG: searchResults.length > 0,
    sourcesUsed,
  };
}

/**
 * Check if knowledge base has any indexed content
 */
export async function hasKnowledgeContent(): Promise<boolean> {
  await connectToDatabase();
  
  const db = mongoose.connection.db;
  if (!db) return false;
  
  const count = await db.collection('aiknowledgechunks').countDocuments({ isActive: true });
  return count > 0;
}
