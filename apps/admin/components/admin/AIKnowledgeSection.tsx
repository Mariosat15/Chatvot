'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Database,
  Upload,
  Globe,
  FileText,
  Trash2,
  RefreshCw,
  Settings,
  Search,
  Plus,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  BookOpen,
  Zap,
  BarChart3,
  Layers,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  HelpCircle,
  Save,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { toast } from 'sonner';

interface KnowledgeSource {
  _id: string;
  name: string;
  type: 'document' | 'url' | 'help_article' | 'manual';
  originalFileName?: string;
  fileUrl?: string;
  websiteUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  errorMessage?: string;
  chunksCount: number;
  tokensCount: number;
  lastProcessedAt?: string;
  isActive: boolean;
  metadata: {
    title?: string;
    description?: string;
    category?: string;
    tags?: string[];
  };
  createdAt: string;
}

interface KnowledgeSettings {
  autoIndexHelpArticles: boolean;
  autoIndexOnHelpUpdate: boolean;
  chunkSize: number;
  chunkOverlap: number;
  maxChunksPerQuery: number;
  similarityThreshold: number;
  categories: string[];
}

interface Stats {
  totalSources: number;
  totalChunks: number;
  totalTokens: number;
  byType: { _id: string; count: number; totalChunks: number; totalTokens: number }[];
}

export default function AIKnowledgeSection() {
  const [sources, setSources] = useState<KnowledgeSource[]>([]);
  const [settings, setSettings] = useState<KnowledgeSettings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'sources' | 'settings' | 'test'>('sources');
  const [indexingHelp, setIndexingHelp] = useState(false);
  const [helpIndexed, setHelpIndexed] = useState(false);
  
  // Add source modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addType, setAddType] = useState<'document' | 'url' | 'manual'>('document');
  
  // Form states
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formCategory, setFormCategory] = useState('General');
  const [formDescription, setFormDescription] = useState('');
  const [formTags, setFormTags] = useState('');
  const [uploading, setUploading] = useState(false);
  
  // Test search
  const [testQuery, setTestQuery] = useState('');
  const [testResults, setTestResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [dataResponse, helpResponse] = await Promise.all([
        fetch('/api/ai-knowledge?stats=true'),
        fetch('/api/ai-knowledge/index-help'),
      ]);
      
      if (dataResponse.ok) {
        const data = await dataResponse.json();
        setSources(data.sources || []);
        setSettings(data.settings);
        setStats(data.stats);
      }
      
      if (helpResponse.ok) {
        const helpData = await helpResponse.json();
        setHelpIndexed(helpData.indexed);
      }
    } catch (error) {
      console.error('Error fetching AI knowledge data:', error);
      toast.error('Failed to fetch AI knowledge data');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleIndexHelp = async (force = false) => {
    setIndexingHelp(true);
    try {
      const response = await fetch('/api/ai-knowledge/index-help', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        if (data.alreadyIndexed) {
          toast.info('Built-in help is already indexed');
        } else {
          toast.success('Built-in help indexed successfully');
        }
        setHelpIndexed(true);
        fetchData();
      } else {
        toast.error(data.error || 'Failed to index help');
      }
    } catch (error) {
      toast.error('Failed to index help');
    } finally {
      setIndexingHelp(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleUploadDocument = async (file: File) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', formName || file.name);
      formData.append('category', formCategory);
      formData.append('description', formDescription);
      formData.append('tags', formTags);

      const response = await fetch('/api/ai-knowledge/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Document uploaded and processing started');
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to upload document');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleAddUrl = async () => {
    if (!formUrl) {
      toast.error('Please enter a URL');
      return;
    }

    setUploading(true);
    try {
      const response = await fetch('/api/ai-knowledge/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: formUrl,
          name: formName,
          category: formCategory,
          description: formDescription,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('URL scraped and indexed successfully');
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to scrape URL');
      }
    } catch (error) {
      console.error('Error scraping URL:', error);
      toast.error('Failed to scrape URL');
    } finally {
      setUploading(false);
    }
  };

  const handleAddManual = async () => {
    if (!formName || !formContent) {
      toast.error('Please enter a name and content');
      return;
    }

    setUploading(true);
    try {
      const response = await fetch('/api/ai-knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName,
          type: 'manual',
          content: formContent,
          metadata: {
            category: formCategory,
            description: formDescription,
            tags: formTags ? formTags.split(',').map(t => t.trim()) : [],
          },
        }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success('Knowledge entry created successfully');
        setShowAddModal(false);
        resetForm();
        fetchData();
      } else {
        toast.error(data.error || 'Failed to create entry');
      }
    } catch (error) {
      console.error('Error creating entry:', error);
      toast.error('Failed to create entry');
    } finally {
      setUploading(false);
    }
  };

  const handleToggleSource = async (id: string, currentActive: boolean) => {
    try {
      const response = await fetch(`/api/ai-knowledge/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', isActive: !currentActive }),
      });

      if (response.ok) {
        toast.success(`Source ${currentActive ? 'disabled' : 'enabled'}`);
        fetchData();
      } else {
        toast.error('Failed to toggle source');
      }
    } catch (error) {
      toast.error('Failed to toggle source');
    }
  };

  const handleDeleteSource = async (id: string) => {
    if (!confirm('Are you sure you want to delete this source? All associated chunks will be removed.')) {
      return;
    }

    try {
      const response = await fetch(`/api/ai-knowledge/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Source deleted');
        fetchData();
      } else {
        toast.error('Failed to delete source');
      }
    } catch (error) {
      toast.error('Failed to delete source');
    }
  };

  const handleSaveSettings = async () => {
    if (!settings) return;

    try {
      const response = await fetch('/api/ai-knowledge/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        toast.success('Settings saved');
      } else {
        toast.error('Failed to save settings');
      }
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const handleTestSearch = async () => {
    if (!testQuery) {
      toast.error('Please enter a search query');
      return;
    }

    setSearching(true);
    try {
      const response = await fetch('/api/ai-knowledge/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: testQuery, maxResults: 5 }),
      });

      const data = await response.json();

      if (response.ok) {
        setTestResults(data.results || []);
        if (data.results.length === 0) {
          toast.info('No matching results found');
        }
      } else {
        toast.error(data.error || 'Search failed');
      }
    } catch (error) {
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const resetForm = () => {
    setFormName('');
    setFormUrl('');
    setFormContent('');
    setFormCategory('General');
    setFormDescription('');
    setFormTags('');
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-400" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'document':
        return <FileText className="w-4 h-4" />;
      case 'url':
        return <Globe className="w-4 h-4" />;
      case 'help_article':
        return <HelpCircle className="w-4 h-4" />;
      default:
        return <BookOpen className="w-4 h-4" />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <Database className="w-7 h-7 text-purple-400" />
            AI Knowledge Base
          </h2>
          <p className="text-gray-400 mt-1">
            Manage documents and websites for AI agent knowledge
          </p>
        </div>
        <div className="flex items-center gap-3">
          {!helpIndexed && (
            <button
              onClick={() => handleIndexHelp(false)}
              disabled={indexingHelp}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
              title="Index the built-in platform documentation"
            >
              {indexingHelp ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <BookOpen className="w-4 h-4" />
              )}
              Index Built-in Help
            </button>
          )}
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Knowledge
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <Layers className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalSources}</p>
                <p className="text-sm text-gray-400">Total Sources</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <BarChart3 className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalChunks.toLocaleString()}</p>
                <p className="text-sm text-gray-400">Total Chunks</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Zap className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">{stats.totalTokens.toLocaleString()}</p>
                <p className="text-sm text-gray-400">Total Tokens</p>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-500/20 rounded-lg">
                <Database className="w-5 h-5 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-white">
                  ~{((stats.totalTokens * 4) / 1024 / 1024).toFixed(2)} MB
                </p>
                <p className="text-sm text-gray-400">Est. Data Size</p>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700/50 pb-2">
        {(['sources', 'settings', 'test'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg transition-colors capitalize ${
              activeTab === tab
                ? 'bg-purple-600 text-white'
                : 'bg-gray-800/50 text-gray-400 hover:bg-gray-700/50'
            }`}
          >
            {tab === 'test' ? 'Test Search' : tab}
          </button>
        ))}
      </div>

      {/* Sources Tab */}
      {activeTab === 'sources' && (
        <div className="space-y-4">
          {sources.length === 0 ? (
            <div className="text-center py-12 bg-gray-800/30 rounded-xl border border-gray-700/50">
              <Database className="w-12 h-12 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">No knowledge sources yet</p>
              <p className="text-gray-500 text-sm mt-1">
                Add documents, URLs, or manual entries to build your AI knowledge base
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sources.map((source) => (
                <motion.div
                  key={source._id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`bg-gray-800/50 rounded-xl p-4 border ${
                    source.isActive ? 'border-gray-700/50' : 'border-gray-700/30 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${
                        source.type === 'document' ? 'bg-blue-500/20 text-blue-400' :
                        source.type === 'url' ? 'bg-green-500/20 text-green-400' :
                        source.type === 'help_article' ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-purple-500/20 text-purple-400'
                      }`}>
                        {getTypeIcon(source.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-white">{source.name}</h3>
                          {getStatusIcon(source.status)}
                          <span className={`text-xs px-2 py-0.5 rounded ${
                            source.status === 'completed' ? 'bg-green-500/20 text-green-400' :
                            source.status === 'processing' ? 'bg-blue-500/20 text-blue-400' :
                            source.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                            'bg-yellow-500/20 text-yellow-400'
                          }`}>
                            {source.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-gray-400">
                          <span className="capitalize">{source.type}</span>
                          {source.metadata?.category && (
                            <span className="text-purple-400">{source.metadata.category}</span>
                          )}
                          {source.chunksCount > 0 && (
                            <span>{source.chunksCount} chunks</span>
                          )}
                          {source.tokensCount > 0 && (
                            <span>{source.tokensCount.toLocaleString()} tokens</span>
                          )}
                        </div>
                        {source.websiteUrl && (
                          <a
                            href={source.websiteUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            {source.websiteUrl}
                          </a>
                        )}
                        {source.errorMessage && (
                          <p className="text-xs text-red-400 mt-1">{source.errorMessage}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleToggleSource(source._id, source.isActive)}
                        className="p-2 hover:bg-gray-700/50 rounded-lg transition-colors"
                        title={source.isActive ? 'Disable' : 'Enable'}
                      >
                        {source.isActive ? (
                          <ToggleRight className="w-5 h-5 text-green-400" />
                        ) : (
                          <ToggleLeft className="w-5 h-5 text-gray-500" />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteSource(source._id)}
                        className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400"
                        title="Delete"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && settings && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Auto-index settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <HelpCircle className="w-5 h-5 text-purple-400" />
                Help Articles Integration
              </h3>
              
              <label className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-300">Auto-index help articles</span>
                <button
                  onClick={() => setSettings({ ...settings, autoIndexHelpArticles: !settings.autoIndexHelpArticles })}
                  className={`p-1 rounded-full transition-colors ${
                    settings.autoIndexHelpArticles ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  {settings.autoIndexHelpArticles ? (
                    <ToggleRight className="w-6 h-6 text-white" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>
              </label>

              <label className="flex items-center justify-between p-3 bg-gray-700/30 rounded-lg">
                <span className="text-gray-300">Re-index on help update</span>
                <button
                  onClick={() => setSettings({ ...settings, autoIndexOnHelpUpdate: !settings.autoIndexOnHelpUpdate })}
                  className={`p-1 rounded-full transition-colors ${
                    settings.autoIndexOnHelpUpdate ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  {settings.autoIndexOnHelpUpdate ? (
                    <ToggleRight className="w-6 h-6 text-white" />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-400" />
                  )}
                </button>
              </label>
            </div>

            {/* Chunking settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Chunking Settings
              </h3>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Chunk Size (tokens)</label>
                <input
                  type="number"
                  value={settings.chunkSize}
                  onChange={(e) => setSettings({ ...settings, chunkSize: parseInt(e.target.value) || 500 })}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  min={100}
                  max={2000}
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Chunk Overlap (tokens)</label>
                <input
                  type="number"
                  value={settings.chunkOverlap}
                  onChange={(e) => setSettings({ ...settings, chunkOverlap: parseInt(e.target.value) || 50 })}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  min={0}
                  max={200}
                />
              </div>
            </div>

            {/* Search settings */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-purple-400" />
                Search Settings
              </h3>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Max Chunks per Query</label>
                <input
                  type="number"
                  value={settings.maxChunksPerQuery}
                  onChange={(e) => setSettings({ ...settings, maxChunksPerQuery: parseInt(e.target.value) || 5 })}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  min={1}
                  max={20}
                />
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Similarity Threshold (0-1)</label>
                <input
                  type="number"
                  step="0.05"
                  value={settings.similarityThreshold}
                  onChange={(e) => setSettings({ ...settings, similarityThreshold: parseFloat(e.target.value) || 0.7 })}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  min={0}
                  max={1}
                />
              </div>
            </div>

            {/* Categories */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-400" />
                Categories
              </h3>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Available Categories</label>
                <textarea
                  value={settings.categories.join('\n')}
                  onChange={(e) => setSettings({ ...settings, categories: e.target.value.split('\n').filter(c => c.trim()) })}
                  className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white h-32"
                  placeholder="One category per line"
                />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-gray-700/50">
            <button
              onClick={handleSaveSettings}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
            >
              <Save className="w-4 h-4" />
              Save Settings
            </button>
          </div>
        </div>
      )}

      {/* Test Search Tab */}
      {activeTab === 'test' && (
        <div className="bg-gray-800/50 rounded-xl p-6 border border-gray-700/50 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Search className="w-5 h-5 text-purple-400" />
              Test Knowledge Base Search
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              Test how the AI will retrieve knowledge from the database. Enter a question to see matching chunks.
            </p>
            
            <div className="flex gap-3">
              <input
                type="text"
                value={testQuery}
                onChange={(e) => setTestQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleTestSearch()}
                placeholder="Enter a question or topic..."
                className="flex-1 bg-gray-700/50 border border-gray-600 rounded-lg px-4 py-2 text-white"
              />
              <button
                onClick={handleTestSearch}
                disabled={searching}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {searching ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                Search
              </button>
            </div>
          </div>

          {testResults.length > 0 && (
            <div className="space-y-4">
              <h4 className="text-white font-medium">Results ({testResults.length})</h4>
              {testResults.map((result, index) => (
                <div
                  key={result.id || index}
                  className="bg-gray-700/30 rounded-lg p-4 border border-gray-600/50"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-purple-400">
                        {(result.similarity * 100).toFixed(1)}% match
                      </span>
                      {result.headingPath?.length > 0 && (
                        <span className="text-xs text-gray-500">
                          {result.headingPath.join(' > ')}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-gray-500">
                      {result.source?.name || 'Unknown source'}
                    </span>
                  </div>
                  <p className="text-gray-300 text-sm whitespace-pre-wrap line-clamp-4">
                    {result.content}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Knowledge Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setShowAddModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-gray-800 rounded-2xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Plus className="w-5 h-5 text-purple-400" />
                Add Knowledge Source
              </h3>

              {/* Type Selector */}
              <div className="flex gap-2 mb-6">
                {(['document', 'url', 'manual'] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setAddType(type)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      addType === type
                        ? 'bg-purple-600 text-white'
                        : 'bg-gray-700/50 text-gray-400 hover:bg-gray-700'
                    }`}
                  >
                    {type === 'document' ? <Upload className="w-4 h-4" /> :
                     type === 'url' ? <Globe className="w-4 h-4" /> :
                     <BookOpen className="w-4 h-4" />}
                    <span className="capitalize">{type}</span>
                  </button>
                ))}
              </div>

              <div className="space-y-4">
                {/* Common fields */}
                <div>
                  <label className="text-sm text-gray-400 block mb-1">Name</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Knowledge source name"
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Category</label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  >
                    {(settings?.categories || ['General', 'Trading', 'Competitions', 'Wallet', 'Technical']).map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Description (optional)</label>
                  <input
                    type="text"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    placeholder="Brief description"
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>

                {/* Type-specific fields */}
                {addType === 'document' && (
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Upload Document</label>
                    <input
                      type="file"
                      accept=".pdf,.txt,.md,.docx,.html"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleUploadDocument(file);
                      }}
                      disabled={uploading}
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white file:mr-4 file:py-1 file:px-3 file:rounded file:border-0 file:bg-purple-600 file:text-white file:cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Supported: PDF, TXT, Markdown, DOCX, HTML (max 10MB)
                    </p>
                  </div>
                )}

                {addType === 'url' && (
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Website URL</label>
                    <input
                      type="url"
                      value={formUrl}
                      onChange={(e) => setFormUrl(e.target.value)}
                      placeholder="https://example.com/page"
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                    />
                  </div>
                )}

                {addType === 'manual' && (
                  <div>
                    <label className="text-sm text-gray-400 block mb-1">Content</label>
                    <textarea
                      value={formContent}
                      onChange={(e) => setFormContent(e.target.value)}
                      placeholder="Enter knowledge content... Use Markdown headings (# ## ###) to structure the content."
                      className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white h-48 font-mono text-sm"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use Markdown headings (# ## ###) to structure content. Each section will become a separate chunk.
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-sm text-gray-400 block mb-1">Tags (comma separated)</label>
                  <input
                    type="text"
                    value={formTags}
                    onChange={(e) => setFormTags(e.target.value)}
                    placeholder="trading, basics, help"
                    className="w-full bg-gray-700/50 border border-gray-600 rounded-lg px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-700/50">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    resetForm();
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                {addType !== 'document' && (
                  <button
                    onClick={addType === 'url' ? handleAddUrl : handleAddManual}
                    disabled={uploading}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {uploading ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    Add {addType === 'url' ? 'URL' : 'Entry'}
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
