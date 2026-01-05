'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Bot,
  Send,
  Loader2,
  User,
  Sparkles,
  Settings,
  Trash2,
  Copy,
  Download,
  RefreshCw,
  Shield,
  Users,
  CreditCard,
  AlertTriangle,
  FileText,
  DollarSign,
  Table,
  LayoutGrid,
  List,
  ChevronDown,
  ChevronRight,
  Zap,
  Brain,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Eye,
  TrendingUp,
  Activity,
} from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  results?: AgentResult[];
  isStreaming?: boolean;
}

interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, any>;
  status: 'pending' | 'running' | 'completed' | 'error';
  result?: any;
}

interface AgentResult {
  type: 'table' | 'list' | 'cards' | 'stats' | 'chart' | 'text' | 'alert';
  title: string;
  data: any;
  columns?: { key: string; label: string; type?: 'text' | 'number' | 'date' | 'currency' | 'status' | 'badge' }[];
  actions?: { label: string; action: string; params: any }[];
}

interface AIConfig {
  enabled: boolean;
  model: string;
  hasApiKey: boolean;
}

// Quick action suggestions
const QUICK_ACTIONS = [
  { icon: <Users className="h-4 w-4" />, label: 'Find shared payment methods', prompt: 'Show me all users who share the same payment method' },
  { icon: <CreditCard className="h-4 w-4" />, label: 'Payment reconciliation', prompt: 'Run a reconciliation check on all deposits from the last 7 days' },
  { icon: <AlertTriangle className="h-4 w-4" />, label: 'Fraud alerts', prompt: 'Show me all active fraud alerts with high risk scores' },
  { icon: <Shield className="h-4 w-4" />, label: 'KYC status', prompt: 'List all users pending KYC verification' },
  { icon: <DollarSign className="h-4 w-4" />, label: 'Financial summary', prompt: 'Generate a financial summary for this month including deposits, withdrawals, and fees' },
  { icon: <TrendingUp className="h-4 w-4" />, label: 'User growth', prompt: 'Show me user registration trends for the last 30 days' },
  { icon: <Activity className="h-4 w-4" />, label: 'Active users', prompt: 'Who are the most active traders this week?' },
  { icon: <FileText className="h-4 w-4" />, label: 'Pending withdrawals', prompt: 'List all pending withdrawal requests that need review' },
];

export default function AIAgentSection() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'chat' | 'settings'>('chat');
  const [resultViewMode, setResultViewMode] = useState<'table' | 'cards' | 'list'>('table');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load AI config
  useEffect(() => {
    loadConfig();
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConfig = async () => {
    setConfigLoading(true);
    try {
      const res = await fetch('/api/ai-agent/config');
      if (res.ok) {
        const data = await res.json();
        setConfig(data);
      }
    } catch (error) {
      console.error('Failed to load AI config:', error);
    }
    setConfigLoading(false);
  };

  const handleSend = async (customPrompt?: string) => {
    const prompt = customPrompt || input.trim();
    if (!prompt || isLoading) return;

    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    // Add streaming assistant message
    const assistantMessageId = crypto.randomUUID();
    setMessages(prev => [...prev, {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      isStreaming: true,
    }]);

    try {
      const res = await fetch('/api/ai-agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to get response');
      }

      const data = await res.json();

      // Update assistant message with response
      setMessages(prev => prev.map(m => 
        m.id === assistantMessageId 
          ? {
              ...m,
              content: data.content,
              toolCalls: data.toolCalls,
              results: data.results,
              isStreaming: false,
            }
          : m
      ));

    } catch (error) {
      console.error('AI Agent error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to process request');
      
      // Remove the streaming message on error
      setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
    }

    setIsLoading(false);
    inputRef.current?.focus();
  };

  const clearChat = () => {
    setMessages([]);
    toast.success('Chat cleared');
  };

  const copyResult = (result: AgentResult) => {
    const text = JSON.stringify(result.data, null, 2);
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const exportResult = (result: AgentResult) => {
    const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${result.title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Exported successfully');
  };

  const renderResultValue = (value: any, type?: string) => {
    if (value === null || value === undefined) return <span className="text-gray-500">—</span>;
    
    switch (type) {
      case 'currency':
        return <span className="font-mono">€{typeof value === 'number' ? value.toFixed(2) : value}</span>;
      case 'date':
        return <span>{new Date(value).toLocaleDateString()}</span>;
      case 'status':
        const statusColors: Record<string, string> = {
          active: 'bg-green-500/20 text-green-400',
          pending: 'bg-yellow-500/20 text-yellow-400',
          completed: 'bg-blue-500/20 text-blue-400',
          failed: 'bg-red-500/20 text-red-400',
          suspended: 'bg-orange-500/20 text-orange-400',
          verified: 'bg-emerald-500/20 text-emerald-400',
        };
        return (
          <Badge className={cn('capitalize', statusColors[String(value).toLowerCase()] || 'bg-gray-500/20 text-gray-400')}>
            {String(value)}
          </Badge>
        );
      case 'badge':
        return <Badge variant="outline">{String(value)}</Badge>;
      case 'number':
        return <span className="font-mono">{typeof value === 'number' ? value.toLocaleString() : value}</span>;
      default:
        return <span className="truncate max-w-[200px]">{String(value)}</span>;
    }
  };

  const renderResult = (result: AgentResult) => {
    switch (result.type) {
      case 'stats':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(result.data).map(([key, value]: [string, any]) => (
              <Card key={key} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  <p className="text-sm text-gray-400 capitalize">{key.replace(/_/g, ' ')}</p>
                  <p className="text-2xl font-bold text-white">{typeof value === 'number' ? value.toLocaleString() : value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'alert':
        return (
          <div className={cn(
            'p-4 rounded-lg border',
            result.data.severity === 'high' ? 'bg-red-500/10 border-red-500/30' :
            result.data.severity === 'medium' ? 'bg-yellow-500/10 border-yellow-500/30' :
            'bg-blue-500/10 border-blue-500/30'
          )}>
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn(
                'h-5 w-5 mt-0.5',
                result.data.severity === 'high' ? 'text-red-400' :
                result.data.severity === 'medium' ? 'text-yellow-400' :
                'text-blue-400'
              )} />
              <div>
                <p className="font-medium text-white">{result.data.title}</p>
                <p className="text-sm text-gray-400 mt-1">{result.data.message}</p>
              </div>
            </div>
          </div>
        );

      case 'table':
        if (!result.columns || !Array.isArray(result.data)) return null;
        return (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  {result.columns.map(col => (
                    <th key={col.key} className="text-left p-3 text-gray-400 font-medium">
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.data.map((row: any, i: number) => (
                  <tr key={i} className="border-b border-gray-700/50 hover:bg-gray-800/50">
                    {result.columns!.map(col => (
                      <td key={col.key} className="p-3 text-gray-300">
                        {renderResultValue(row[col.key], col.type)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {result.data.length === 0 && (
              <p className="text-center text-gray-500 py-8">No data found</p>
            )}
          </div>
        );

      case 'cards':
        if (!Array.isArray(result.data)) return null;
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {result.data.map((item: any, i: number) => (
              <Card key={i} className="bg-gray-800/50 border-gray-700">
                <CardContent className="p-4">
                  {Object.entries(item).map(([key, value]: [string, any]) => (
                    <div key={key} className="flex justify-between items-center py-1">
                      <span className="text-sm text-gray-400 capitalize">{key.replace(/_/g, ' ')}</span>
                      <span className="text-sm text-white font-medium">{String(value)}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
          </div>
        );

      case 'list':
        if (!Array.isArray(result.data)) return null;
        return (
          <div className="space-y-2">
            {result.data.map((item: any, i: number) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-bold">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  {typeof item === 'object' ? (
                    <div className="flex flex-wrap gap-2">
                      {Object.entries(item).map(([key, value]: [string, any]) => (
                        <span key={key} className="text-sm">
                          <span className="text-gray-400">{key}:</span>{' '}
                          <span className="text-white">{String(value)}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-white">{String(item)}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        );

      case 'text':
        return (
          <div className="prose prose-invert max-w-none">
            <p className="text-gray-300 whitespace-pre-wrap">{result.data}</p>
          </div>
        );

      default:
        return (
          <pre className="text-sm text-gray-400 bg-gray-800/50 p-4 rounded-lg overflow-x-auto">
            {JSON.stringify(result.data, null, 2)}
          </pre>
        );
    }
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  if (!config?.enabled || !config?.hasApiKey) {
    return (
      <Card className="bg-gray-800/50 border-gray-700">
        <CardContent className="p-12 text-center">
          <div className="h-16 w-16 rounded-full bg-violet-500/20 flex items-center justify-center mx-auto mb-4">
            <Brain className="h-8 w-8 text-violet-400" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">AI Agent Not Configured</h3>
          <p className="text-gray-400 mb-6 max-w-md mx-auto">
            {!config?.hasApiKey 
              ? 'OpenAI API key is required to use the AI Agent. Please configure it in Environment Variables.'
              : 'AI features are disabled. Enable them in Environment Variables.'}
          </p>
          <Button
            onClick={() => window.location.href = '/dashboard?section=environment'}
            className="bg-violet-600 hover:bg-violet-700"
          >
            <Settings className="h-4 w-4 mr-2" />
            Configure Settings
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              AI Agent
              <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30">
                <Sparkles className="h-3 w-3 mr-1" />
                GPT-4
              </Badge>
            </h2>
            <p className="text-gray-400 text-sm">
              Intelligent assistant for back-office operations, security, and compliance
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={clearChat}
            disabled={messages.length === 0}
            className="border-gray-700 text-gray-400 hover:text-white"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Chat
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Chat Panel */}
        <div className="lg:col-span-3">
          <Card className="bg-gray-800/50 border-gray-700 h-[700px] flex flex-col">
            {/* Chat Messages */}
            <ScrollArea className="flex-1 p-4">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <div className="h-20 w-20 rounded-full bg-gradient-to-br from-violet-500/20 to-purple-600/20 flex items-center justify-center mb-6">
                    <Bot className="h-10 w-10 text-violet-400" />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">How can I help you today?</h3>
                  <p className="text-gray-400 max-w-md mb-8">
                    I can help you with fraud detection, user management, payment reconciliation, KYC checks, and more. Try asking me something or use a quick action.
                  </p>
                  
                  {/* Quick Actions Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full max-w-2xl">
                    {QUICK_ACTIONS.slice(0, 4).map((action, i) => (
                      <button
                        key={i}
                        onClick={() => handleSend(action.prompt)}
                        className="flex flex-col items-center gap-2 p-4 rounded-xl bg-gray-700/50 hover:bg-gray-700 border border-gray-600 hover:border-violet-500/50 transition-all group"
                      >
                        <div className="h-10 w-10 rounded-lg bg-violet-500/20 flex items-center justify-center text-violet-400 group-hover:bg-violet-500/30 transition-colors">
                          {action.icon}
                        </div>
                        <span className="text-xs text-gray-300 text-center leading-tight">{action.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {messages.map((message) => (
                    <div key={message.id} className={cn(
                      'flex gap-3',
                      message.role === 'user' ? 'justify-end' : 'justify-start'
                    )}>
                      {message.role === 'assistant' && (
                        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shrink-0">
                          <Bot className="h-4 w-4 text-white" />
                        </div>
                      )}
                      
                      <div className={cn(
                        'max-w-[80%] space-y-3',
                        message.role === 'user' ? 'items-end' : 'items-start'
                      )}>
                        {/* Message Content */}
                        <div className={cn(
                          'rounded-2xl px-4 py-3',
                          message.role === 'user' 
                            ? 'bg-violet-600 text-white rounded-br-sm'
                            : 'bg-gray-700/50 text-gray-100 rounded-bl-sm'
                        )}>
                          {message.isStreaming ? (
                            <div className="flex items-center gap-2">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              <span className="text-gray-400">Thinking...</span>
                            </div>
                          ) : (
                            <p className="whitespace-pre-wrap">{message.content}</p>
                          )}
                        </div>

                        {/* Tool Calls */}
                        {message.toolCalls && message.toolCalls.length > 0 && (
                          <div className="space-y-2">
                            {message.toolCalls.map((tool) => (
                              <div key={tool.id} className="flex items-center gap-2 text-sm">
                                {tool.status === 'completed' ? (
                                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                                ) : tool.status === 'error' ? (
                                  <XCircle className="h-4 w-4 text-red-400" />
                                ) : (
                                  <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
                                )}
                                <span className="text-gray-400">
                                  {tool.name.replace(/_/g, ' ')}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Results */}
                        {message.results && message.results.length > 0 && (
                          <div className="space-y-4 w-full">
                            {message.results.map((result, i) => (
                              <Card key={i} className="bg-gray-800/80 border-gray-700">
                                <CardHeader className="pb-2">
                                  <div className="flex items-center justify-between">
                                    <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                                      {result.type === 'table' && <Table className="h-4 w-4 text-violet-400" />}
                                      {result.type === 'stats' && <TrendingUp className="h-4 w-4 text-violet-400" />}
                                      {result.type === 'alert' && <AlertTriangle className="h-4 w-4 text-violet-400" />}
                                      {result.title}
                                    </CardTitle>
                                    <div className="flex items-center gap-1">
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => copyResult(result)}
                                      >
                                        <Copy className="h-3.5 w-3.5" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => exportResult(result)}
                                      >
                                        <Download className="h-3.5 w-3.5" />
                                      </Button>
                                    </div>
                                  </div>
                                </CardHeader>
                                <CardContent className="pt-2">
                                  {renderResult(result)}
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}

                        {/* Timestamp */}
                        <span className="text-xs text-gray-500">
                          {message.timestamp.toLocaleTimeString()}
                        </span>
                      </div>

                      {message.role === 'user' && (
                        <div className="h-8 w-8 rounded-lg bg-gray-700 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-gray-400" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-gray-700">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex gap-3"
              >
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask me anything about users, payments, fraud, reconciliation..."
                  className="flex-1 bg-gray-700/50 border-gray-600 text-white placeholder:text-gray-500"
                  disabled={isLoading}
                />
                <Button 
                  type="submit" 
                  disabled={isLoading || !input.trim()}
                  className="bg-violet-600 hover:bg-violet-700"
                >
                  {isLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </form>
            </div>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Quick Actions */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-400" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {QUICK_ACTIONS.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(action.prompt)}
                  disabled={isLoading}
                  className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-gray-700/30 hover:bg-gray-700/50 border border-gray-700 hover:border-violet-500/30 transition-all text-left group disabled:opacity-50"
                >
                  <div className="h-8 w-8 rounded-lg bg-gray-700 flex items-center justify-center text-gray-400 group-hover:text-violet-400 transition-colors shrink-0">
                    {action.icon}
                  </div>
                  <span className="text-sm text-gray-300 group-hover:text-white transition-colors">
                    {action.label}
                  </span>
                </button>
              ))}
            </CardContent>
          </Card>

          {/* Agent Capabilities */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-white flex items-center gap-2">
                <Brain className="h-4 w-4 text-violet-400" />
                Capabilities
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span>Fraud detection & analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span>Payment reconciliation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span>KYC status checks</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span>User data analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span>Financial reports</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span>Compliance monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-green-400" />
                  <span>Accounting summaries</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Model Info */}
          <Card className="bg-gray-800/50 border-gray-700">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-400">Model</span>
                <Badge className="bg-violet-500/20 text-violet-400">
                  {config?.model || 'gpt-4o-mini'}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

