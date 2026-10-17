"use client";

import {
  Plus,
  Trash2,
  Sparkles,
  Globe,
  Settings,
  BarChart3,
  FileText,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { TabsContent } from "@/components/ui/tabs";
import type { LandingSettings } from "./types";
import { getMainAppUrl } from "./types";
import IconPickerField from "./IconPickerField";

// ─── Props ──────────────────────────────────────────────────────────────────

interface EnterpriseTabProps {
  settings: LandingSettings;
  updateField: <K extends keyof LandingSettings>(key: K, value: LandingSettings[K]) => void;
  addItem: <K extends keyof LandingSettings>(
    key: K,
    newItem: LandingSettings[K] extends Array<infer T> ? T : never,
  ) => void;
  removeItem: <K extends keyof LandingSettings>(key: K, id: string) => void;
  updateArrayItem: <K extends keyof LandingSettings>(
    key: K,
    id: string,
    updates: Partial<LandingSettings[K] extends Array<infer T> ? T : never>,
  ) => void;
}

// Reason: Enterprise Page tab extracted to keep the main file under 500 lines.

export default function EnterpriseTab({
  settings,
  updateField,
  addItem,
  removeItem,
  updateArrayItem,
}: EnterpriseTabProps) {
  return (
    <TabsContent value="enterprise-page" className="space-y-4 mt-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">Enterprise Page Sections</h3>
        <a href={`${getMainAppUrl()}/enterprise`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm" className="border-gray-600">
            <ExternalLink className="h-4 w-4 mr-2" />
            Preview Page
          </Button>
        </a>
      </div>

      <Accordion type="multiple" defaultValue={["ent-hero"]} className="space-y-4">
        {/* Enterprise Hero */}
        <AccordionItem value="ent-hero" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-green-500" />
              <Sparkles className="h-5 w-5 text-purple-500" />
              <span className="font-semibold text-white">Hero Section</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Title</Label>
                <Input value={settings.enterpriseHeroTitle} onChange={(e) => updateField("enterpriseHeroTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Badge Text</Label>
                <Input value={settings.enterpriseHeroBadge} onChange={(e) => updateField("enterpriseHeroBadge", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Subtitle</Label>
              <Input value={settings.enterpriseHeroSubtitle} onChange={(e) => updateField("enterpriseHeroSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Description</Label>
              <Textarea value={settings.enterpriseHeroDescription} onChange={(e) => updateField("enterpriseHeroDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Primary Button Text</Label>
                <Input value={settings.enterpriseHeroCTAText} onChange={(e) => updateField("enterpriseHeroCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Primary Button Link</Label>
                <Input value={settings.enterpriseHeroCTALink} onChange={(e) => updateField("enterpriseHeroCTALink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* White Label Features */}
        <AccordionItem value="ent-whitelabel" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${settings.enterpriseWhiteLabelEnabled ? "bg-green-500" : "bg-gray-500"}`} />
              <Globe className="h-5 w-5 text-blue-500" />
              <span className="font-semibold text-white">White Label Features</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-700">
              <Label className="text-gray-300">Enable White Label Section</Label>
              <Switch checked={settings.enterpriseWhiteLabelEnabled} onCheckedChange={(v) => updateField("enterpriseWhiteLabelEnabled", v)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Section Title</Label>
                <Input value={settings.enterpriseWhiteLabelTitle} onChange={(e) => updateField("enterpriseWhiteLabelTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Section Subtitle</Label>
                <Input value={settings.enterpriseWhiteLabelSubtitle} onChange={(e) => updateField("enterpriseWhiteLabelSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Features</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addItem("enterpriseWhiteLabelFeatures", { id: Date.now().toString(), icon: "Star", title: "New Feature", description: "Description", enabled: true })}
                  className="border-gray-600"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Feature
                </Button>
              </div>
              {settings.enterpriseWhiteLabelFeatures.map((feature) => (
                <div key={feature.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={feature.enabled}
                      onCheckedChange={(v) => updateArrayItem("enterpriseWhiteLabelFeatures", feature.id, { enabled: v })}
                    />
                    <div className="w-48">
                      <IconPickerField
                        value={feature.icon}
                        onChange={(v) => updateArrayItem("enterpriseWhiteLabelFeatures", feature.id, { icon: v })}
                        compact
                      />
                    </div>
                    <Input value={feature.title} onChange={(e) => updateArrayItem("enterpriseWhiteLabelFeatures", feature.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" />
                    <Button size="icon" variant="ghost" onClick={() => removeItem("enterpriseWhiteLabelFeatures", feature.id)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Input value={feature.description} onChange={(e) => updateArrayItem("enterpriseWhiteLabelFeatures", feature.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Description" />
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Admin Panel Showcase */}
        <AccordionItem value="ent-admin" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${settings.enterpriseAdminEnabled ? "bg-green-500" : "bg-gray-500"}`} />
              <Settings className="h-5 w-5 text-yellow-500" />
              <span className="font-semibold text-white">Admin Panel Showcase</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-700">
              <Label className="text-gray-300">Enable Admin Showcase Section</Label>
              <Switch checked={settings.enterpriseAdminEnabled} onCheckedChange={(v) => updateField("enterpriseAdminEnabled", v)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Section Title</Label>
                <Input value={settings.enterpriseAdminTitle} onChange={(e) => updateField("enterpriseAdminTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Section Subtitle</Label>
                <Input value={settings.enterpriseAdminSubtitle} onChange={(e) => updateField("enterpriseAdminSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">Description</Label>
              <Textarea value={settings.enterpriseAdminDescription} onChange={(e) => updateField("enterpriseAdminDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-gray-300">Admin Features</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addItem("enterpriseAdminFeatures", { id: Date.now().toString(), icon: "Star", title: "New Feature", description: "Description", color: "from-cyan-500 to-blue-600", enabled: true })}
                  className="border-gray-600"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add Feature
                </Button>
              </div>
              {settings.enterpriseAdminFeatures.map((feature) => (
                <div key={feature.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                  <div className="flex items-center gap-3">
                    <Switch checked={feature.enabled} onCheckedChange={(v) => updateArrayItem("enterpriseAdminFeatures", feature.id, { enabled: v })} />
                    <div className="w-48">
                      <IconPickerField
                        value={feature.icon}
                        onChange={(v) => updateArrayItem("enterpriseAdminFeatures", feature.id, { icon: v })}
                        compact
                      />
                    </div>
                    <Input value={feature.title} onChange={(e) => updateArrayItem("enterpriseAdminFeatures", feature.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" />
                    <Button size="icon" variant="ghost" onClick={() => removeItem("enterpriseAdminFeatures", feature.id)} className="text-red-500">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <Textarea value={feature.description} onChange={(e) => updateArrayItem("enterpriseAdminFeatures", feature.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" rows={2} placeholder="Feature description" />
                  <div>
                    <Label className="text-gray-500 text-xs">Gradient Color</Label>
                    <Input value={feature.color} onChange={(e) => updateArrayItem("enterpriseAdminFeatures", feature.id, { color: e.target.value })} className="bg-gray-800 border-gray-600 text-white mt-1" placeholder="from-cyan-500 to-blue-600" />
                  </div>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Pricing */}
        <AccordionItem value="ent-pricing" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${settings.enterprisePricingEnabled ? "bg-green-500" : "bg-gray-500"}`} />
              <BarChart3 className="h-5 w-5 text-green-500" />
              <span className="font-semibold text-white">Pricing Section</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-700">
              <Label className="text-gray-300">Enable Pricing Section</Label>
              <Switch checked={settings.enterprisePricingEnabled} onCheckedChange={(v) => updateField("enterprisePricingEnabled", v)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Section Title</Label>
                <Input value={settings.enterprisePricingTitle} onChange={(e) => updateField("enterprisePricingTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Section Subtitle</Label>
                <Input value={settings.enterprisePricingSubtitle} onChange={(e) => updateField("enterprisePricingSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
            </div>
            <div className="space-y-3">
              <Label className="text-gray-300">Pricing Tiers</Label>
              {settings.enterprisePricingTiers.map((tier) => (
                <div key={tier.id} className="p-4 bg-gray-900 rounded-lg space-y-3">
                  <div className="flex items-center gap-3">
                    <Switch checked={tier.enabled} onCheckedChange={(v) => updateArrayItem("enterprisePricingTiers", tier.id, { enabled: v })} />
                    <Input value={tier.name} onChange={(e) => updateArrayItem("enterprisePricingTiers", tier.id, { name: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-32" placeholder="Plan Name" />
                    <Input value={tier.price} onChange={(e) => updateArrayItem("enterprisePricingTiers", tier.id, { price: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-24" placeholder="$499" />
                    <Input value={tier.period} onChange={(e) => updateArrayItem("enterprisePricingTiers", tier.id, { period: e.target.value })} className="bg-gray-800 border-gray-600 text-white w-20" placeholder="/month" />
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-gray-400">Highlight</Label>
                      <Switch checked={tier.highlighted} onCheckedChange={(v) => updateArrayItem("enterprisePricingTiers", tier.id, { highlighted: v })} />
                    </div>
                  </div>
                  <Input value={tier.description} onChange={(e) => updateArrayItem("enterprisePricingTiers", tier.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Plan description" />
                  <Input value={tier.ctaText} onChange={(e) => updateArrayItem("enterprisePricingTiers", tier.id, { ctaText: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Button text" />
                  <Textarea
                    value={tier.features.join("\n")}
                    onChange={(e) => updateArrayItem("enterprisePricingTiers", tier.id, { features: e.target.value.split("\n").filter((f) => f.trim()) })}
                    className="bg-gray-800 border-gray-600 text-white"
                    rows={3}
                    placeholder="Features (one per line)"
                  />
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* Contact */}
        <AccordionItem value="ent-contact" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${settings.enterpriseContactEnabled ? "bg-green-500" : "bg-gray-500"}`} />
              <FileText className="h-5 w-5 text-pink-500" />
              <span className="font-semibold text-white">Contact Section</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pt-4 pb-6 space-y-4">
            <div className="flex items-center justify-between pb-4 border-b border-gray-700">
              <Label className="text-gray-300">Enable Contact Section</Label>
              <Switch checked={settings.enterpriseContactEnabled} onCheckedChange={(v) => updateField("enterpriseContactEnabled", v)} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Section Title</Label>
                <Input value={settings.enterpriseContactTitle} onChange={(e) => updateField("enterpriseContactTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Section Subtitle</Label>
                <Input value={settings.enterpriseContactSubtitle} onChange={(e) => updateField("enterpriseContactSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-gray-400">Contact Email</Label>
                <Input value={settings.enterpriseContactEmail} onChange={(e) => updateField("enterpriseContactEmail", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
              <div>
                <Label className="text-gray-400">Contact Phone</Label>
                <Input value={settings.enterpriseContactPhone} onChange={(e) => updateField("enterpriseContactPhone", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-gray-400">CTA Button Text</Label>
              <Input value={settings.enterpriseContactCTAText} onChange={(e) => updateField("enterpriseContactCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </TabsContent>
  );
}
