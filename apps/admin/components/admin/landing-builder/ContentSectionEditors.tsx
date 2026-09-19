"use client";

import { Trophy, Swords, Rocket } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { LandingSettings } from "./types";

interface ContentEditorsProps {
  settings: LandingSettings;
  updateField: <K extends keyof LandingSettings>(
    key: K,
    value: LandingSettings[K],
  ) => void;
}

// Reason: This component renders Competitions, Challenges, and Final CTA
// accordion items for the Hero Page tab. Extracted to keep the main file small.

export default function ContentSectionEditors({ settings, updateField }: ContentEditorsProps) {
  return (
    <>
      {/* ─── Competitions Section ────────────────────────────── */}
      <AccordionItem value="competitions" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.competitionsEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Trophy className="h-5 w-5 text-yellow-500" />
            <span className="font-semibold text-white">Competitions Section</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <Label className="text-gray-300">Enable Competitions Section</Label>
            <Switch checked={settings.competitionsEnabled} onCheckedChange={(v) => updateField("competitionsEnabled", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.competitionsTitle} onChange={(e) => updateField("competitionsTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Badge/Subtitle</Label>
              <Input value={settings.competitionsSubtitle} onChange={(e) => updateField("competitionsSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea value={settings.competitionsDescription} onChange={(e) => updateField("competitionsDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Button Text</Label>
              <Input value={settings.competitionsCTAText} onChange={(e) => updateField("competitionsCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Button Link</Label>
              <Input value={settings.competitionsCTALink} onChange={(e) => updateField("competitionsCTALink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ─── Challenges Section ──────────────────────────────── */}
      <AccordionItem value="challenges" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.challengesEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Swords className="h-5 w-5 text-purple-500" />
            <span className="font-semibold text-white">Challenges Section</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <Label className="text-gray-300">Enable Challenges Section</Label>
            <Switch checked={settings.challengesEnabled} onCheckedChange={(v) => updateField("challengesEnabled", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.challengesTitle} onChange={(e) => updateField("challengesTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Badge/Subtitle</Label>
              <Input value={settings.challengesSubtitle} onChange={(e) => updateField("challengesSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>

          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea value={settings.challengesDescription} onChange={(e) => updateField("challengesDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Button Text</Label>
              <Input value={settings.challengesCTAText} onChange={(e) => updateField("challengesCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Button Link</Label>
              <Input value={settings.challengesCTALink} onChange={(e) => updateField("challengesCTALink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ─── Final CTA ───────────────────────────────────────── */}
      <AccordionItem value="cta" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.ctaEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Rocket className="h-5 w-5 text-orange-500" />
            <span className="font-semibold text-white">Final Call-to-Action</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <Label className="text-gray-300">Enable Final CTA Section</Label>
            <Switch checked={settings.ctaEnabled} onCheckedChange={(v) => updateField("ctaEnabled", v)} />
          </div>

          <div>
            <Label className="text-gray-400">Title</Label>
            <Input value={settings.ctaTitle} onChange={(e) => updateField("ctaTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>

          <div>
            <Label className="text-gray-400">Subtitle</Label>
            <Input value={settings.ctaSubtitle} onChange={(e) => updateField("ctaSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>

          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea value={settings.ctaDescription} onChange={(e) => updateField("ctaDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Button Text</Label>
              <Input value={settings.ctaButtonText} onChange={(e) => updateField("ctaButtonText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Button Link</Label>
              <Input value={settings.ctaButtonLink} onChange={(e) => updateField("ctaButtonLink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
