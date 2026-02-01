import crypto from "crypto";
import { connectToDatabase } from "@/database/mongoose";
import {
  AIKnowledgeSource,
  AIKnowledgeChunk,
  AIKnowledgeSettings,
  IAIKnowledgeSource,
  IAIKnowledgeChunk,
  SourceType,
  KnowledgeAudience,
} from "@/database/models/ai-knowledge.model";
import { getSettings } from "@/lib/services/settings.service";

// ============================================
// Text Splitter - Splits text by headings
// ============================================

interface TextChunk {
  content: string;
  headingPath: string[];
  headingLevel: number;
  tokenCount: number;
}

/**
 * Split text by markdown headings while preserving context
 */
export function splitTextByHeadings(
  text: string,
  maxTokens: number = 500,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  const lines = text.split("\n");

  let currentChunk = "";
  let currentHeadingPath: string[] = [];
  let currentHeadingLevel = 0;

  // Track heading hierarchy
  const headingStack: { level: number; text: string }[] = [];

  for (const line of lines) {
    // Check if line is a heading
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      // Save current chunk if not empty
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          headingPath: [...currentHeadingPath],
          headingLevel: currentHeadingLevel,
          tokenCount: estimateTokens(currentChunk),
        });
        currentChunk = "";
      }

      const level = headingMatch[1].length;
      const headingText = headingMatch[2].trim();

      // Update heading stack
      while (
        headingStack.length > 0 &&
        headingStack[headingStack.length - 1].level >= level
      ) {
        headingStack.pop();
      }
      headingStack.push({ level, text: headingText });

      // Update current heading path
      currentHeadingPath = headingStack.map((h) => h.text);
      currentHeadingLevel = level;

      // Add heading to current chunk
      currentChunk = line + "\n";
    } else {
      // Check if adding this line would exceed max tokens
      const potentialChunk = currentChunk + line + "\n";
      const potentialTokens = estimateTokens(potentialChunk);

      if (potentialTokens > maxTokens && currentChunk.trim()) {
        // Save current chunk and start new one
        chunks.push({
          content: currentChunk.trim(),
          headingPath: [...currentHeadingPath],
          headingLevel: currentHeadingLevel,
          tokenCount: estimateTokens(currentChunk),
        });

        // Start new chunk with context (heading path)
        const contextPrefix =
          currentHeadingPath.length > 0
            ? `[Context: ${currentHeadingPath.join(" > ")}]\n\n`
            : "";
        currentChunk = contextPrefix + line + "\n";
      } else {
        currentChunk += line + "\n";
      }
    }
  }

  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      headingPath: [...currentHeadingPath],
      headingLevel: currentHeadingLevel,
      tokenCount: estimateTokens(currentChunk),
    });
  }

  return chunks;
}

/**
 * Estimate token count (rough approximation: ~4 chars per token)
 */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Generate content hash for deduplication
 */
export function generateContentHash(content: string): string {
  return crypto.createHash("sha256").update(content).digest("hex").slice(0, 32);
}

// ============================================
// Embedding Service - Generate embeddings using OpenAI
// ============================================

/**
 * Generate embeddings for text using OpenAI API
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const settings = await getSettings();
  const openaiKey = settings?.openaiApiKey || process.env.OPENAI_API_KEY;

  if (!openaiKey) {
    throw new Error("OpenAI API key not configured");
  }

  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "text-embedding-ada-002",
      input: text.slice(0, 8000), // Truncate to ~8000 chars for safety
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(
      `OpenAI API error: ${error.error?.message || response.statusText}`,
    );
  }

  const data = await response.json();
  return data.data[0].embedding;
}

/**
 * Calculate cosine similarity between two vectors
 */
export function cosineSimilarity(a: number[], b: number[]): number {
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

// ============================================
// Knowledge Base Service
// ============================================

export class AIKnowledgeService {
  /**
   * Get or create settings
   */
  async getSettings() {
    await connectToDatabase();
    let settings = await AIKnowledgeSettings.findById("ai-knowledge-settings");

    if (!settings) {
      settings = await AIKnowledgeSettings.create({
        _id: "ai-knowledge-settings",
        autoIndexHelpArticles: true,
        autoIndexOnHelpUpdate: true,
        chunkSize: 500,
        chunkOverlap: 50,
        embeddingModel: "text-embedding-ada-002",
        maxChunksPerQuery: 5,
        similarityThreshold: 0.7,
        categories: [
          "General",
          "Trading",
          "Competitions",
          "Challenges",
          "Wallet",
          "Technical",
        ],
      });
    }

    return settings;
  }

  /**
   * Update settings
   */
  async updateSettings(updates: Partial<typeof AIKnowledgeSettings.prototype>) {
    await connectToDatabase();
    return AIKnowledgeSettings.findByIdAndUpdate(
      "ai-knowledge-settings",
      { $set: updates },
      { new: true, upsert: true },
    );
  }

  /**
   * Get all knowledge sources
   */
  async getSources(filters?: {
    type?: SourceType;
    status?: string;
    isActive?: boolean;
  }) {
    await connectToDatabase();
    const query: any = {};

    if (filters?.type) query.type = filters.type;
    if (filters?.status) query.status = filters.status;
    if (filters?.isActive !== undefined) query.isActive = filters.isActive;

    return AIKnowledgeSource.find(query).sort({ createdAt: -1 });
  }

  /**
   * Get source by ID
   */
  async getSource(id: string) {
    await connectToDatabase();
    return AIKnowledgeSource.findById(id);
  }

  /**
   * Create a new knowledge source
   * @param audience - 'customer' (customer support only), 'admin' (admin AI only), 'both' (accessible by both)
   */
  async createSource(data: {
    name: string;
    type: SourceType;
    audience?: KnowledgeAudience; // NEW: Who can access this knowledge
    content?: string;
    fileUrl?: string;
    websiteUrl?: string;
    helpArticleId?: string;
    originalFileName?: string;
    mimeType?: string;
    fileSize?: number;
    metadata?: {
      title?: string;
      description?: string;
      author?: string;
      category?: string;
      tags?: string[];
    };
    createdBy: string;
  }) {
    await connectToDatabase();

    const source = await AIKnowledgeSource.create({
      ...data,
      audience: data.audience || "customer", // Default to customer for safety
      status: "pending",
    });

    // If content is provided, process it immediately
    if (data.content) {
      await this.processSource(source._id.toString(), data.content);
    }

    return source;
  }

  /**
   * Process a source and create chunks
   */
  async processSource(sourceId: string, content: string) {
    await connectToDatabase();

    const source = await AIKnowledgeSource.findById(sourceId);
    if (!source) throw new Error("Source not found");

    try {
      // Update status to processing
      source.status = "processing";
      await source.save();

      // Get settings for chunk size
      const settings = await this.getSettings();

      // Split text into chunks
      const chunks = splitTextByHeadings(content, settings.chunkSize);

      console.log(
        `[AI Knowledge] Processing source ${sourceId}: ${chunks.length} chunks`,
      );

      // Delete existing chunks for this source
      await AIKnowledgeChunk.deleteMany({ sourceId: source._id });

      let totalTokens = 0;
      const createdChunks: any[] = [];

      // Process each chunk
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const contentHash = generateContentHash(chunk.content);

        // Check for duplicate
        const existingChunk = await AIKnowledgeChunk.findOne({ contentHash });
        if (existingChunk) {
          console.log(`[AI Knowledge] Skipping duplicate chunk ${i}`);
          continue;
        }

        // Generate embedding
        const embedding = await generateEmbedding(chunk.content);

        // Create chunk with audience from source
        const newChunk = await AIKnowledgeChunk.create({
          sourceId: source._id,
          audience: source.audience || "customer", // Copy audience from source
          content: chunk.content,
          contentHash,
          embedding,
          headingPath: chunk.headingPath,
          headingLevel: chunk.headingLevel,
          chunkIndex: i,
          tokenCount: chunk.tokenCount,
          metadata: {
            sectionTitle:
              chunk.headingPath[chunk.headingPath.length - 1] || source.name,
          },
          isActive: true,
        });

        createdChunks.push(newChunk);
        totalTokens += chunk.tokenCount;

        // Small delay to avoid rate limiting
        if (i < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
      }

      // Update source with stats
      source.status = "completed";
      source.chunksCount = createdChunks.length;
      source.tokensCount = totalTokens;
      source.lastProcessedAt = new Date();
      await source.save();

      console.log(
        `[AI Knowledge] Source ${sourceId} processed: ${createdChunks.length} chunks, ${totalTokens} tokens`,
      );

      return { chunks: createdChunks.length, tokens: totalTokens };
    } catch (error) {
      console.error(
        `[AI Knowledge] Error processing source ${sourceId}:`,
        error,
      );

      source.status = "failed";
      source.errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      await source.save();

      throw error;
    }
  }

  /**
   * Delete a source and its chunks
   */
  async deleteSource(sourceId: string) {
    await connectToDatabase();

    // Delete all chunks
    await AIKnowledgeChunk.deleteMany({ sourceId });

    // Delete source
    await AIKnowledgeSource.findByIdAndDelete(sourceId);

    return true;
  }

  /**
   * Toggle source active status
   */
  async toggleSourceActive(sourceId: string, isActive: boolean) {
    await connectToDatabase();

    // Update source
    await AIKnowledgeSource.findByIdAndUpdate(sourceId, { isActive });

    // Update all chunks
    await AIKnowledgeChunk.updateMany({ sourceId }, { isActive });

    return true;
  }

  /**
   * Search knowledge base with semantic similarity
   * @param audience - Filter by audience: 'customer', 'admin', or 'both'
   *   - For customer AI: pass 'customer' - will search 'customer' and 'both'
   *   - For admin AI: pass 'admin' - will search 'admin' and 'both'
   */
  async search(
    query: string,
    options?: {
      maxResults?: number;
      threshold?: number;
      category?: string;
      sourceTypes?: SourceType[];
      audience?: "customer" | "admin"; // NEW: Filter by audience
    },
  ) {
    await connectToDatabase();

    const settings = await this.getSettings();
    const maxResults = options?.maxResults || settings.maxChunksPerQuery;
    const threshold = options?.threshold || settings.similarityThreshold;

    // Generate query embedding
    const queryEmbedding = await generateEmbedding(query);

    // Build match query with audience filtering
    const matchQuery: any = { isActive: true };

    // SECURITY: Filter by audience
    // Customer AI can only see 'customer' and 'both'
    // Admin AI can see 'admin' and 'both'
    if (options?.audience === "customer") {
      matchQuery.audience = { $in: ["customer", "both"] };
      console.log("[AI Knowledge] Filtering for CUSTOMER audience");
    } else if (options?.audience === "admin") {
      matchQuery.audience = { $in: ["admin", "both"] };
      console.log("[AI Knowledge] Filtering for ADMIN audience");
    }
    // If no audience specified, search all (for admin panel testing)

    if (options?.sourceTypes?.length) {
      const sources = await AIKnowledgeSource.find({
        type: { $in: options.sourceTypes },
        isActive: true,
      }).select("_id");
      matchQuery.sourceId = { $in: sources.map((s) => s._id) };
    }

    if (options?.category) {
      const sources = await AIKnowledgeSource.find({
        "metadata.category": options.category,
        isActive: true,
      }).select("_id");
      if (matchQuery.sourceId) {
        matchQuery.sourceId = {
          $in: sources
            .map((s) => s._id)
            .filter((id) =>
              matchQuery.sourceId.$in.some((mId: any) => mId.equals(id)),
            ),
        };
      } else {
        matchQuery.sourceId = { $in: sources.map((s) => s._id) };
      }
    }

    // Get all active chunks
    const chunks = await AIKnowledgeChunk.find(matchQuery)
      .populate("sourceId", "name type metadata")
      .lean();

    // Calculate similarities and sort
    const results = chunks
      .map((chunk) => ({
        ...chunk,
        similarity: cosineSimilarity(queryEmbedding, chunk.embedding),
      }))
      .filter((chunk) => chunk.similarity >= threshold)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, maxResults);

    return results;
  }

  /**
   * Get context for AI response
   */
  async getContextForQuery(
    query: string,
    maxTokens: number = 2000,
  ): Promise<string> {
    const results = await this.search(query, { maxResults: 10 });

    let context = "";
    let totalTokens = 0;

    for (const result of results) {
      const chunkTokens = result.tokenCount || estimateTokens(result.content);

      if (totalTokens + chunkTokens > maxTokens) break;

      const source = result.sourceId as any;
      const sourceName = source?.name || "Unknown";

      context += `\n---\n[Source: ${sourceName}]\n`;
      if (result.headingPath.length > 0) {
        context += `[Section: ${result.headingPath.join(" > ")}]\n`;
      }
      context += `${result.content}\n`;

      totalTokens += chunkTokens;
    }

    return context.trim();
  }

  /**
   * Get statistics
   */
  async getStats() {
    await connectToDatabase();

    const [sources, chunks] = await Promise.all([
      AIKnowledgeSource.aggregate([
        { $match: { isActive: true } },
        {
          $group: {
            _id: "$type",
            count: { $sum: 1 },
            totalChunks: { $sum: "$chunksCount" },
            totalTokens: { $sum: "$tokensCount" },
          },
        },
      ]),
      AIKnowledgeChunk.countDocuments({ isActive: true }),
    ]);

    return {
      totalSources: sources.reduce((acc, s) => acc + s.count, 0),
      totalChunks: chunks,
      totalTokens: sources.reduce((acc, s) => acc + s.totalTokens, 0),
      byType: sources,
    };
  }
}

// Export singleton instance
export const aiKnowledgeService = new AIKnowledgeService();
