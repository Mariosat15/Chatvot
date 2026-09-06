"use client";

import { Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { LandingSettings } from "./types";

interface ThemeEffectsCardProps {
  settings: LandingSettings;
  updateField: <K extends keyof LandingSettings>(key: K, value: LandingSettings[K]) => void;
}

export default function ThemeEffectsCard({ settings, updateField }: ThemeEffectsCardProps) {
  return (
    <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30">
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3">
          <Sparkles className="h-6 w-6 text-purple-400" />
          <div>
            <CardTitle className="text-white">✨ Theme Effects & Customization</CardTitle>
            <CardDescription className="text-gray-400">
              Configure global effects and customize your selected theme
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Info about automatic effects */}
        <div className="p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <h5 className="text-sm font-semibold text-blue-400 mb-2">🎯 Automatic Theme Effects</h5>
          <p className="text-xs text-gray-400">
            Each theme has its own unique effects that are applied automatically:
          </p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-xs">
            <div className="flex items-center gap-1"><span>🎄</span><span className="text-gray-300">Christmas → Snow + Lights</span></div>
            <div className="flex items-center gap-1"><span>🎃</span><span className="text-gray-300">Halloween → Blood + Fog + Ghosts</span></div>
            <div className="flex items-center gap-1"><span>🐰</span><span className="text-gray-300">Easter → Pastel Confetti + Eggs</span></div>
            <div className="flex items-center gap-1"><span>🛒</span><span className="text-gray-300">Black Friday → Confetti + Tags</span></div>
          </div>
        </div>

        {/* Global Animation Controls */}
        <div>
          <h5 className="text-sm font-semibold text-purple-400 mb-3">Global Animation Controls</h5>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: "Particles", emoji: "✨", key: "particlesEnabled" as const },
              { label: "Glow Effects", emoji: "💫", key: "glowEffectsEnabled" as const },
              { label: "All Animations", emoji: "🎬", key: "animationsEnabled" as const },
            ].map(({ label, emoji, key }) => (
              <div key={key} className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <span>{emoji}</span>
                  <span className="text-sm text-white">{label}</span>
                </div>
                <Switch
                  checked={settings.globalThemeEffects?.[key] ?? true}
                  onCheckedChange={(v) =>
                    updateField("globalThemeEffects", { ...settings.globalThemeEffects, [key]: v })
                  }
                />
              </div>
            ))}
          </div>
        </div>

        {/* Effect Intensity Sliders */}
        <div>
          <h5 className="text-sm font-semibold text-purple-400 mb-3">Holiday Effect Intensity</h5>
          <p className="text-xs text-gray-500 mb-4">
            Control how many particles appear (lower = better performance)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Snow Intensity", emoji: "❄️", key: "snowIntensity" as const, default: 30, color: "cyan", hint: "Used in Christmas theme" },
              { label: "Blood Intensity", emoji: "🩸", key: "bloodIntensity" as const, default: 20, color: "red", hint: "Used in Halloween theme" },
              { label: "Confetti Intensity", emoji: "🎊", key: "confettiIntensity" as const, default: 30, color: "yellow", hint: "Used in Easter & Black Friday themes" },
            ].map(({ label, emoji, key, default: def, color, hint }) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-gray-300 text-sm flex items-center gap-2">
                    <span>{emoji}</span> {label}
                  </Label>
                  <span className={`text-${color}-400 text-sm font-mono`}>
                    {settings.globalThemeEffects?.[key] ?? def}%
                  </span>
                </div>
                <input
                  type="range" min="10" max="100"
                  value={settings.globalThemeEffects?.[key] ?? def}
                  onChange={(e) =>
                    updateField("globalThemeEffects", {
                      ...settings.globalThemeEffects,
                      [key]: parseInt(e.target.value),
                    })
                  }
                  className={`w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-${color}-500`}
                />
                <p className="text-[10px] text-gray-500">{hint}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Custom Theme Override */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h5 className="text-sm font-semibold text-purple-400">Custom Color Override</h5>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Override theme colors</span>
              <Switch
                checked={settings.customThemeEnabled || false}
                onCheckedChange={(v) => updateField("customThemeEnabled", v)}
              />
            </div>
          </div>
          {settings.customThemeEnabled && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-gray-800/50 rounded-lg">
              {[
                { label: "Primary Color", key: "primaryColor" as const, default: "#00ff88" },
                { label: "Secondary Color", key: "secondaryColor" as const, default: "#00d4ff" },
                { label: "Accent Color", key: "accentColor" as const, default: "#ff00ff" },
                { label: "Background Color", key: "backgroundColor" as const, default: "#030712" },
                { label: "Text Color", key: "textColor" as const, default: "#f3f4f6" },
                { label: "Border Color", key: "borderColor" as const, default: "#374151" },
              ].map(({ label, key, default: def }) => (
                <div key={key}>
                  <Label className="text-gray-400 text-xs mb-1 block">{label}</Label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={settings.customTheme?.[key] || def}
                      onChange={(e) =>
                        updateField("customTheme", { ...settings.customTheme, [key]: e.target.value })
                      }
                      className="w-10 h-10 rounded cursor-pointer border-0"
                    />
                    <Input
                      value={settings.customTheme?.[key] || def}
                      onChange={(e) =>
                        updateField("customTheme", { ...settings.customTheme, [key]: e.target.value })
                      }
                      className="bg-gray-900 border-gray-600 text-white text-xs"
                      placeholder={def}
                    />
                  </div>
                </div>
              ))}
              <div className="col-span-2">
                <Label className="text-gray-400 text-xs mb-1 block">Heading Font</Label>
                <Select
                  value={settings.customTheme?.headingFont || "Orbitron"}
                  onValueChange={(v) =>
                    updateField("customTheme", { ...settings.customTheme, headingFont: v })
                  }
                >
                  <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Orbitron">Orbitron (Gaming/Sci-Fi)</SelectItem>
                    <SelectItem value="Rajdhani">Rajdhani (Modern Gaming)</SelectItem>
                    <SelectItem value="Press Start 2P">Press Start 2P (Retro Pixel)</SelectItem>
                    <SelectItem value="VT323">VT323 (Terminal/Retro)</SelectItem>
                    <SelectItem value="Exo 2">Exo 2 (Futuristic)</SelectItem>
                    <SelectItem value="Space Grotesk">Space Grotesk (Clean)</SelectItem>
                    <SelectItem value="Cinzel">Cinzel (Elegant)</SelectItem>
                    <SelectItem value="Bebas Neue">Bebas Neue (Bold)</SelectItem>
                    <SelectItem value="Righteous">Righteous (Retro)</SelectItem>
                    <SelectItem value="Creepster">Creepster (Horror)</SelectItem>
                    <SelectItem value="Mountains of Christmas">Mountains of Christmas (Holiday)</SelectItem>
                    <SelectItem value="Inter">Inter (System)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>
        <p className="text-xs text-gray-500 mt-4">
          💡 <strong>Tip:</strong> Holiday themes automatically enable relevant effects
          (e.g., Christmas enables snow, Halloween enables blood drips).
        </p>
      </CardContent>
    </Card>
  );
}
