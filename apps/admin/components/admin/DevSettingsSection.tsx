'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Play, 
  RefreshCw, 
  Trash2, 
  Terminal, 
  FileCode, 
  Folder,
  Server,
  Clock,
  ChevronDown,
  ChevronUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Copy
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface DevScript {
  name: string;
  path: string;
  fullPath: string;
  extension: string;
  size: number;
  modified: string;
  launchCommand: string;
  description: string;
}

interface ScriptsResponse {
  scripts: DevScript[];
  projectRoot: string;
  scriptsDir: string;
  platform: string;
  nodeVersion: string;
  message?: string;
}

interface ExecuteResult {
  success: boolean;
  output: string;
  error?: string;
  command: string;
  projectRoot: string;
  platform: string;
}

export default function DevSettingsSection() {
  const [scripts, setScripts] = useState<DevScript[]>([]);
  const [loading, setLoading] = useState(true);
  const [projectInfo, setProjectInfo] = useState<{
    projectRoot: string;
    scriptsDir: string;
    platform: string;
    nodeVersion: string;
  } | null>(null);
  const [executingScript, setExecutingScript] = useState<string | null>(null);
  const [clearingCache, setClearingCache] = useState(false);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);
  const [lastOutput, setLastOutput] = useState<Record<string, ExecuteResult>>({});

  useEffect(() => {
    fetchScripts();
  }, []);

  const fetchScripts = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dev-scripts');
      if (response.ok) {
        const data: ScriptsResponse = await response.json();
        setScripts(data.scripts);
        setProjectInfo({
          projectRoot: data.projectRoot,
          scriptsDir: data.scriptsDir,
          platform: data.platform,
          nodeVersion: data.nodeVersion,
        });
      } else {
        toast.error('Failed to load scripts');
      }
    } catch (error) {
      console.error('Error fetching scripts:', error);
      toast.error('Failed to load scripts');
    } finally {
      setLoading(false);
    }
  };

  const executeScript = async (scriptName: string) => {
    setExecutingScript(scriptName);
    setExpandedOutput(scriptName);
    
    try {
      const response = await fetch('/api/dev-scripts/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'run-script', scriptName }),
      });

      const result: ExecuteResult = await response.json();
      setLastOutput(prev => ({ ...prev, [scriptName]: result }));

      if (result.success) {
        toast.success(`Script ${scriptName} executed successfully`);
      } else {
        toast.error(`Script failed: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error executing script:', error);
      toast.error('Failed to execute script');
    } finally {
      setExecutingScript(null);
    }
  };

  const clearCache = async () => {
    setClearingCache(true);
    try {
      const response = await fetch('/api/dev-scripts/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-cache' }),
      });

      const result: ExecuteResult = await response.json();
      setLastOutput(prev => ({ ...prev, 'clear-cache': result }));

      if (result.success) {
        toast.success('Cache cleared successfully!', {
          description: 'The .next folder has been removed',
        });
      } else {
        toast.error(`Failed to clear cache: ${result.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error clearing cache:', error);
      toast.error('Failed to clear cache');
    } finally {
      setClearingCache(false);
    }
  };

  const copyCommand = (command: string) => {
    navigator.clipboard.writeText(command);
    toast.success('Command copied to clipboard');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString();
  };

  const getExtensionColor = (ext: string): string => {
    switch (ext) {
      case '.ts': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case '.js': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case '.mjs': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <Card className="bg-gradient-to-br from-dark-200 to-dark-300 border-dark-400">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-light-900">
              <Terminal className="size-5 text-purple-400" />
              Dev Settings
            </CardTitle>
            <CardDescription className="text-dark-600">
              Developer tools, test scripts, and cache management
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={fetchScripts}
            disabled={loading}
            className="border-dark-500 hover:bg-dark-400"
          >
            <RefreshCw className={cn("size-4 mr-2", loading && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* System Info */}
        {projectInfo && (
          <div className="bg-dark-400/30 rounded-lg p-4 border border-dark-500/50">
            <h4 className="text-sm font-semibold text-light-900 mb-3 flex items-center gap-2">
              <Server className="size-4 text-cyan-400" />
              System Information
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="flex items-center gap-2">
                <Folder className="size-3 text-dark-600" />
                <span className="text-dark-600">Project Root:</span>
                <code className="text-cyan-400 bg-dark-500/50 px-2 py-0.5 rounded truncate max-w-[200px]" title={projectInfo.projectRoot}>
                  {projectInfo.projectRoot}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <FileCode className="size-3 text-dark-600" />
                <span className="text-dark-600">Scripts Dir:</span>
                <code className="text-cyan-400 bg-dark-500/50 px-2 py-0.5 rounded truncate max-w-[200px]" title={projectInfo.scriptsDir}>
                  {projectInfo.scriptsDir}
                </code>
              </div>
              <div className="flex items-center gap-2">
                <Terminal className="size-3 text-dark-600" />
                <span className="text-dark-600">Platform:</span>
                <Badge variant="outline" className="text-xs border-purple-500/30 text-purple-400">
                  {projectInfo.platform}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Server className="size-3 text-dark-600" />
                <span className="text-dark-600">Node:</span>
                <Badge variant="outline" className="text-xs border-green-500/30 text-green-400">
                  {projectInfo.nodeVersion}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Cache Management */}
        <div className="bg-dark-400/30 rounded-lg p-4 border border-dark-500/50">
          <h4 className="text-sm font-semibold text-light-900 mb-3 flex items-center gap-2">
            <Trash2 className="size-4 text-red-400" />
            Cache Management
          </h4>
          <div className="flex items-center justify-between">
            <div className="text-xs text-dark-600">
              Clear the <code className="text-yellow-400 bg-dark-500/50 px-1 rounded">.next</code> build cache folder.
              Use this if you experience build issues or corrupted cache.
            </div>
            <Button
              onClick={clearCache}
              disabled={clearingCache}
              variant="destructive"
              size="sm"
              className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30"
            >
              {clearingCache ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Clearing...
                </>
              ) : (
                <>
                  <Trash2 className="size-4 mr-2" />
                  Clear .next Cache
                </>
              )}
            </Button>
          </div>
          
          {/* Cache clear output */}
          {lastOutput['clear-cache'] && (
            <div className="mt-3 bg-dark-500/50 rounded-lg p-3 border border-dark-600">
              <div className="flex items-center gap-2 mb-2">
                {lastOutput['clear-cache'].success ? (
                  <CheckCircle2 className="size-4 text-green-400" />
                ) : (
                  <XCircle className="size-4 text-red-400" />
                )}
                <span className={cn(
                  "text-xs font-semibold",
                  lastOutput['clear-cache'].success ? "text-green-400" : "text-red-400"
                )}>
                  {lastOutput['clear-cache'].success ? 'Success' : 'Failed'}
                </span>
              </div>
              <pre className="text-xs text-dark-600 overflow-x-auto whitespace-pre-wrap">
                {lastOutput['clear-cache'].output || lastOutput['clear-cache'].error}
              </pre>
            </div>
          )}
        </div>

        {/* Test Scripts */}
        <div className="bg-dark-400/30 rounded-lg p-4 border border-dark-500/50">
          <h4 className="text-sm font-semibold text-light-900 mb-3 flex items-center gap-2">
            <FileCode className="size-4 text-blue-400" />
            Test Scripts
            <Badge variant="outline" className="ml-2 text-xs">
              {scripts.length} scripts
            </Badge>
          </h4>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : scripts.length === 0 ? (
            <div className="text-center py-8 text-dark-600">
              <FileCode className="size-8 mx-auto mb-2 opacity-50" />
              <p>No scripts found in test-scripts directory</p>
            </div>
          ) : (
            <div className="space-y-3">
              {scripts.map((script) => (
                <div
                  key={script.name}
                  className="bg-dark-500/30 rounded-lg border border-dark-600/50 overflow-hidden"
                >
                  {/* Script Header */}
                  <div className="p-3 flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <Badge 
                        variant="outline" 
                        className={cn("text-xs font-mono", getExtensionColor(script.extension))}
                      >
                        {script.extension}
                      </Badge>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-light-900 truncate">
                          {script.name}
                        </p>
                        {script.description && (
                          <p className="text-xs text-dark-600 truncate">
                            {script.description}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-2">
                      <div className="hidden md:flex items-center gap-2 text-xs text-dark-600">
                        <Clock className="size-3" />
                        <span>{formatDate(script.modified)}</span>
                        <span className="text-dark-700">•</span>
                        <span>{formatFileSize(script.size)}</span>
                      </div>
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyCommand(script.launchCommand)}
                        className="text-dark-600 hover:text-light-900"
                        title="Copy command"
                      >
                        <Copy className="size-4" />
                      </Button>
                      
                      <Button
                        onClick={() => setExpandedOutput(
                          expandedOutput === script.name ? null : script.name
                        )}
                        variant="ghost"
                        size="sm"
                        className="text-dark-600 hover:text-light-900"
                      >
                        {expandedOutput === script.name ? (
                          <ChevronUp className="size-4" />
                        ) : (
                          <ChevronDown className="size-4" />
                        )}
                      </Button>
                      
                      <Button
                        onClick={() => executeScript(script.name)}
                        disabled={executingScript === script.name}
                        size="sm"
                        className="bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
                      >
                        {executingScript === script.name ? (
                          <>
                            <Loader2 className="size-4 mr-2 animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <Play className="size-4 mr-2" />
                            Run
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedOutput === script.name && (
                    <div className="border-t border-dark-600/50 p-3 bg-dark-600/20">
                      {/* Command */}
                      <div className="mb-3">
                        <p className="text-xs text-dark-600 mb-1">Launch Command:</p>
                        <code className="block text-xs bg-dark-700/50 p-2 rounded text-cyan-400 font-mono">
                          {script.launchCommand}
                        </code>
                      </div>
                      
                      {/* Full Path */}
                      <div className="mb-3">
                        <p className="text-xs text-dark-600 mb-1">Full Path:</p>
                        <code className="block text-xs bg-dark-700/50 p-2 rounded text-yellow-400 font-mono break-all">
                          {script.fullPath}
                        </code>
                      </div>

                      {/* Output */}
                      {lastOutput[script.name] && (
                        <div>
                          <div className="flex items-center gap-2 mb-2">
                            <p className="text-xs text-dark-600">Last Execution:</p>
                            {lastOutput[script.name].success ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                                <CheckCircle2 className="size-3 mr-1" />
                                Success
                              </Badge>
                            ) : (
                              <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                <XCircle className="size-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                          </div>
                          <pre className="text-xs bg-dark-700/50 p-3 rounded text-dark-600 overflow-x-auto max-h-60 whitespace-pre-wrap font-mono">
                            {lastOutput[script.name].output || lastOutput[script.name].error || 'No output'}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Warning */}
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
          <p className="text-xs text-yellow-400">
            ⚠️ <strong>Warning:</strong> These tools execute commands directly on the server. 
            Use with caution in production environments. Scripts run with server permissions and 
            have access to environment variables.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

