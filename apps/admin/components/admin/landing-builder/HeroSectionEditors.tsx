"use client";

import {
  Plus,
  Trash2,
  Sparkles,
  BarChart3,
  Layers,
  Settings,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { EditorProps } from "./types";
import IconPickerField from "./IconPickerField";

// Reason: This component renders the Hero, Stats, Features, and How It Works
// accordion items for the Hero Page tab. Extracted to keep the main file small.

export default function HeroSectionEditors({
  settings,
  updateField,
  addItem,
  removeItem,
  updateArrayItem,
}: EditorProps) {
  return (
    <>
      {/* ─── Hero Section ────────────────────────────────────── */}
      <AccordionItem value="hero" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.heroEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Sparkles className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold text-white">Hero Section</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <Label className="text-gray-300">Enable Hero Section</Label>
            <Switch checked={settings.heroEnabled} onCheckedChange={(v) => updateField("heroEnabled", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Main Title</Label>
              <Input value={settings.heroTitle} onChange={(e) => updateField("heroTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Badge Text</Label>
              <Input value={settings.heroBadgeText} onChange={(e) => updateField("heroBadgeText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" placeholder="🔥 Live Trading" />
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Subtitle</Label>
            <Input value={settings.heroSubtitle} onChange={(e) => updateField("heroSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>

          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea value={settings.heroDescription} onChange={(e) => updateField("heroDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Primary Button Text</Label>
              <Input value={settings.heroPrimaryCTAText} onChange={(e) => updateField("heroPrimaryCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Primary Button Link</Label>
              <Input value={settings.heroPrimaryCTALink} onChange={(e) => updateField("heroPrimaryCTALink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Secondary Button Text</Label>
              <Input value={settings.heroSecondaryCTAText} onChange={(e) => updateField("heroSecondaryCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Secondary Button Link</Label>
              <Input value={settings.heroSecondaryCTALink} onChange={(e) => updateField("heroSecondaryCTALink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <Label className="text-gray-300">Enable Particle Animation</Label>
            <Switch checked={settings.heroParticlesEnabled} onCheckedChange={(v) => updateField("heroParticlesEnabled", v)} />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ─── Stats Section ───────────────────────────────────── */}
      <AccordionItem value="stats" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.statsEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <BarChart3 className="h-5 w-5 text-blue-500" />
            <span className="font-semibold text-white">Stats / Counter Numbers</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <div>
              <Label className="text-gray-300">Enable Stats Section</Label>
              <p className="text-xs text-gray-500">Show counting numbers on hero page</p>
            </div>
            <Switch checked={settings.statsEnabled} onCheckedChange={(v) => updateField("statsEnabled", v)} />
          </div>

          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <Label className="text-gray-300">Animate Numbers (Count Up)</Label>
            <Switch checked={settings.statsAnimated} onCheckedChange={(v) => updateField("statsAnimated", v)} />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Stats Items</Label>
              <Button
                size="sm" variant="outline"
                onClick={() => addItem("stats", { id: Date.now().toString(), value: "0", suffix: "+", label: "New Stat", icon: "Star", enabled: true })}
                className="border-gray-600"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Stat
              </Button>
            </div>

            {settings.stats.map((stat) => (
              <div key={stat.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <Switch checked={stat.enabled} onCheckedChange={(v) => updateArrayItem("stats", stat.id, { enabled: v })} />
                  <Input value={stat.value} onChange={(e) => updateArrayItem("stats", stat.id, { value: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-24" placeholder="10000" />
                  <Input value={stat.suffix} onChange={(e) => updateArrayItem("stats", stat.id, { suffix: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-16" placeholder="+" />
                  <Input value={stat.label} onChange={(e) => updateArrayItem("stats", stat.id, { label: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Label" />
                  <Button size="icon" variant="ghost" onClick={() => removeItem("stats", stat.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="pl-10">
                  <IconPickerField
                    value={stat.icon || ""}
                    onChange={(v) => updateArrayItem("stats", stat.id, { icon: v })}
                    compact
                  />
                </div>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ─── Features Section ────────────────────────────────── */}
      <AccordionItem value="features" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.featuresEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Layers className="h-5 w-5 text-purple-500" />
            <span className="font-semibold text-white">Features Section</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <Label className="text-gray-300">Enable Features Section</Label>
            <Switch checked={settings.featuresEnabled} onCheckedChange={(v) => updateField("featuresEnabled", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.featuresTitle} onChange={(e) => updateField("featuresTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Section Subtitle</Label>
              <Input value={settings.featuresSubtitle} onChange={(e) => updateField("featuresSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Feature Cards</Label>
              <Button
                size="sm" variant="outline"
                onClick={() => addItem("features", { id: Date.now().toString(), icon: "Star", title: "New Feature", description: "Description here", enabled: true })}
                className="border-gray-600"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Feature
              </Button>
            </div>

            {settings.features.map((feature) => (
              <div key={feature.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <Switch checked={feature.enabled} onCheckedChange={(v) => updateArrayItem("features", feature.id, { enabled: v })} />
                  <div className="w-48">
                    <IconPickerField
                      value={feature.icon}
                      onChange={(v) => updateArrayItem("features", feature.id, { icon: v })}
                      compact
                    />
                  </div>
                  <Input value={feature.title} onChange={(e) => updateArrayItem("features", feature.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Title" />
                  <Button size="icon" variant="ghost" onClick={() => removeItem("features", feature.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea value={feature.description} onChange={(e) => updateArrayItem("features", feature.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" rows={2} placeholder="Feature description..." />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ─── How It Works ────────────────────────────────────── */}
      <AccordionItem value="howItWorks" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.howItWorksEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Settings className="h-5 w-5 text-green-500" />
            <span className="font-semibold text-white">How It Works</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <Label className="text-gray-300">Enable How It Works Section</Label>
            <Switch checked={settings.howItWorksEnabled} onCheckedChange={(v) => updateField("howItWorksEnabled", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.howItWorksTitle} onChange={(e) => updateField("howItWorksTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Section Subtitle</Label>
              <Input value={settings.howItWorksSubtitle} onChange={(e) => updateField("howItWorksSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300">Steps</Label>
              <Button
                size="sm" variant="outline"
                onClick={() => addItem("howItWorksSteps", { id: Date.now().toString(), step: settings.howItWorksSteps.length + 1, icon: "Star", title: "New Step", description: "Step description", enabled: true })}
                className="border-gray-600"
              >
                <Plus className="h-4 w-4 mr-1" /> Add Step
              </Button>
            </div>

            {settings.howItWorksSteps.map((step) => (
              <div key={step.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <Switch checked={step.enabled} onCheckedChange={(v) => updateArrayItem("howItWorksSteps", step.id, { enabled: v })} />
                  <div className="w-10 h-10 rounded-full bg-yellow-500 text-gray-900 flex items-center justify-center font-bold flex-shrink-0">
                    {step.step}
                  </div>
                  <div className="flex-1 space-y-1">
                    <Input value={step.title} onChange={(e) => updateArrayItem("howItWorksSteps", step.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Step title" />
                    <Input value={step.description} onChange={(e) => updateArrayItem("howItWorksSteps", step.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white text-sm" placeholder="Description" />
                  </div>
                  <Button size="icon" variant="ghost" onClick={() => removeItem("howItWorksSteps", step.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <div className="pl-14">
                  <IconPickerField
                    value={step.icon || ""}
                    onChange={(v) => updateArrayItem("howItWorksSteps", step.id, { icon: v })}
                    compact
                  />
                </div>
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
