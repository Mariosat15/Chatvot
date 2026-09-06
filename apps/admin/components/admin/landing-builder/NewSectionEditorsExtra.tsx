"use client";

import {
  Map, ShoppingBag, HelpCircle, Plus, Trash2,
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

// Reason: This file houses the Journey & Badges, Marketplace, and FAQ
// section editors — extracted to keep NewSectionEditors.tsx under 500 lines.

export default function NewSectionEditorsExtra({
  settings,
  updateField,
  addItem,
  removeItem,
  updateArrayItem,
}: BuilderChildProps) {
  return (
    <>
      {/* ── Journey & Badges ─────────────────────────────────── */}
      <AccordionItem value="journeyBadges" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.journeyBadgesEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <Map className="h-5 w-5 text-emerald-400" />
            <span className="font-semibold text-white">Journey & Badges</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <div>
              <Label className="text-gray-300">Enable Journey & Badges</Label>
              <p className="text-xs text-gray-500 mt-1">
                Showcase the progression system, milestones, zones, and collectible badges.
              </p>
            </div>
            <Switch checked={settings.journeyBadgesEnabled} onCheckedChange={(v) => updateField("journeyBadgesEnabled", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.journeyBadgesTitle} onChange={(e) => updateField("journeyBadgesTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">CTA Button Text</Label>
              <Input value={settings.journeyBadgesCTAText} onChange={(e) => updateField("journeyBadgesCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-gray-400">Subtitle</Label>
            <Input value={settings.journeyBadgesSubtitle} onChange={(e) => updateField("journeyBadgesSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea value={settings.journeyBadgesDescription} onChange={(e) => updateField("journeyBadgesDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-gray-400">CTA Link</Label>
            <Input value={settings.journeyBadgesCTALink} onChange={(e) => updateField("journeyBadgesCTALink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>

          {/* Features */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 font-semibold">Journey Features</Label>
              <Button size="sm" variant="outline" className="border-gray-600"
                onClick={() => addItem("journeyBadgeFeatures", {
                  id: Date.now().toString(), icon: "Star", gameIcon: "", title: "New Feature",
                  description: "Description", enabled: true, order: settings.journeyBadgeFeatures.length + 1,
                })}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {settings.journeyBadgeFeatures.map((f) => (
              <div key={f.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <Switch checked={f.enabled} onCheckedChange={(v) => updateArrayItem("journeyBadgeFeatures", f.id, { enabled: v })} />
                  <div className="w-40">
                    <IconPickerField value={f.icon} onChange={(v) => updateArrayItem("journeyBadgeFeatures", f.id, { icon: v })} compact />
                  </div>
                  <Input value={f.title} onChange={(e) => updateArrayItem("journeyBadgeFeatures", f.id, { title: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" />
                  <Button size="icon" variant="ghost" onClick={() => removeItem("journeyBadgeFeatures", f.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea value={f.description} onChange={(e) => updateArrayItem("journeyBadgeFeatures", f.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" rows={1} />
                {f.gameIcon && (
                  <div className="flex items-center gap-2 pl-1">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={f.gameIcon} alt="" className="w-6 h-6" />
                    <span className="text-xs text-gray-500">{f.gameIcon}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── Marketplace ──────────────────────────────────────── */}
      <AccordionItem value="marketplace" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.marketplaceEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <ShoppingBag className="h-5 w-5 text-pink-400" />
            <span className="font-semibold text-white">Marketplace</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <div>
              <Label className="text-gray-300">Enable Marketplace</Label>
              <p className="text-xs text-gray-500 mt-1">
                Display marketplace items and trading tools available for purchase.
              </p>
            </div>
            <Switch checked={settings.marketplaceEnabled} onCheckedChange={(v) => updateField("marketplaceEnabled", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.marketplaceTitle} onChange={(e) => updateField("marketplaceTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">CTA Button Text</Label>
              <Input value={settings.marketplaceCTAText} onChange={(e) => updateField("marketplaceCTAText", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>
          <div>
            <Label className="text-gray-400">Subtitle</Label>
            <Input value={settings.marketplaceSubtitle} onChange={(e) => updateField("marketplaceSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>
          <div>
            <Label className="text-gray-400">Description</Label>
            <Textarea value={settings.marketplaceDescription} onChange={(e) => updateField("marketplaceDescription", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" rows={2} />
          </div>
          <div>
            <Label className="text-gray-400">CTA Link</Label>
            <Input value={settings.marketplaceCTALink} onChange={(e) => updateField("marketplaceCTALink", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
          </div>

          {/* Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 font-semibold">Marketplace Items</Label>
              <Button size="sm" variant="outline" className="border-gray-600"
                onClick={() => addItem("marketplaceItems", {
                  id: Date.now().toString(), icon: "Star", gameIcon: "", name: "New Item",
                  description: "Description", price: "From 50 Credits", enabled: true,
                  order: settings.marketplaceItems.length + 1,
                })}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {settings.marketplaceItems.map((item) => (
              <div key={item.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <Switch checked={item.enabled} onCheckedChange={(v) => updateArrayItem("marketplaceItems", item.id, { enabled: v })} />
                  <Input value={item.name} onChange={(e) => updateArrayItem("marketplaceItems", item.id, { name: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Item name" />
                  <Button size="icon" variant="ghost" onClick={() => removeItem("marketplaceItems", item.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                {/* Reason: Use a single icon picker that updates both icon & gameIcon fields. 
                    Game icon paths start with "/", Lucide names do not. */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <IconPickerField
                    value={item.gameIcon || item.icon}
                    label="Item Icon (Lucide or Game)"
                    onChange={(v) => {
                      if (v.startsWith("/")) {
                        updateArrayItem("marketplaceItems", item.id, { gameIcon: v, icon: "" });
                      } else {
                        updateArrayItem("marketplaceItems", item.id, { icon: v, gameIcon: "" });
                      }
                    }}
                  />
                  <Input value={item.price} onChange={(e) => updateArrayItem("marketplaceItems", item.id, { price: e.target.value })} className="bg-gray-800 border-gray-600 text-white" placeholder="Price (e.g. From 50 Credits)" />
                </div>
                <Textarea value={item.description} onChange={(e) => updateArrayItem("marketplaceItems", item.id, { description: e.target.value })} className="bg-gray-800 border-gray-600 text-white" rows={2} placeholder="Description" />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>

      {/* ── FAQ ───────────────────────────────────────────────── */}
      <AccordionItem value="faq" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
        <AccordionTrigger className="hover:no-underline">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${settings.faqEnabled ? "bg-green-500" : "bg-gray-500"}`} />
            <HelpCircle className="h-5 w-5 text-amber-400" />
            <span className="font-semibold text-white">FAQ Section</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="pt-4 pb-6 space-y-4">
          <div className="flex items-center justify-between pb-4 border-b border-gray-700">
            <div>
              <Label className="text-gray-300">Enable FAQ Section</Label>
              <p className="text-xs text-gray-500 mt-1">
                Frequently asked questions with expandable answers.
              </p>
            </div>
            <Switch checked={settings.faqEnabled} onCheckedChange={(v) => updateField("faqEnabled", v)} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-gray-400">Section Title</Label>
              <Input value={settings.faqTitle} onChange={(e) => updateField("faqTitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
            <div>
              <Label className="text-gray-400">Subtitle</Label>
              <Input value={settings.faqSubtitle} onChange={(e) => updateField("faqSubtitle", e.target.value)} className="bg-gray-900 border-gray-600 text-white mt-1" />
            </div>
          </div>

          {/* FAQ Items */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-gray-300 font-semibold">FAQ Items</Label>
              <Button size="sm" variant="outline" className="border-gray-600"
                onClick={() => addItem("faqItems", {
                  id: Date.now().toString(), question: "New Question?", answer: "Answer here.",
                  category: "general", order: settings.faqItems.length + 1, enabled: true,
                })}
              >
                <Plus className="h-4 w-4 mr-1" /> Add
              </Button>
            </div>
            {settings.faqItems.map((faq) => (
              <div key={faq.id} className="p-3 bg-gray-900 rounded-lg space-y-2">
                <div className="flex items-center gap-3">
                  <Switch checked={faq.enabled} onCheckedChange={(v) => updateArrayItem("faqItems", faq.id, { enabled: v })} />
                  <Input value={faq.question} onChange={(e) => updateArrayItem("faqItems", faq.id, { question: e.target.value })} className="bg-gray-800 border-gray-600 text-white flex-1" placeholder="Question" />
                  <select
                    value={faq.category}
                    onChange={(e) => updateArrayItem("faqItems", faq.id, { category: e.target.value })}
                    className="bg-gray-800 border border-gray-600 text-white text-xs rounded px-2 py-1 w-28"
                  >
                    <option value="general">General</option>
                    <option value="competitions">Competitions</option>
                    <option value="challenges">Challenges</option>
                    <option value="game-master">Game Master</option>
                    <option value="payments">Payments</option>
                  </select>
                  <Button size="icon" variant="ghost" onClick={() => removeItem("faqItems", faq.id)} className="text-red-500 hover:text-red-400">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea value={faq.answer} onChange={(e) => updateArrayItem("faqItems", faq.id, { answer: e.target.value })} className="bg-gray-800 border-gray-600 text-white" rows={2} placeholder="Answer" />
              </div>
            ))}
          </div>
        </AccordionContent>
      </AccordionItem>
    </>
  );
}
