import {
  Schema,
  model,
  models,
  type Document,
  type Model,
  Types,
} from "mongoose";

// ============================================
// AI Knowledge Source - Tracks uploaded documents and URLs
// ============================================

export type SourceType = "document" | "url" | "help_article" | "manual";

// CRITICAL: Audience determines which AI agents can access this knowledge
// - 'customer': ONLY customer support AI (public-facing, safe info)
// - 'admin': ONLY admin AI agent (internal data, company info)
// - 'both': Accessible by both agents
export type KnowledgeAudience = "customer" | "admin" | "both";

export interface IAIKnowledgeSource extends Document {
  _id: Types.ObjectId;
  name: string;
  type: SourceType;
  audience: KnowledgeAudience; // NEW: Who can access this knowledge
  originalFileName?: string;
  fileUrl?: string;
  websiteUrl?: string;
  helpArticleId?: string;
  mimeType?: string;
  fileSize?: number;
  status: "pending" | "processing" | "completed" | "failed";
  errorMessage?: string;
  chunksCount: number;
  tokensCount: number;
  lastProcessedAt?: Date;
  isActive: boolean;
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    category?: string;
    tags?: string[];
  };
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const AIKnowledgeSourceSchema = new Schema<IAIKnowledgeSource>(
  {
    name: { type: String, required: true },
    type: {
      type: String,
      enum: ["document", "url", "help_article", "manual"],
      required: true,
    },
    audience: {
      type: String,
      enum: ["customer", "admin", "both"],
      default: "customer", // Default to customer for safety
      required: true,
    },
    originalFileName: { type: String },
    fileUrl: { type: String },
    websiteUrl: { type: String },
    helpArticleId: { type: String },
    mimeType: { type: String },
    fileSize: { type: Number },
    status: {
      type: String,
      enum: ["pending", "processing", "completed", "failed"],
      default: "pending",
    },
    errorMessage: { type: String },
    chunksCount: { type: Number, default: 0 },
    tokensCount: { type: Number, default: 0 },
    lastProcessedAt: { type: Date },
    isActive: { type: Boolean, default: true },
    metadata: {
      title: { type: String },
      description: { type: String },
      author: { type: String },
      category: { type: String },
      tags: [{ type: String }],
    },
    createdBy: { type: String, required: true },
  },
  { timestamps: true },
);

// Index for efficient queries
AIKnowledgeSourceSchema.index({ type: 1, status: 1 });
AIKnowledgeSourceSchema.index({ isActive: 1 });
AIKnowledgeSourceSchema.index({ audience: 1 }); // NEW: Index for audience filtering
AIKnowledgeSourceSchema.index({ "metadata.category": 1 });

export const AIKnowledgeSource: Model<IAIKnowledgeSource> =
  models?.AIKnowledgeSource ||
  model<IAIKnowledgeSource>("AIKnowledgeSource", AIKnowledgeSourceSchema);

// ============================================
// AI Knowledge Chunk - Vectorized text chunks
// ============================================

export interface IAIKnowledgeChunk extends Document {
  _id: Types.ObjectId;
  sourceId: Types.ObjectId;
  audience: KnowledgeAudience; // Denormalized for fast filtering
  content: string;
  contentHash: string; // For deduplication
  embedding: number[]; // Vector embedding (1536 dimensions for OpenAI ada-002)
  headingPath: string[]; // e.g., ["Getting Started", "Installation", "Requirements"]
  headingLevel: number; // 1-6 for h1-h6
  chunkIndex: number; // Order within source
  tokenCount: number;
  metadata: {
    pageNumber?: number;
    sectionTitle?: string;
    parentChunkId?: string;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AIKnowledgeChunkSchema = new Schema<IAIKnowledgeChunk>(
  {
    sourceId: {
      type: Schema.Types.ObjectId,
      ref: "AIKnowledgeSource",
      required: true,
    },
    audience: {
      type: String,
      enum: ["customer", "admin", "both"],
      default: "customer",
      required: true,
    },
    content: { type: String, required: true },
    contentHash: { type: String, required: true },
    embedding: { type: [Number], required: true },
    headingPath: [{ type: String }],
    headingLevel: { type: Number, default: 0 },
    chunkIndex: { type: Number, required: true },
    tokenCount: { type: Number, default: 0 },
    metadata: {
      pageNumber: { type: Number },
      sectionTitle: { type: String },
      parentChunkId: { type: String },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Indexes for efficient vector search and retrieval
AIKnowledgeChunkSchema.index({ sourceId: 1 });
AIKnowledgeChunkSchema.index({ contentHash: 1 }, { unique: true });
AIKnowledgeChunkSchema.index({ isActive: 1 });
AIKnowledgeChunkSchema.index({ audience: 1, isActive: 1 }); // NEW: Fast audience filtering
AIKnowledgeChunkSchema.index({
  "metadata.sectionTitle": "text",
  content: "text",
});

export const AIKnowledgeChunk: Model<IAIKnowledgeChunk> =
  models?.AIKnowledgeChunk ||
  model<IAIKnowledgeChunk>("AIKnowledgeChunk", AIKnowledgeChunkSchema);

// ============================================
// AI Knowledge Settings - Configuration
// ============================================

export interface IAIKnowledgeSettings extends Document {
  _id: string;
  autoIndexHelpArticles: boolean;
  autoIndexOnHelpUpdate: boolean;
  chunkSize: number; // Target tokens per chunk
  chunkOverlap: number; // Overlap tokens between chunks
  embeddingModel: string;
  maxChunksPerQuery: number; // Max chunks to retrieve per query
  similarityThreshold: number; // Minimum similarity score (0-1)
  categories: string[];
  lastFullIndexAt?: Date;
  updatedAt: Date;
}

const AIKnowledgeSettingsSchema = new Schema<IAIKnowledgeSettings>(
  {
    _id: { type: String, default: "ai-knowledge-settings" },
    autoIndexHelpArticles: { type: Boolean, default: true },
    autoIndexOnHelpUpdate: { type: Boolean, default: true },
    chunkSize: { type: Number, default: 500 }, // ~500 tokens per chunk
    chunkOverlap: { type: Number, default: 50 }, // 50 token overlap
    embeddingModel: { type: String, default: "text-embedding-ada-002" },
    maxChunksPerQuery: { type: Number, default: 5 },
    similarityThreshold: { type: Number, default: 0.7 },
    categories: [{ type: String }],
    lastFullIndexAt: { type: Date },
  },
  { timestamps: true },
);

export const AIKnowledgeSettings: Model<IAIKnowledgeSettings> =
  models?.AIKnowledgeSettings ||
  model<IAIKnowledgeSettings>("AIKnowledgeSettings", AIKnowledgeSettingsSchema);
