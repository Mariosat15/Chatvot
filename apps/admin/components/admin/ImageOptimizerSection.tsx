'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Image,
  RefreshCw,
  Loader2,
  CheckCircle,
  XCircle,
  Zap,
  HardDrive,
  TrendingDown,
  FileImage,
  AlertTriangle,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ImageInfo {
  filename: string;
  fullPath: string;
  directory: string;
  directoryLabel: string;
  size: number;
  imageType: string;
  isOptimized: boolean;
  canOptimize: boolean;
}

interface DirectoryInfo {
  path: string;
  label: string;
  exists: boolean;
  imageCount: number;
}

interface Stats {
  totalImages: number;
  totalSize: number;
  totalSizeFormatted: string;
  optimizedCount: number;
  needsOptimization: number;
  potentialSavings: string;
  directoriesScanned: number;
}

interface OptimizeResult {
  filename: string;
  originalSize: number;
  newSize: number;
  savedBytes: number;
  savedPercent: number;
  success: boolean;
  error?: string;
}

export default function ImageOptimizerSection() {
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [stats, setStats] = useState<Stats | null>(null);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [directories, setDirectories] = useState<DirectoryInfo[]>([]);
  const [selectedImages, setSelectedImages] = useState<Set<string>>(new Set()); // Uses fullPath as key
  const [results, setResults] = useState<OptimizeResult[]>([]);
  const [progress, setProgress] = useState(0);

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const scanImages = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/dev-zone/optimize-images');
      const data = await response.json();

      if (data.success) {
        setStats(data.stats);
        setImages(data.images || []);
        setDirectories(data.directories || []);
        setSelectedImages(new Set());
        setResults([]);
        
        if (data.stats.needsOptimization > 0) {
          toast.info(`Found ${data.stats.needsOptimization} images that can be optimized across ${data.stats.directoriesScanned || 1} directories`);
        } else if (data.stats.totalImages > 0) {
          toast.success('All images are already optimized!');
        } else {
          toast.info('No images found in any directory');
        }
      } else {
        toast.error(data.error || 'Failed to scan images');
      }
    } catch (error) {
      toast.error('Failed to scan images');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const optimizeImages = async (mode: 'all' | 'selected') => {
    // Build selected images array with full info
    const selectedImagesList = mode === 'selected' 
      ? images.filter(img => selectedImages.has(img.fullPath))
      : [];
    
    if (mode === 'selected' && selectedImagesList.length === 0) {
      toast.error('No images selected');
      return;
    }

    setOptimizing(true);
    setProgress(0);
    setResults([]);

    try {
      const response = await fetch('/api/dev-zone/optimize-images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          mode, 
          images: selectedImagesList.map(img => ({
            filename: img.filename,
            fullPath: img.fullPath,
            directory: img.directory,
            directoryLabel: img.directoryLabel,
            imageType: img.imageType,
          })),
        }),
      });

      const data = await response.json();

      if (data.success) {
        setResults(data.results);
        setProgress(100);
        toast.success(`Optimized ${data.successful} images, saved ${data.totalSavedFormatted}`);
        
        // Refresh the scan
        await scanImages();
      } else {
        toast.error(data.error || 'Optimization failed');
      }
    } catch (error) {
      toast.error('Optimization failed');
      console.error(error);
    } finally {
      setOptimizing(false);
    }
  };

  const toggleSelectAll = () => {
    if (selectedImages.size === images.filter(i => i.canOptimize).length) {
      setSelectedImages(new Set());
    } else {
      setSelectedImages(new Set(images.filter(i => i.canOptimize).map(i => i.fullPath)));
    }
  };

  const toggleImage = (fullPath: string) => {
    const newSet = new Set(selectedImages);
    if (newSet.has(fullPath)) {
      newSet.delete(fullPath);
    } else {
      newSet.add(fullPath);
    }
    setSelectedImages(newSet);
  };

  useEffect(() => {
    scanImages();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Image className="w-6 h-6 text-purple-500" />
            Image Optimizer
          </h2>
          <p className="text-muted-foreground">
            Scan and optimize images from all upload directories
          </p>
        </div>
        <Button
          variant="outline"
          onClick={scanImages}
          disabled={loading || optimizing}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Scan Images
        </Button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Images</p>
                  <p className="text-3xl font-bold">{stats.totalImages}</p>
                </div>
                <FileImage className="w-10 h-10 text-blue-500" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Size</p>
                  <p className="text-3xl font-bold">{stats.totalSizeFormatted}</p>
                </div>
                <HardDrive className="w-10 h-10 text-yellow-500" />
              </div>
            </CardContent>
          </Card>

          <Card className={cn(
            stats.needsOptimization > 0 ? "border-orange-500/30 bg-orange-500/5" : "border-green-500/30 bg-green-500/5"
          )}>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Needs Optimization</p>
                  <p className={cn(
                    "text-3xl font-bold",
                    stats.needsOptimization > 0 ? "text-orange-500" : "text-green-500"
                  )}>
                    {stats.needsOptimization}
                  </p>
                </div>
                {stats.needsOptimization > 0 ? (
                  <AlertTriangle className="w-10 h-10 text-orange-500" />
                ) : (
                  <CheckCircle className="w-10 h-10 text-green-500" />
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Potential Savings</p>
                  <p className="text-3xl font-bold text-green-500">{stats.potentialSavings}</p>
                </div>
                <TrendingDown className="w-10 h-10 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Directories Info */}
      {directories.length > 0 && (
        <Card className="bg-muted/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">📁 Scanned Directories</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {directories.map((dir, idx) => (
                <div key={idx} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {dir.label}
                    </Badge>
                    <code className="bg-muted px-2 py-1 rounded text-xs truncate max-w-[400px]">
                      {dir.path}
                    </code>
                  </div>
                  <span className="text-muted-foreground">{dir.imageCount} images</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {stats && stats.needsOptimization > 0 && (
        <div className="flex gap-4">
          <Button
            onClick={() => optimizeImages('all')}
            disabled={optimizing || loading}
            className="bg-purple-600 hover:bg-purple-700"
          >
            {optimizing ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Zap className="w-4 h-4 mr-2" />
            )}
            Optimize All ({stats.needsOptimization})
          </Button>
          
          {selectedImages.size > 0 && (
            <Button
              onClick={() => optimizeImages('selected')}
              disabled={optimizing || loading}
              variant="outline"
            >
              Optimize Selected ({selectedImages.size})
            </Button>
          )}
        </div>
      )}

      {/* Progress */}
      {optimizing && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Optimizing images...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Optimization Results</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-2">
                {results.map((result, i) => (
                  <div
                    key={i}
                    className={cn(
                      "flex items-center justify-between p-2 rounded",
                      result.success ? "bg-green-500/10" : "bg-red-500/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                      <span className="text-sm">{result.filename}</span>
                    </div>
                    {result.success && (
                      <div className="text-sm text-muted-foreground">
                        {formatBytes(result.originalSize)} → {formatBytes(result.newSize)}
                        <Badge variant="secondary" className="ml-2 text-green-500">
                          -{result.savedPercent.toFixed(0)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Image List */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Images</CardTitle>
                <CardDescription>Largest images first (top 100 from all directories)</CardDescription>
              </div>
              {images.some(i => i.canOptimize) && (
                <Button variant="outline" size="sm" onClick={toggleSelectAll}>
                  {selectedImages.size === images.filter(i => i.canOptimize).length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-2">
                {images.map((img) => (
                  <div
                    key={img.fullPath}
                    className={cn(
                      "flex items-center justify-between p-3 rounded border",
                      img.isOptimized ? "bg-green-500/5 border-green-500/20" : 
                      img.canOptimize ? "bg-orange-500/5 border-orange-500/20" : 
                      "bg-muted/30"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      {img.canOptimize && (
                        <Checkbox
                          checked={selectedImages.has(img.fullPath)}
                          onCheckedChange={() => toggleImage(img.fullPath)}
                        />
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate">{img.filename}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {img.directoryLabel}
                          </Badge>
                          <span>Type: {img.imageType}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={cn(
                        "font-mono text-sm",
                        img.size > 500 * 1024 ? "text-red-500" :
                        img.size > 100 * 1024 ? "text-orange-500" :
                        "text-green-500"
                      )}>
                        {formatBytes(img.size)}
                      </span>
                      {img.isOptimized && (
                        <Badge variant="secondary" className="text-green-500">
                          <CheckCircle className="w-3 h-3 mr-1" />
                          Optimized
                        </Badge>
                      )}
                      {img.canOptimize && (
                        <Badge variant="secondary" className="text-orange-500">
                          Needs optimization
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!loading && images.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <Image className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="font-semibold mb-2">No Images Found</h3>
              <p className="text-muted-foreground">
                No marketplace images found in the uploads directory.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
