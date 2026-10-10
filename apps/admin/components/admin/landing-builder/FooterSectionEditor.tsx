"use client";

import { useState, useCallback } from "react";
import {
  Plus,
  Trash2,
  Loader2,
  Sparkles,
  FileText,
  Link2,
  AlertTriangle,
  CheckCircle2,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type { LandingSettings } from "./types";

// ─── Props ──────────────────────────────────────────────────────────────────

interface FooterSectionEditorProps {
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
  existingPageSlugs: Set<string>;
  creatingPageForSlug: string | null;
  onCreatePage: (label: string, href: string) => void;
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function FooterSectionEditor({
  settings,
  updateField,
  addItem,
  removeItem,
  updateArrayItem,
  existingPageSlugs,
  creatingPageForSlug,
  onCreatePage,
}: FooterSectionEditorProps) {
  const [generatingDisclaimer, setGeneratingDisclaimer] = useState(false);
  const [generatingCopyright, setGeneratingCopyright] = useState(false);

  const handleGenerateCopyright = useCallback(async () => {
    setGeneratingCopyright(true);
    try {
      const res = await fetch("/api/company-settings");
      const cs = await res.json();
      const companyName = cs?.companyName || cs?.company?.companyName || "Your Company";
      const legalName = cs?.legalName || "";
      const country = cs?.country || "";
      const year = "{YEAR}";
      let copyrightText: string;
      if (legalName && legalName !== companyName) {
        copyrightText = `© ${year} ${legalName} (trading as ${companyName}). All rights reserved.`;
      } else {
        copyrightText = `© ${year} ${companyName}. All rights reserved.`;
      }
      const countryName = country ? ` (${country})` : "";
      if (countryName) {
        copyrightText += countryName;
      }
      updateField("footerCopyright", copyrightText);
      toast.success("Copyright text generated from company settings!");
    } catch {
      toast.error("Failed to fetch company settings");
    } finally {
      setGeneratingCopyright(false);
    }
  }, [updateField]);

  const handleGenerateRiskDisclaimer = useCallback(async () => {
    setGeneratingDisclaimer(true);
    try {
      const res = await fetch("/api/pages/generate-risk-disclaimer", { method: "POST" });
      const data = await res.json();
      if (data.disclaimer) {
        updateField("footerRiskDisclaimer", data.disclaimer);
        toast.success("Risk disclaimer generated from company settings!");
      } else {
        toast.error(data.error || "Failed to generate disclaimer");
      }
    } catch {
      toast.error("Failed to generate risk disclaimer");
    } finally {
      setGeneratingDisclaimer(false);
    }
  }, [updateField]);

  return (
    <AccordionItem value="footer" className="bg-gray-800 border border-gray-700 rounded-lg px-4">
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${settings.footerEnabled ? "bg-green-500" : "bg-gray-500"}`} />
          <FileText className="h-5 w-5 text-gray-400" />
          <span className="font-semibold text-white">Footer</span>
        </div>
      </AccordionTrigger>
      <AccordionContent className="pt-4 pb-6 space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-gray-700">
          <Label className="text-gray-300">Enable Footer</Label>
          <Switch checked={settings.footerEnabled} onCheckedChange={(v) => updateField("footerEnabled", v)} />
        </div>

        {/* Risk Disclaimer */}
        <div className="p-4 bg-gray-900 rounded-lg space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-yellow-500 font-semibold">⚠️ Risk Disclaimer</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateRiskDisclaimer}
              disabled={generatingDisclaimer}
              className="border-yellow-600 text-yellow-500 hover:bg-yellow-500/10"
            >
              {generatingDisclaimer ? (
                <><Loader2 className="h-3 w-3 animate-spin mr-1" />Generating...</>
              ) : (
                <><Sparkles className="h-3 w-3 mr-1" />Generate Risk Disclaimer</>
              )}
            </Button>
          </div>
          <Textarea
            value={settings.footerRiskDisclaimer}
            onChange={(e) => updateField("footerRiskDisclaimer", e.target.value)}
            className="bg-gray-800 border-gray-600 text-white"
            rows={7}
            placeholder="Trading involves substantial risk..."
          />
          <p className="text-xs text-gray-500">
            This is the main risk disclaimer shown in the footer.
            Click &quot;Generate Risk Disclaimer&quot; to auto-generate a professional, legally
            compliant disclaimer using your company details.
          </p>
        </div>

        {/* Additional Disclaimer */}
        <div>
          <Label className="text-gray-400">Additional Disclaimer (Optional)</Label>
          <Textarea
            value={settings.footerDisclaimer}
            onChange={(e) => updateField("footerDisclaimer", e.target.value)}
            className="bg-gray-900 border-gray-600 text-white mt-1"
            rows={2}
            placeholder="Additional legal text..."
          />
        </div>

        {/* Copyright */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <Label className="text-gray-400">Copyright Text</Label>
            <Button
              size="sm"
              variant="outline"
              onClick={handleGenerateCopyright}
              disabled={generatingCopyright}
              className="border-yellow-600 text-yellow-500 hover:bg-yellow-500/10 h-7 text-xs"
            >
              {generatingCopyright ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {generatingCopyright ? "Generating..." : "Generate Copyright"}
            </Button>
          </div>
          <Input
            value={settings.footerCopyright}
            onChange={(e) => updateField("footerCopyright", e.target.value)}
            className="bg-gray-900 border-gray-600 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">
            Use <code className="text-yellow-500/80">{"{YEAR}"}</code> to auto-update the year
            (e.g. &quot;© {"{YEAR}"} ChartVolt&quot;). The landing page replaces it with the
            current year automatically.
          </p>
        </div>

        {/* Info: Footer Links ↔ Site Pages */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg flex items-start gap-3">
          <Link2 className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">Footer links are connected to Site Pages</p>
            <p className="text-blue-400/80 text-xs">
              Internal links (e.g. <code>/terms</code>, <code>/privacy</code>) point to pages
              managed in the <strong>Site Pages</strong> section. Use{" "}
              <CheckCircle2 className="h-3 w-3 inline text-green-400" /> to see which links
              already have a page, and click <Pencil className="h-3 w-3 inline" /> to edit or{" "}
              <Plus className="h-3 w-3 inline" /> to create one.
            </p>
          </div>
        </div>

        {/* Platform Menu */}
        <FooterMenuBlock
          title="Platform Menu Links"
          items={settings.footerMenuPlatform}
          existingPageSlugs={existingPageSlugs}
          creatingPageForSlug={creatingPageForSlug}
          onAdd={() =>
            addItem("footerMenuPlatform", {
              id: Date.now().toString(),
              label: "New Link",
              href: "/",
              enabled: true,
            })
          }
          onUpdate={(id, updates) => updateArrayItem("footerMenuPlatform", id, updates)}
          onRemove={(id) => removeItem("footerMenuPlatform", id)}
          onCreatePage={onCreatePage}
          placeholder="/path"
        />

        {/* Support Menu */}
        <FooterMenuBlock
          title="Support Menu Links"
          items={settings.footerMenuSupport}
          existingPageSlugs={existingPageSlugs}
          creatingPageForSlug={creatingPageForSlug}
          onAdd={() =>
            addItem("footerMenuSupport", {
              id: Date.now().toString(),
              label: "New Link",
              href: "/",
              enabled: true,
            })
          }
          onUpdate={(id, updates) => updateArrayItem("footerMenuSupport", id, updates)}
          onRemove={(id) => removeItem("footerMenuSupport", id)}
          onCreatePage={onCreatePage}
          placeholder="/path or mailto:"
        />

        {/* Business Menu */}
        <FooterMenuBlock
          title="Business Menu Links"
          items={settings.footerMenuBusiness}
          existingPageSlugs={existingPageSlugs}
          creatingPageForSlug={creatingPageForSlug}
          onAdd={() =>
            addItem("footerMenuBusiness", {
              id: Date.now().toString(),
              label: "New Link",
              href: "/",
              enabled: true,
            })
          }
          onUpdate={(id, updates) => updateArrayItem("footerMenuBusiness", id, updates)}
          onRemove={(id) => removeItem("footerMenuBusiness", id)}
          onCreatePage={onCreatePage}
          placeholder="/path"
        />
      </AccordionContent>
    </AccordionItem>
  );
}

// ─── Footer Menu Block — Shared sub-component ──────────────────────────────

interface FooterMenuBlockProps {
  title: string;
  items: Array<{ id: string; label: string; href: string; enabled: boolean }>;
  existingPageSlugs: Set<string>;
  creatingPageForSlug: string | null;
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<{ label: string; href: string; enabled: boolean }>) => void;
  onRemove: (id: string) => void;
  onCreatePage: (label: string, href: string) => void;
  placeholder: string;
}

function FooterMenuBlock({
  title,
  items,
  existingPageSlugs,
  creatingPageForSlug,
  onAdd,
  onUpdate,
  onRemove,
  onCreatePage,
  placeholder,
}: FooterMenuBlockProps) {
  const isInternalLink = (href: string) => href.startsWith("/") && !href.startsWith("//");
  const slugFromHref = (href: string) =>
    href.replace(/^\//, "").replace(/\//g, "-").toLowerCase();

  return (
    <div className="p-4 bg-gray-900 rounded-lg space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-gray-300 font-semibold">{title}</Label>
        <Button size="sm" variant="outline" onClick={onAdd} className="border-gray-600">
          <Plus className="h-4 w-4 mr-1" /> Add Link
        </Button>
      </div>
      {items.map((item) => {
        const internal = isInternalLink(item.href);
        const slug = internal ? slugFromHref(item.href) : "";
        const pageExists = internal && slug && existingPageSlugs.has(slug);
        const isCreating = creatingPageForSlug === slug;

        return (
          <div key={item.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={item.enabled}
                onCheckedChange={(v) => onUpdate(item.id, { enabled: v })}
              />
              <Input
                value={item.label}
                onChange={(e) => onUpdate(item.id, { label: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white flex-1"
                placeholder="Label"
              />
              <Input
                value={item.href}
                onChange={(e) => onUpdate(item.id, { href: e.target.value })}
                className="bg-gray-800 border-gray-600 text-white flex-1"
                placeholder={placeholder}
              />

              {internal && slug && (
                <>
                  {pageExists ? (
                    <Badge
                      variant="outline"
                      className="text-green-400 border-green-500/40 shrink-0 text-[10px] gap-1"
                      title="Site page exists for this link"
                    >
                      <CheckCircle2 className="h-3 w-3" />
                      Page
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-500/40 text-amber-400 hover:text-amber-300 shrink-0 text-[10px] h-7 px-2"
                      onClick={() => onCreatePage(item.label, item.href)}
                      disabled={isCreating}
                      title="Create a site page for this link"
                    >
                      {isCreating ? (
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <AlertTriangle className="h-3 w-3 mr-1" />
                      )}
                      Create Page
                    </Button>
                  )}
                </>
              )}

              <Button
                size="icon"
                variant="ghost"
                onClick={() => onRemove(item.id)}
                className="text-red-500 hover:text-red-400"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
