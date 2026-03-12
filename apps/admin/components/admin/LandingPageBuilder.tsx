"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import {
  Save,
  Loader2,
  Sparkles,
  Building2,
  Palette,
  ExternalLink,
  RefreshCw,
  Layers,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";

// ─── Local sub-modules (extracted for <500-line rule) ───────────────────────
import type { LandingSettings } from "./landing-builder/types";
import { getMainAppUrl } from "./landing-builder/types";
import { defaultSettings } from "./landing-builder/defaults";
import { mapFromDbSettings, mapToDbSettings } from "./landing-builder/settings-mapper";
import ThemeCards from "./landing-builder/ThemeCards";
import ThemeEffectsCard from "./landing-builder/ThemeEffectsCard";
import HeroSectionEditors from "./landing-builder/HeroSectionEditors";
import ContentSectionEditors from "./landing-builder/ContentSectionEditors";
import FooterSectionEditor from "./landing-builder/FooterSectionEditor";
import EnterpriseTab from "./landing-builder/EnterpriseTab";
import NewSectionEditors, {
  SectionOrderEditor,
  type SectionVisibilitySettings,
} from "./landing-builder/NewSectionEditors";

// ─────────────────────────────────────────────────────────────────────────────

export default function LandingPageBuilder() {
  const [settings, setSettings] = useState<LandingSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resettingDefaults, setResettingDefaults] = useState(false);
  const [activeTab, setActiveTab] = useState("hero-page");

  // Footer link ↔ Site Pages helpers
  const [existingPageSlugs, setExistingPageSlugs] = useState<Set<string>>(
    new Set(),
  );
  const [creatingPageForSlug, setCreatingPageForSlug] = useState<string | null>(
    null,
  );

  // ─── Data helpers ──────────────────────────────────────────────────────

  const fetchSitePages = useCallback(async () => {
    try {
      const res = await fetch("/api/pages");
      const data = await res.json();
      if (Array.isArray(data)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setExistingPageSlugs(new Set(data.map((p: any) => p.slug)));
      }
    } catch {
      /* silent */
    }
  }, []);

  const handleCreatePageForLink = async (label: string, href: string) => {
    const slug = href.replace(/^\//, "").replace(/\//g, "-") || "new-page";
    setCreatingPageForSlug(slug);
    try {
      const res = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: label,
          slug,
          content: `<h1>${label}</h1>\n<p>Content for the ${label} page.</p>`,
          status: "draft",
        }),
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      if (res.ok) {
        toast.success(`Page "${label}" created as draft!`);
        setExistingPageSlugs((prev) => new Set([...prev, slug]));
      } else {
        toast.error(data?.error || "Failed to create page");
      }
    } catch {
      toast.error("Failed to create page");
    } finally {
      setCreatingPageForSlug(null);
    }
  };

  // ─── Fetch / Save / Reset ─────────────────────────────────────────────

  const fetchSettings = useCallback(async () => {
    try {
      const response = await fetch("/api/hero-settings");
      if (response.ok) {
        const data = await response.json();
        if (data?.settings) {
          setSettings(mapFromDbSettings(data.settings));
        }
      }
    } catch {
      toast.error("Failed to load landing page settings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
    fetchSitePages();
  }, [fetchSettings, fetchSitePages]);

  const saveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch("/api/hero-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapToDbSettings(settings)),
      });
      if (response.ok) {
        toast.success("Landing page settings saved successfully!");
      } else {
        toast.error("Failed to save settings");
      }
    } catch {
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = async () => {
    if (!confirm("This will replace ALL content with the latest marketing-grade defaults and save immediately. Continue?")) {
      return;
    }
    setResettingDefaults(true);
    try {
      const response = await fetch("/api/hero-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mapToDbSettings(defaultSettings)),
      });
      if (response.ok) {
        setSettings(defaultSettings);
        toast.success("All landing page settings reset to defaults and saved!");
      } else {
        toast.error("Failed to reset settings");
      }
    } catch {
      toast.error("Failed to reset settings");
    } finally {
      setResettingDefaults(false);
    }
  };

  // ─── Generic field updaters ───────────────────────────────────────────

  const updateField = <K extends keyof LandingSettings>(
    key: K,
    value: LandingSettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const addItem = <K extends keyof LandingSettings>(
    key: K,
    newItem: LandingSettings[K] extends Array<infer T> ? T : never,
  ) => {
    const current = settings[key];
    if (Array.isArray(current)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateField(key, [...current, newItem] as any);
    }
  };

  const removeItem = <K extends keyof LandingSettings>(key: K, id: string) => {
    const current = settings[key];
    if (Array.isArray(current)) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      updateField(key, current.filter((item: any) => item.id !== id) as any);
    }
  };

  const updateArrayItem = <K extends keyof LandingSettings>(
    key: K,
    id: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    updates: Record<string, any>,
  ) => {
    const current = settings[key];
    if (Array.isArray(current)) {
      updateField(
        key,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        current.map((item: any) => (item.id === id ? { ...item, ...updates } : item)) as any,
      );
    }
  };

  // ─── Loading state ────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-yellow-500" />
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Landing Page Builder</h2>
          <p className="text-gray-400">Configure your Hero and Enterprise landing pages</p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={resetToDefaults}
            disabled={resettingDefaults}
            className="border-orange-500/50 text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
            title="Replace all content with the latest marketing-grade defaults and save"
          >
            {resettingDefaults ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4 mr-2" />
            )}
            Reset to Defaults
          </Button>
          <Button variant="outline" onClick={fetchSettings} className="border-gray-600">
            <RefreshCw className="h-4 w-4 mr-2" />
            Reload
          </Button>
          <Button
            onClick={saveSettings}
            disabled={saving}
            className="bg-yellow-500 hover:bg-yellow-400 text-gray-900"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save All Changes
          </Button>
        </div>
      </div>

      {/* Enterprise Page Toggle */}
      <Card className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 border-purple-500/30">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Building2 className="h-8 w-8 text-purple-400" />
              <div>
                <h3 className="text-lg font-semibold text-white">Enterprise Page</h3>
                <p className="text-sm text-gray-400">
                  Enable or disable the /enterprise page (for white-label customers)
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge variant={settings.enterprisePageEnabled ? "default" : "secondary"} className={settings.enterprisePageEnabled ? "bg-green-500" : ""}>
                {settings.enterprisePageEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <Switch checked={settings.enterprisePageEnabled} onCheckedChange={(v) => updateField("enterprisePageEnabled", v)} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Theme Selection + Holiday + Effects */}
      <ThemeCards settings={settings} updateField={updateField} />
      <ThemeEffectsCard settings={settings} updateField={updateField} />

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-gray-800 p-1">
          <TabsTrigger value="hero-page" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-gray-900">
            <Sparkles className="h-4 w-4 mr-2" />
            Hero Page
          </TabsTrigger>
          <TabsTrigger
            value="enterprise-page"
            className="data-[state=active]:bg-purple-500 data-[state=active]:text-white"
            disabled={!settings.enterprisePageEnabled}
          >
            <Building2 className="h-4 w-4 mr-2" />
            Enterprise Page
          </TabsTrigger>
        </TabsList>

        {/* ── Hero Page Tab ──────────────────────────────────────── */}
        <TabsContent value="hero-page" className="space-y-4 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Hero Page Sections</h3>
            <a href={getMainAppUrl()} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-gray-600">
                <ExternalLink className="h-4 w-4 mr-2" />
                Preview Page
              </Button>
            </a>
          </div>

          <Accordion type="multiple" defaultValue={["hero", "stats"]} className="space-y-4">
            {/* Hero / Stats / Features / How It Works */}
            <HeroSectionEditors
              settings={settings}
              updateField={updateField}
              addItem={addItem}
              removeItem={removeItem}
              updateArrayItem={updateArrayItem}
            />

            {/* Competitions / Challenges / Final CTA */}
            <ContentSectionEditors settings={settings} updateField={updateField} />

            {/* New Section Visibility Toggles */}
            <NewSectionEditors
              settings={settings as unknown as SectionVisibilitySettings}
              onToggle={(key, value) => updateField(key as keyof LandingSettings, value as never)}
            />

            {/* Section Display Order */}
            <AccordionItem value="section-order" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-blue-500" />
                  <Layers className="h-5 w-5 text-blue-400" />
                  <span className="font-semibold text-white">Section Display Order</span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-4 pb-6">
                <SectionOrderEditor
                  order={settings.sectionOrder}
                  onOrderChange={(newOrder) => updateField("sectionOrder", newOrder)}
                />
              </AccordionContent>
            </AccordionItem>

            {/* Footer */}
            <FooterSectionEditor
              settings={settings}
              updateField={updateField}
              addItem={addItem}
              removeItem={removeItem}
              updateArrayItem={updateArrayItem}
              existingPageSlugs={existingPageSlugs}
              creatingPageForSlug={creatingPageForSlug}
              onCreatePage={handleCreatePageForLink}
            />
          </Accordion>
        </TabsContent>

        {/* ── Enterprise Page Tab ────────────────────────────────── */}
        <EnterpriseTab
          settings={settings}
          updateField={updateField}
          addItem={addItem}
          removeItem={removeItem}
          updateArrayItem={updateArrayItem}
        />
      </Tabs>
    </div>
  );
}
