"use client";

import { useState, useCallback } from "react";
import { Megaphone } from "lucide-react";
import LPPageList from "./landing-pages/LPPageList";
import LPTemplateGallery from "./landing-pages/LPTemplateGallery";
import LPEditor from "./landing-pages/LPEditor";
import LPAnalytics from "./landing-pages/LPAnalytics";
import LPAIAgent from "./landing-pages/LPAIAgent";
import type { LandingPageData, LPSection, LPTemplate, AdminView } from "./landing-pages/lp-types";

/**
 * LandingPagesSection — Top-level admin component for the "Landing Pages" menu item.
 *
 * Orchestrates navigation between:
 *   list         → Page listing with KPIs
 *   templates    → Template gallery picker
 *   editor       → Create/edit landing page
 *   analytics    → Analytics dashboard
 *   ai-enhance   → AI enhances an existing template
 *   ai-generate  → AI generates a page from scratch
 */
export default function LandingPagesSection() {
  const [view, setView] = useState<AdminView>("list");
  const [editingPage, setEditingPage] = useState<LandingPageData | null>(null);
  const [templateSections, setTemplateSections] = useState<LandingPageData["sections"]>([]);
  const [analyticsPage, setAnalyticsPage] = useState<LandingPageData | undefined>();
  const [aiTemplate, setAiTemplate] = useState<LPTemplate | null>(null);

  // ── Navigation handlers ─────────────────────────────────────────────────
  const goToList = useCallback(() => {
    setView("list");
    setEditingPage(null);
    setTemplateSections([]);
    setAnalyticsPage(undefined);
    setAiTemplate(null);
  }, []);

  const handleEdit = useCallback((page: LandingPageData) => {
    setEditingPage(page);
    setTemplateSections([]);
    setView("editor");
  }, []);

  const handleViewAnalytics = useCallback((page?: LandingPageData) => {
    setAnalyticsPage(page || undefined);
    setView("analytics");
  }, []);

  const handleBrowseTemplates = useCallback(() => {
    setView("templates");
  }, []);

  const handleCreateFromScratch = useCallback(() => {
    setEditingPage(null);
    setTemplateSections([]);
    setView("editor");
  }, []);

  const handleSelectTemplate = useCallback((template: LPTemplate) => {
    setEditingPage(null);
    setTemplateSections(template.sections);
    setView("editor");
  }, []);

  const handleSaved = useCallback(() => {
    goToList();
  }, [goToList]);

  // ── AI Agent handlers ──────────────────────────────────────────────────
  const handleAIEnhanceTemplate = useCallback((template: LPTemplate) => {
    setAiTemplate(template);
    setView("ai-enhance");
  }, []);

  const handleAIGenerateFromScratch = useCallback(() => {
    setAiTemplate(null);
    setView("ai-generate");
  }, []);

  const handleAIAcceptSections = useCallback((sections: LPSection[]) => {
    // Reason: When AI produces sections, transition to the editor so the user can fine-tune
    setEditingPage(null);
    setTemplateSections(sections);
    setView("editor");
  }, []);

  return (
    <div className="space-y-6">
      {/* Section Title (visible on list view only) */}
      {view === "list" && (
        <div className="flex items-center gap-3">
          <div className="p-2 bg-yellow-500/10 rounded-xl">
            <Megaphone className="h-6 w-6 text-yellow-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Landing Pages</h1>
            <p className="text-sm text-gray-400">
              Create, manage, and track marketing landing pages
            </p>
          </div>
        </div>
      )}

      {/* View Router */}
      {view === "list" && (
        <LPPageList
          onEdit={handleEdit}
          onViewAnalytics={handleViewAnalytics}
          onBrowseTemplates={handleBrowseTemplates}
          onCreateFromScratch={handleCreateFromScratch}
          onAIGenerate={handleAIGenerateFromScratch}
        />
      )}

      {view === "templates" && (
        <LPTemplateGallery
          onSelectTemplate={handleSelectTemplate}
          onAIEnhance={handleAIEnhanceTemplate}
          onBack={goToList}
        />
      )}

      {view === "editor" && (
        <LPEditor
          page={editingPage}
          templateSections={templateSections}
          onBack={goToList}
          onSaved={handleSaved}
        />
      )}

      {view === "analytics" && (
        <LPAnalytics selectedPage={analyticsPage} onBack={goToList} />
      )}

      {(view === "ai-enhance" || view === "ai-generate") && (
        <LPAIAgent
          template={aiTemplate}
          existingSections={aiTemplate?.sections}
          onAcceptSections={handleAIAcceptSections}
          onBack={view === "ai-enhance" ? handleBrowseTemplates : goToList}
        />
      )}
    </div>
  );
}
