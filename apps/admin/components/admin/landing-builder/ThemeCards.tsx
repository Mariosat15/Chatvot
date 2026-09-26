"use client";

import {
  Plus,
  Check,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Palette } from "lucide-react";
import {
  allThemes,
  themeCategories,
  getThemeById,
} from "@/lib/themes/landing-themes";
import type { LandingSettings } from "./types";

interface ThemeCardsProps {
  settings: LandingSettings;
  updateField: <K extends keyof LandingSettings>(key: K, value: LandingSettings[K]) => void;
}

export default function ThemeCards({ settings, updateField }: ThemeCardsProps) {
  return (
    <>
      {/* ─── Compact Theme Selection ──────────────────────────── */}
      <Card className="bg-gradient-to-r from-cyan-900/30 to-purple-900/30 border-cyan-500/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Palette className="h-6 w-6 text-cyan-400" />
              <div>
                <CardTitle className="text-white">🎨 Theme Selection</CardTitle>
                <CardDescription className="text-gray-400">
                  {allThemes.length} themes available
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Current Theme Preview */}
          {getThemeById(settings.activeTheme) && (
            <div className="flex items-center gap-4 p-4 bg-gray-800/50 rounded-lg border border-cyan-500/30">
              <div
                className="w-20 h-20 rounded-lg flex-shrink-0 border-2 border-gray-600"
                style={{ background: getThemeById(settings.activeTheme)?.preview }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h5 className="text-lg font-bold text-white">
                    {getThemeById(settings.activeTheme)?.name}
                  </h5>
                  <Badge className="bg-cyan-500 text-black text-[10px]">Active</Badge>
                </div>
                <p className="text-sm text-gray-400 mb-2">
                  {getThemeById(settings.activeTheme)?.description}
                </p>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1">
                    {["primary", "secondary", "accent", "background"].map((colorKey) => (
                      <div
                        key={colorKey}
                        className="w-5 h-5 rounded-full border border-white/20"
                        style={{
                          background: (getThemeById(settings.activeTheme)?.colors as Record<string, string>)?.[colorKey],
                        }}
                        title={colorKey}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-400">
                    {getThemeById(settings.activeTheme)?.fonts.heading.split(",")[0].replace(/"/g, "")}
                  </span>
                  <span className="text-xs text-gray-500">|</span>
                  <span className="text-xs text-gray-400 capitalize">
                    {getThemeById(settings.activeTheme)?.effects.particleType}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Theme Selector Dropdown */}
          <div>
            <Label className="text-gray-300 mb-2 block">Select Theme</Label>
            <Select value={settings.activeTheme} onValueChange={(v) => updateField("activeTheme", v)}>
              <SelectTrigger className="bg-gray-900 border-gray-600 text-white h-12">
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-md flex-shrink-0"
                    style={{ background: getThemeById(settings.activeTheme)?.preview }}
                  />
                  <SelectValue />
                </div>
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {themeCategories.map((category) => (
                  <div key={category.id}>
                    <div className="px-2 py-1.5 text-xs font-semibold text-gray-400 uppercase tracking-wider bg-gray-800/50 sticky top-0">
                      {category.icon} {category.name}
                    </div>
                    {allThemes
                      .filter((t) => t.category === category.id)
                      .map((theme) => (
                        <SelectItem key={theme.id} value={theme.id} className="py-2">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-6 rounded flex-shrink-0 border border-gray-600"
                              style={{ background: theme.preview }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium">{theme.name}</p>
                              <p className="text-[10px] text-gray-500 truncate">{theme.description}</p>
                            </div>
                            <div className="flex gap-0.5">
                              <div className="w-3 h-3 rounded-full" style={{ background: theme.colors.primary }} />
                              <div className="w-3 h-3 rounded-full" style={{ background: theme.colors.secondary }} />
                              <div className="w-3 h-3 rounded-full" style={{ background: theme.colors.accent }} />
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quick Theme Grid */}
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="themes" className="border-gray-700">
              <AccordionTrigger className="text-gray-300 hover:no-underline py-2">
                <span className="text-sm">Browse All Themes ({allThemes.length})</span>
              </AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-2 pt-2">
                  {allThemes.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => updateField("activeTheme", theme.id)}
                      className={`relative group rounded-lg overflow-hidden border-2 transition-all duration-200 ${
                        settings.activeTheme === theme.id
                          ? "border-cyan-500 shadow-[0_0_15px_rgba(0,255,255,0.3)] scale-105"
                          : "border-gray-700 hover:border-gray-500"
                      }`}
                      title={`${theme.name} - ${theme.description}`}
                    >
                      <div className="h-12 w-full" style={{ background: theme.preview }} />
                      <div className="p-1 bg-gray-800">
                        <p className="text-[9px] font-semibold text-white truncate text-center">{theme.name}</p>
                      </div>
                      {settings.activeTheme === theme.id && (
                        <div className="absolute top-0.5 right-0.5 w-4 h-4 bg-cyan-500 rounded-full flex items-center justify-center">
                          <Check className="h-2.5 w-2.5 text-black" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>

      {/* ─── Holiday Theme Auto-Switch ────────────────────────── */}
      <Card className="bg-gradient-to-r from-red-900/30 to-green-900/30 border-red-500/30">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🎄</span>
              <div>
                <CardTitle className="text-white">Holiday Theme Auto-Switch</CardTitle>
                <CardDescription className="text-gray-400">
                  Automatically switch themes based on holidays
                </CardDescription>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <Badge
                variant={settings.holidayThemesEnabled ? "default" : "secondary"}
                className={settings.holidayThemesEnabled ? "bg-green-500" : ""}
              >
                {settings.holidayThemesEnabled ? "Enabled" : "Disabled"}
              </Badge>
              <Switch
                checked={settings.holidayThemesEnabled}
                onCheckedChange={(v) => updateField("holidayThemesEnabled", v)}
              />
            </div>
          </div>
        </CardHeader>
        {settings.holidayThemesEnabled && (
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {settings.holidaySchedule.map((holiday) => (
                <HolidayCard
                  key={holiday.id}
                  holiday={holiday}
                  allSchedule={settings.holidaySchedule}
                  onScheduleChange={(updated) => updateField("holidaySchedule", updated)}
                />
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                updateField("holidaySchedule", [
                  ...settings.holidaySchedule,
                  {
                    id: `custom-${Date.now()}`,
                    name: "New Holiday",
                    themeId: "gaming-neon",
                    startMonth: 1,
                    startDay: 1,
                    endMonth: 1,
                    endDay: 7,
                    enabled: true,
                  },
                ]);
              }}
              className="border-gray-600"
            >
              <Plus className="h-4 w-4 mr-2" /> Add Custom Holiday
            </Button>
          </CardContent>
        )}
      </Card>
    </>
  );
}

// ─── Holiday Card Sub-component ──────────────────────────────────────────────

interface HolidayScheduleItem {
  id: string;
  name: string;
  themeId: string;
  startMonth: number;
  startDay: number;
  endMonth: number;
  endDay: number;
  enabled: boolean;
}

function HolidayCard({
  holiday,
  allSchedule,
  onScheduleChange,
}: {
  holiday: HolidayScheduleItem;
  allSchedule: HolidayScheduleItem[];
  onScheduleChange: (updated: HolidayScheduleItem[]) => void;
}) {
  const emoji =
    holiday.id === "christmas" ? "🎄"
      : holiday.id === "halloween" ? "🎃"
      : holiday.id === "easter" ? "🐰"
      : holiday.id === "black-friday" ? "🛒"
      : "📅";

  const update = (patch: Partial<HolidayScheduleItem>) =>
    onScheduleChange(allSchedule.map((h) => (h.id === holiday.id ? { ...h, ...patch } : h)));

  return (
    <div className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{emoji}</span>
          <span className="font-semibold text-white">{holiday.name}</span>
        </div>
        <Switch checked={holiday.enabled} onCheckedChange={(enabled) => update({ enabled })} />
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div>
          <Label className="text-gray-500 text-xs">Start Date</Label>
          <div className="flex gap-1">
            <Input
              type="number" min="1" max="12"
              value={holiday.startMonth}
              onChange={(e) => update({ startMonth: parseInt(e.target.value) || 1 })}
              className="bg-gray-900 border-gray-600 text-white w-16 text-center"
              placeholder="MM"
            />
            <Input
              type="number" min="1" max="31"
              value={holiday.startDay}
              onChange={(e) => update({ startDay: parseInt(e.target.value) || 1 })}
              className="bg-gray-900 border-gray-600 text-white w-16 text-center"
              placeholder="DD"
            />
          </div>
        </div>
        <div>
          <Label className="text-gray-500 text-xs">End Date</Label>
          <div className="flex gap-1">
            <Input
              type="number" min="1" max="12"
              value={holiday.endMonth}
              onChange={(e) => update({ endMonth: parseInt(e.target.value) || 1 })}
              className="bg-gray-900 border-gray-600 text-white w-16 text-center"
              placeholder="MM"
            />
            <Input
              type="number" min="1" max="31"
              value={holiday.endDay}
              onChange={(e) => update({ endDay: parseInt(e.target.value) || 1 })}
              className="bg-gray-900 border-gray-600 text-white w-16 text-center"
              placeholder="DD"
            />
          </div>
        </div>
      </div>
      <div className="mt-2">
        <Label className="text-gray-500 text-xs">Theme</Label>
        <Select value={holiday.themeId} onValueChange={(themeId) => update({ themeId })}>
          <SelectTrigger className="bg-gray-900 border-gray-600 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {allThemes.map((t) => (
              <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
