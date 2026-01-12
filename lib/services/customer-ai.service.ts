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
 * 
 * SEARCH FEATURES:
 * - Query expansion with synonyms
 * - Multiple search strategies
 * - Keyword extraction for better matching
 */

import { connectToDatabase } from '@/database/mongoose';
import mongoose from 'mongoose';

interface SearchResult {
  content: string;
  similarity: number;
  source: string;
  section?: string;
}

// Common synonyms and related terms for better search
const QUERY_EXPANSIONS: Record<string, string[]> = {
  'challenge': ['1v1', 'head-to-head', 'battle', 'versus', 'compete'],
  'challenges': ['1v1', 'head-to-head', 'battles', 'versus', 'compete'],
  '1v1': ['challenge', 'head-to-head', 'one versus one', 'battle'],
  'competition': ['contest', 'tournament', 'event', 'compete'],
  'competitions': ['contests', 'tournaments', 'events', 'trading competition'],
  'deposit': ['add money', 'fund', 'payment', 'add credits'],
  'withdraw': ['withdrawal', 'cash out', 'take money', 'payout'],
  'withdrawal': ['withdraw', 'cash out', 'payout', 'take money out'],
  'money': ['funds', 'credits', 'balance', 'cash'],
  'credits': ['money', 'funds', 'balance', 'currency'],
  'win': ['prize', 'reward', 'winnings', 'earn'],
  'prize': ['win', 'reward', 'winnings', 'payout'],
  'account': ['profile', 'registration', 'sign up'],
  'verify': ['verification', 'kyc', 'identity'],
  'kyc': ['verify', 'verification', 'identity', 'documents'],
  'trade': ['trading', 'buy', 'sell', 'position'],
  'trading': ['trade', 'buy', 'sell', 'positions'],
  'leverage': ['margin', 'multiplier'],
  'fee': ['fees', 'cost', 'charge', 'commission'],
  'start': ['begin', 'getting started', 'how to', 'create'],
  'problem': ['issue', 'error', 'trouble', 'help', 'not working'],
  'help': ['support', 'assist', 'problem', 'issue'],
  // Competition rules
  'disqualified': ['eliminated', 'removed', 'kicked out', 'liquidated', 'banned', 'rules violation'],
  'disqualify': ['eliminate', 'remove', 'liquidate', 'kick out'],
  'eliminated': ['disqualified', 'removed', 'liquidated', 'out'],
  'liquidated': ['eliminated', 'disqualified', 'margin call', 'blown account'],
  'rules': ['terms', 'conditions', 'requirements', 'restrictions'],
  'banned': ['suspended', 'blocked', 'restricted', 'disqualified'],
  // More common terms
  'winner': ['first place', 'champion', 'top', 'best'],
  'lose': ['loss', 'losing', 'lost'],
  'join': ['enter', 'participate', 'sign up', 'register'],
  'leave': ['exit', 'quit', 'withdraw from'],
  'capital': ['money', 'funds', 'balance', 'starting capital'],
  'profit': ['gain', 'earnings', 'pnl', 'returns'],
  'loss': ['lose', 'negative', 'down'],
};

/**
 * Expand query with synonyms for better matching
 */
function expandQuery(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/);
  const expansions = new Set<string>();
  
  // Add original query
  expansions.add(query.toLowerCase());
  
  // Add expansions for each word
  for (const word of words) {
    const synonyms = QUERY_EXPANSIONS[word];
    if (synonyms) {
      for (const synonym of synonyms) {
        // Create query with synonym replacement
        const expandedQuery = query.toLowerCase().replace(word, synonym);
        expansions.add(expandedQuery);
      }
    }
  }
  
  return Array.from(expansions);
}

/**
 * Extract key terms from query for keyword matching
 */
function extractKeyTerms(query: string): string[] {
  const stopWords = new Set(['what', 'how', 'why', 'when', 'where', 'is', 'are', 'the', 'a', 'an', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'this', 'that', 'do', 'does', 'can', 'i', 'my', 'me', 'you', 'your']);
  
  return query
    .toLowerCase()
    .replace(/[?!.,]/g, '')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.has(word));
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
 * Uses multiple strategies: semantic search + keyword fallback
 * 
 * SECURITY: ONLY searches 'customer' and 'both' audience knowledge
 * NEVER accesses 'admin' audience knowledge
 */
async function searchKnowledgeBase(
  query: string,
  maxResults: number = 5,
  minSimilarity: number = 0.5
): Promise<SearchResult[]> {
  await connectToDatabase();
  
  const db = mongoose.connection.db;
  if (!db) {
    console.error('[CustomerAI] Database not connected');
    return [];
  }
  
  try {
    // SECURITY: Only get chunks for 'customer' or 'both' audience
    // NEVER include 'admin' audience chunks
    const chunks = await db.collection('aiknowledgechunks')
      .find({ 
        isActive: true,
        audience: { $in: ['customer', 'both'] } // SECURITY FILTER
      })
      .toArray();
    
    if (chunks.length === 0) {
      console.log('[CustomerAI] ⚠️ No knowledge chunks available - please index knowledge base!');
      return [];
    }
    
    console.log(`[CustomerAI] Searching ${chunks.length} knowledge chunks...`);
    
    // Get sources for reference
    const sourceIds = [...new Set(chunks.map(c => c.sourceId?.toString()))];
    const sources = await db.collection('aiknowledgesources')
      .find({ 
        _id: { $in: sourceIds.map(id => new mongoose.Types.ObjectId(id)) },
        isActive: true 
      })
      .toArray();
    
    const sourceMap = new Map(sources.map(s => [s._id.toString(), s.name]));
    
    // Strategy 1: Semantic search with query expansion
    const expandedQueries = expandQuery(query);
    console.log(`[CustomerAI] Query expansions: ${expandedQueries.slice(0, 3).join(', ')}...`);
    
    let allResults: SearchResult[] = [];
    
    // Search with original and expanded queries
    for (const searchQuery of expandedQueries.slice(0, 3)) { // Limit to 3 expansions
      try {
        const queryEmbedding = await generateEmbedding(searchQuery);
        
        const results = chunks
          .map(chunk => ({
            content: chunk.content,
            similarity: cosineSimilarity(queryEmbedding, chunk.embedding || []),
            source: sourceMap.get(chunk.sourceId?.toString()) || 'Knowledge Base',
            section: chunk.headingPath?.join(' > ') || undefined,
          }))
          .filter(r => r.similarity >= minSimilarity);
        
        allResults.push(...results);
      } catch (embeddingError) {
        console.warn(`[CustomerAI] Embedding failed for query: ${searchQuery}`);
      }
    }
    
    // Strategy 2: Keyword-based fallback search
    const keyTerms = extractKeyTerms(query);
    console.log(`[CustomerAI] Key terms: ${keyTerms.join(', ')}`);
    
    if (keyTerms.length > 0) {
      const keywordResults = chunks
        .map(chunk => {
          const contentLower = chunk.content.toLowerCase();
          const sectionLower = (chunk.headingPath || []).join(' ').toLowerCase();
          
          // Count keyword matches
          let matchScore = 0;
          for (const term of keyTerms) {
            if (contentLower.includes(term)) matchScore += 0.15;
            if (sectionLower.includes(term)) matchScore += 0.1;
          }
          
          // Check for expanded synonyms in content
          for (const term of keyTerms) {
            const synonyms = QUERY_EXPANSIONS[term] || [];
            for (const syn of synonyms) {
              if (contentLower.includes(syn)) matchScore += 0.1;
            }
          }
          
          return {
            content: chunk.content,
            similarity: Math.min(matchScore, 0.85), // Cap keyword-based similarity
            source: sourceMap.get(chunk.sourceId?.toString()) || 'Knowledge Base',
            section: chunk.headingPath?.join(' > ') || undefined,
          };
        })
        .filter(r => r.similarity >= 0.2); // Lower threshold for keyword matches
      
      allResults.push(...keywordResults);
    }
    
    // Deduplicate and sort by similarity
    const uniqueResults = new Map<string, SearchResult>();
    for (const result of allResults) {
      const key = result.content.substring(0, 100);
      const existing = uniqueResults.get(key);
      if (!existing || result.similarity > existing.similarity) {
        uniqueResults.set(key, result);
      }
    }
    
    const finalResults = Array.from(uniqueResults.values())
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);
    
    console.log(`[CustomerAI] Found ${finalResults.length} unique results (top similarity: ${finalResults[0]?.similarity?.toFixed(3) || 'N/A'})`);
    
    // Log top results for debugging
    if (finalResults.length > 0) {
      console.log(`[CustomerAI] Top result section: ${finalResults[0].section || 'N/A'}`);
    }
    
    return finalResults;
  } catch (error) {
    console.error('[CustomerAI] Error searching knowledge base:', error);
    return [];
  }
}

/**
 * Build context from search results with clear formatting
 */
function buildContext(results: SearchResult[]): string {
  if (results.length === 0) {
    return '';
  }
  
  let context = '';
  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    context += `\n=== KNOWLEDGE ${i + 1} ===\n`;
    if (result.section) {
      context += `Topic: ${result.section}\n`;
    }
    context += `\n${result.content}\n`;
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
 * 
 * STRICT RAG-ONLY: Will NOT answer if no knowledge base results found.
 */
export async function generateCustomerSupportResponse(
  userMessage: string,
  conversationHistory: { role: string; content: string }[],
  platformName: string = 'ChartVolt'
): Promise<{ content: string; usedRAG: boolean; sourcesUsed: string[]; noKnowledge?: boolean }> {
  const openaiKey = process.env.OPENAI_API_KEY;
  
  if (!openaiKey) {
    throw new Error('OpenAI API key not configured');
  }
  
  console.log(`🤖 [CustomerAI] Searching knowledge base for: "${userMessage.substring(0, 100)}..."`);
  
  // Step 1: Search vector database for relevant knowledge (lower threshold to catch more)
  const searchResults = await searchKnowledgeBase(userMessage, 5, 0.5);
  const context = buildContext(searchResults);
  const sourcesUsed = [...new Set(searchResults.map(r => r.source))];
  
  console.log(`🤖 [CustomerAI] Found ${searchResults.length} results, sources: ${sourcesUsed.join(', ') || 'none'}`);
  
  // STRICT RAG: If no knowledge found, return a canned response - DO NOT let GPT make up answers
  if (searchResults.length === 0) {
    console.log(`🤖 [CustomerAI] NO KNOWLEDGE FOUND - returning strict no-knowledge response`);
    return {
      content: `I apologize, but I don't have specific information about that in my knowledge base. 

To get accurate information about ${platformName}, I'd recommend:
• Checking our Help section for guides and FAQs
• Speaking with one of our support team members who can help you directly

Would you like me to connect you with a human support agent? Just say "human" or "agent" and I'll transfer you right away!`,
      usedRAG: false,
      sourcesUsed: [],
      noKnowledge: true,
    };
  }
  
  // Step 2: Build RAG-based system prompt that USES the context
  const systemPrompt = `You are a friendly customer support assistant for ${platformName}.

YOUR TASK: Answer the customer's question using the KNOWLEDGE BASE below.

RULES:
1. READ the KNOWLEDGE BASE carefully - the answer is likely there.
2. Use the information to give a helpful, accurate answer.
3. Be conversational and friendly, not robotic.
4. If the KNOWLEDGE BASE contains related information, use it to help the customer.
5. Only say "I don't have that information" if the KNOWLEDGE BASE truly has NOTHING relevant.
6. NEVER make up information not in the KNOWLEDGE BASE.
7. NEVER mention competitors or other platforms.

KNOWLEDGE BASE:
${context}

IMPORTANT: The customer is asking a question. Look through the KNOWLEDGE BASE above and answer based on what you find. Be helpful!`;
  
  // Step 3: Call OpenAI with STRICT RAG-constrained prompt
  console.log(`🤖 [CustomerAI] Calling OpenAI with ${searchResults.length} knowledge chunks...`);
  
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
        ...conversationHistory.slice(-6), // Last 6 messages for context
        { role: 'user', content: userMessage },
      ],
      max_tokens: 400,
      temperature: 0.3, // Very low temperature for strict factual responses from context
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
