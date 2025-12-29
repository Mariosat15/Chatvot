'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { 
  Sparkles, Loader2, Wand2, RefreshCw, Check, 
  Lightbulb, Anchor, Rocket, Crown, Flame, Zap,
  Target, Trophy, Swords, Gamepad2
} from 'lucide-react';
import { toast } from 'sonner';

interface AIGeneratorDialogProps {
  onGenerate: (data: { title?: string; description?: string }) => void;
  generateType?: 'both' | 'title' | 'description';
  currentTitle?: string;
  currentDescription?: string;
}

// Pre-made theme suggestions
const THEME_SUGGESTIONS = [
  { icon: Anchor, label: 'Pirate Theme', prompt: 'pirate theme with treasure hunting and sea adventure' },
  { icon: Rocket, label: 'Space Theme', prompt: 'space exploration and galactic trading mission' },
  { icon: Crown, label: 'Royal Theme', prompt: 'medieval kingdom with knights and royal treasury' },
  { icon: Flame, label: 'Fire Theme', prompt: 'intense fire and heat with blazing competition' },
  { icon: Zap, label: 'Electric Theme', prompt: 'high voltage electric energy and lightning speed trading' },
  { icon: Target, label: 'Sniper Theme', prompt: 'precision sniper with accuracy and perfect shots' },
  { icon: Trophy, label: 'Champion Theme', prompt: 'ultimate championship with legendary winners' },
  { icon: Swords, label: 'Battle Theme', prompt: 'epic battle arena with warriors competing for glory' },
  { icon: Gamepad2, label: 'Gaming Theme', prompt: 'arcade gaming with high scores and power-ups' },
];

export default function AIGeneratorDialog({
  onGenerate,
  generateType = 'both',
  currentTitle = '',
  currentDescription = '',
}: AIGeneratorDialogProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [generatedTitle, setGeneratedTitle] = useState('');
  const [generatedDescription, setGeneratedDescription] = useState('');
  const [hasGenerated, setHasGenerated] = useState(false);

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a theme or description');
      return;
    }

    setLoading(true);
    setHasGenerated(false);

    try {
      const response = await fetch('/api/ai/generate-competition', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim(), type: generateType }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate content');
      }

      if (generateType === 'title' && data.title) {
        setGeneratedTitle(data.title);
      } else if (generateType === 'description' && data.description) {
        setGeneratedDescription(data.description);
      } else if (data.title && data.description) {
        setGeneratedTitle(data.title);
        setGeneratedDescription(data.description);
      }

      setHasGenerated(true);
      toast.success('Content generated successfully!');

    } catch (error) {
      console.error('Generation error:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to generate content');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = () => {
    const result: { title?: string; description?: string } = {};
    
    if ((generateType === 'both' || generateType === 'title') && generatedTitle) {
      result.title = generatedTitle;
    }
    if ((generateType === 'both' || generateType === 'description') && generatedDescription) {
      result.description = generatedDescription;
    }

    onGenerate(result);
    setOpen(false);
    setPrompt('');
    setGeneratedTitle('');
    setGeneratedDescription('');
    setHasGenerated(false);
    toast.success('Content applied!');
  };

  const handleThemeClick = (themePrompt: string) => {
    setPrompt(themePrompt);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/30 hover:border-purple-500/50 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 transition-all"
        >
          <Sparkles className="h-4 w-4" />
          AI Generate
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px] bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500">
              <Wand2 className="h-5 w-5 text-white" />
            </div>
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              AI Content Generator
            </span>
          </DialogTitle>
          <DialogDescription className="text-gray-400">
            Describe your competition theme and let AI create engaging content for you.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Theme Suggestions */}
          <div>
            <Label className="text-gray-300 flex items-center gap-2 mb-3">
              <Lightbulb className="h-4 w-4 text-yellow-400" />
              Quick Themes
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {THEME_SUGGESTIONS.map((theme) => {
                const Icon = theme.icon;
                return (
                  <button
                    key={theme.label}
                    type="button"
                    onClick={() => handleThemeClick(theme.prompt)}
                    className={`p-2 rounded-lg border text-xs font-medium transition-all flex items-center gap-2 ${
                      prompt === theme.prompt
                        ? 'bg-purple-500/20 border-purple-500 text-purple-300'
                        : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800 hover:border-gray-600'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {theme.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Prompt Input */}
          <div>
            <Label htmlFor="ai-prompt" className="text-gray-300 mb-2 block">
              Or describe your own theme
            </Label>
            <Input
              id="ai-prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Create a pirate themed competition with treasure hunting..."
              className="bg-gray-800 border-gray-600 text-gray-100 focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              Be creative! Describe the mood, style, and theme you want.
            </p>
          </div>

          {/* Generate Button */}
          <Button
            type="button"
            onClick={handleGenerate}
            disabled={loading || !prompt.trim()}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white font-semibold py-6 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating Magic...
              </>
            ) : hasGenerated ? (
              <>
                <RefreshCw className="mr-2 h-5 w-5" />
                Regenerate
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                Generate Content
              </>
            )}
          </Button>

          {/* Preview Generated Content */}
          {hasGenerated && (
            <div className="space-y-4 p-4 rounded-xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/30">
              <div className="flex items-center gap-2 text-sm font-semibold text-purple-300">
                <Sparkles className="h-4 w-4" />
                Generated Content Preview
              </div>

              {(generateType === 'both' || generateType === 'title') && generatedTitle && (
                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">Title</Label>
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <p className="text-gray-100 font-semibold">{generatedTitle}</p>
                  </div>
                </div>
              )}

              {(generateType === 'both' || generateType === 'description') && generatedDescription && (
                <div>
                  <Label className="text-xs text-gray-400 mb-1 block">Description</Label>
                  <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
                    <p className="text-gray-300 text-sm">{generatedDescription}</p>
                  </div>
                </div>
              )}

              {/* Apply Button */}
              <Button
                type="button"
                onClick={handleApply}
                className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold"
              >
                <Check className="mr-2 h-4 w-4" />
                Apply to Form
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

