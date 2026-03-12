"use client";

import {
  Crown, Users, Map, ShoppingBag, HelpCircle, BarChart3, Trophy,
  Activity, MessageSquare, Shield, ChevronUp, ChevronDown, GripVertical,
  Plus, Trash2,
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
import type { BuilderChildProps } from "./types";
import IconPickerField from "./IconPickerField";
import NewSectionEditorsExtra from "./NewSectionEditorsExtra";

// Re-export type used by parent
export type { BuilderChildProps as EditorProps };

// ─── Helper: Section header with visibility toggle ────────────────────────

function SectionHeader({
  label,
  icon: Icon,
  iconColor,
  enabled,
  onToggle,
  description,
}: {
  label: string;
  icon: React.ElementType;
  iconColor: string;
  enabled: boolean;
  onToggle: (v: boolean) => void;
  description: string;
}) {
  return (
    <div className="flex items-center justify-between pb-4 border-b border-gray-700">
      <div className="flex items-center gap-3">
        <Icon className={`h-5 w-5 ${iconColor}`} />
        <div>
          <Label className="text-gray-300">Enable {label}</Label>
          <p className="text-xs text-gray-500 mt-1">{description}</p>
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

// ─── Simple Sections (title/subtitle only) ────────────────────────────────

export default function NewSectionEditors(props: BuilderChildProps) {
  const { settings, updateField, addItem, removeItem, updateArrayItem } = props;

  return (
    <>
      {/* ── Live Stats Bar ──────────────────────────────────── */}
      <AccordionItem value="liveStats" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.liveStatsEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <BarChart3 className="h-5 w-5 text-blue-400" />
            <span className="font-semibold text-white">Live Stats Bar</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <SectionHeader label="Live Stats Bar" icon={BarChart3} iconColor="text-blue-400" enabled={settings.liveStatsEnabled}
            onToggle={(v) => updateField("liveStatsEnabled", v)}
            description="Real-time ticker showing live competitions, challenges, and active traders. Content is auto-populated from platform data."
          />
        </AccordionContent>
      </AccordionItem>

      {/* ── Game Master ─────────────────────────────────────── */}
      <AccordionItem value="gameMaster" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.gameMasterEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Crown className="h-5 w-5 text-yellow-400" />
            <span className="font-semibold text-white">Game Master Program</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <SectionHeader label="Game Master Program" icon={Crown} iconColor="text-yellow-400" enabled={settings.gameMasterEnabled}
            onToggle={(v) => updateField("gameMasterEnabled", v)}
            description="Showcase the GM referral program, earnings, and benefits."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.gameMasterTitle} onChange={(e) => updateField("gameMasterTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">CTA Button Text</Label>
              <Input value={settings.gameMasterCTAText} onChange={(e) => updateField("gameMasterCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-gray-400">Subtitle</Label>
            <Input value={settings.gameMasterSubtitle} onChange={(e) => updateField("gameMasterSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea value={settings.gameMasterDescription} onChange={(e) => updateField("gameMasterDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-gray-400">CTA Link</Label>
            <Input value={settings.gameMasterCTALink} onChange={(e) => updateField("gameMasterCTALink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>

          {/* Benefits */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 font-semibold">Benefits</Label>
              <Button size="sm" variant="outline" className="border-gray-600"
                onClick={() => addItem("gameMasterBenefits", { id: Date.now().toString(), icon: "Star", title: "New Benefit", description: "Description", enabled: true, order: settings.gameMasterBenefits.length + 1 })}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {settings.gameMasterBenefits.map((b) => (
              <div key={b.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <Switch checked={b.enabled} onCheckedChange={(v) => updateArrayItem("gameMasterBenefits", b.id, { enabled: v })} />
                  <div className="w-40">
                    <IconPickerField value={b.icon} onChange={(v) => updateArrayItem("gameMasterBenefits", b.id, { icon: v })} compact />
                  </div>
                  <Input value={b.title} onChange={(e) => updateArrayItem("gameMasterBenefits", b.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" />
                  <Button size="icon" variant="ghost" onClick={() => removeItem("gameMasterBenefits", b.id)} className="text-red-500 hover:text-red-400"><Trash2 className="h-4 w-4" /></Button>
                </div>
                <Textarea value={b.description} onChange={(e) => updateArrayItem("gameMasterBenefits", b.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" rows={1} />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── Competition Types ────────────────────────────────── */}
      <AccordionItem value="competitionTypes" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.competitionTypesEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Trophy className="h-5 w-5 text-orange-400" />
            <span className="font-semibold text-white">Competition Types</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <SectionHeader label="Competition Types" icon={Trophy} iconColor="text-orange-400" enabled={settings.competitionTypesEnabled}
            onToggle={(v) => updateField("competitionTypesEnabled", v)}
            description="Display different competition formats (P&L, ROI, Win Rate, etc.)."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.competitionTypesTitle} onChange={(e) => updateField("competitionTypesTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Subtitle</Label>
              <Input value={settings.competitionTypesSubtitle} onChange={(e) => updateField("competitionTypesSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea value={settings.competitionTypesDescription} onChange={(e) => updateField("competitionTypesDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
          </div>
          {/* Types array */}
          <div className="space-y-3">
            <Label className="text-gray-300 font-semibold">Competition Types</Label>
            {settings.competitionTypes.map((t) => (
              <div key={t.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <Switch checked={t.enabled} onCheckedChange={(v) => updateArrayItem("competitionTypes", t.id, { enabled: v })} />
                  <div className="w-40">
                    <IconPickerField value={t.icon} onChange={(v) => updateArrayItem("competitionTypes", t.id, { icon: v })} compact />
                  </div>
                  <Input value={t.name} onChange={(e) => updateArrayItem("competitionTypes", t.id, { name: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" />
                  <input type="color" value={t.color} onChange={(e) => updateArrayItem("competitionTypes", t.id, { color: e.target.value })} className="w-8 h-8 rounded cursor-pointer" />
                </div>
                <Textarea value={t.description} onChange={(e) => updateArrayItem("competitionTypes", t.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" rows={1} />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── Leaderboard ──────────────────────────────────────── */}
      <AccordionItem value="leaderboard" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.leaderboardEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Users className="h-5 w-5 text-cyan-400" />
            <span className="font-semibold text-white">Leaderboard Preview</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <SectionHeader label="Leaderboard Preview" icon={Users} iconColor="text-cyan-400" enabled={settings.leaderboardEnabled}
            onToggle={(v) => updateField("leaderboardEnabled", v)}
            description="Show top traders and recent competition winners."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.leaderboardTitle} onChange={(e) => updateField("leaderboardTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Subtitle</Label>
              <Input value={settings.leaderboardSubtitle} onChange={(e) => updateField("leaderboardSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
          <p className="text-xs text-gray-500">📊 Leaderboard data is auto-populated from live platform rankings.</p>
        </AccordionContent>
      </AccordionItem>

      {/* ── Activity Feed ────────────────────────────────────── */}
      <AccordionItem value="activityFeed" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.activityFeedEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Activity className="h-5 w-5 text-green-400" />
            <span className="font-semibold text-white">Activity Feed</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <SectionHeader label="Activity Feed" icon={Activity} iconColor="text-green-400" enabled={settings.activityFeedEnabled}
            onToggle={(v) => updateField("activityFeedEnabled", v)}
            description="Live stream of recent trades, competitions joined, and challenges completed."
          />
          <p className="text-xs text-gray-500">📊 Activity feed is auto-populated from live platform events.</p>
        </AccordionContent>
      </AccordionItem>

      {/* ── Testimonials ──────────────────────────────────────── */}
      <AccordionItem value="testimonials" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.testimonialsEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <MessageSquare className="h-5 w-5 text-purple-400" />
            <span className="font-semibold text-white">Testimonials</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <SectionHeader label="Testimonials" icon={MessageSquare} iconColor="text-purple-400" enabled={settings.testimonialsEnabled}
            onToggle={(v) => updateField("testimonialsEnabled", v)}
            description="User testimonials and success stories."
          />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.testimonialsTitle} onChange={(e) => updateField("testimonialsTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Subtitle</Label>
              <Input value={settings.testimonialsSubtitle} onChange={(e) => updateField("testimonialsSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── Trust Badges ──────────────────────────────────────── */}
      <AccordionItem value="trustBadges" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.trustBadgesEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Shield className="h-5 w-5 text-teal-400" />
            <span className="font-semibold text-white">Trust Badges</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <SectionHeader label="Trust Badges" icon={Shield} iconColor="text-teal-400" enabled={settings.trustBadgesEnabled}
            onToggle={(v) => updateField("trustBadgesEnabled", v)}
            description="Security badges, compliance logos, and trust indicators."
          />
          <div>
            <Label className="text-gray-400">Section Title</Label>
            <Input value={settings.trustBadgesTitle} onChange={(e) => updateField("trustBadgesTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* Journey & Badges, Marketplace, FAQ — from extracted file */}
      <NewSectionEditorsExtra
        settings={settings}
        updateField={updateField}
        addItem={addItem}
        removeItem={removeItem}
        updateArrayItem={updateArrayItem}
      />
    </>
  );
}

// ─── Section Order Editor ────────────────────────────────────────────────────

// Reason: These labels match the canonical section keys used by the landing page.
// "footer" is excluded because it is always rendered last and cannot be reordered.
const ALL_SECTION_LABELS: Record<string, { label: string; icon: React.ElementType }> = {
  hero: { label: "Hero", icon: BarChart3 },
  liveStats: { label: "Live Stats Bar", icon: BarChart3 },
  stats: { label: "Stats Counter", icon: BarChart3 },
  features: { label: "Features Grid", icon: Shield },
  howItWorks: { label: "How It Works", icon: Map },
  gameMaster: { label: "Game Master", icon: Crown },
  competitionTypes: { label: "Competition Types", icon: Trophy },
  competitions: { label: "Live Competitions", icon: Trophy },
  challenges: { label: "Live Challenges", icon: Users },
  activityFeed: { label: "Activity Feed", icon: Activity },
  leaderboard: { label: "Leaderboard", icon: Users },
  journeyBadges: { label: "Journey & Badges", icon: Map },
  marketplace: { label: "Marketplace", icon: ShoppingBag },
  testimonials: { label: "Testimonials", icon: MessageSquare },
  trustBadges: { label: "Trust Badges", icon: Shield },
  faq: { label: "FAQ", icon: HelpCircle },
  cta: { label: "Final CTA", icon: Activity },
};

interface SectionOrderEditorProps {
  order: string[];
  onOrderChange: (newOrder: string[]) => void;
}

export function SectionOrderEditor({ order, onOrderChange }: SectionOrderEditorProps) {
  const moveUp = (index: number) => {
    if (index === 0) return;
    const newOrder = [...order];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    onOrderChange(newOrder);
  };

  const moveDown = (index: number) => {
    if (index === order.length - 1) return;
    const newOrder = [...order];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    onOrderChange(newOrder);
  };

  return (
    <div className="space-y-2">
      <Label className="text-gray-300 text-sm font-semibold">Section Display Order</Label>
      <p className="text-xs text-gray-500 mb-3">Reorder how sections appear on the landing page.</p>
      <div className="space-y-1">
        {order.map((sectionKey, index) => {
          const info = ALL_SECTION_LABELS[sectionKey];
          if (!info) return null;
          const Icon = info.icon;
          return (
            <div key={sectionKey} className="flex items-center gap-2 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2">
              <GripVertical className="h-4 w-4 text-gray-500 flex-shrink-0" />
              <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="text-sm text-gray-300 flex-1">{info.label}</span>
              <div className="flex gap-1">
                <Button variant="ghost" size="sm" onClick={() => moveUp(index)} disabled={index === 0} className="h-6 w-6 p-0">
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => moveDown(index)} disabled={index === order.length - 1} className="h-6 w-6 p-0">
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
