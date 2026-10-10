"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AUTH_PILL_ICONS,
  AUTH_PILL_MAX_COUNT,
  AUTH_PILL_MAX_LABEL_LENGTH,
  resolveAuthFeaturePills,
  validateAuthFeaturePills,
  type AuthFeaturePill,
} from "@/lib/constants/auth-feature-pills";

const ICON_SLUGS = [...AUTH_PILL_ICONS.keys()];

function PillPreview({ pills }: { pills: AuthFeaturePill[] }) {
  if (pills.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        No pills: the row under the sign-in card will be hidden.
      </p>
    );
  }
  return (
    <ul className="flex flex-wrap items-center justify-center gap-2">
      {pills.map(({ label, icon }, index) => {
        const Icon = AUTH_PILL_ICONS.get(icon);
        return (
          <li
            key={`${index}-${label}`}
            className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-[#081428]/80 px-3 py-2 text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-50"
          >
            {Icon && <Icon className="h-3.5 w-3.5 text-cyan-300" aria-hidden />}
            {label || "…"}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * Branding editor for the feature pills under the sign-in card. Saves only
 * its own field, so it cannot overwrite the rest of the auth settings.
 */
export default function AuthFeaturePillsEditor() {
  const [pills, setPills] = useState<AuthFeaturePill[]>([]);
  const [usingDefaults, setUsingDefaults] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch("/api/hero-settings");
        if (!response.ok) throw new Error("load failed");
        const data = await response.json();
        const stored = (data.settings || data).authPageFeaturePills;
        setUsingDefaults(stored === undefined || stored === null);
        setPills(resolveAuthFeaturePills(stored));
      } catch {
        toast.error("Failed to load sign-in feature pills");
        setPills(resolveAuthFeaturePills(undefined));
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const update = (index: number, patch: Partial<AuthFeaturePill>) =>
    setPills((prev) =>
      prev.map((pill, i) => (i === index ? { ...pill, ...patch } : pill)),
    );

  const move = (index: number, offset: -1 | 1) =>
    setPills((prev) => {
      const target = index + offset;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [moved] = next.splice(index, 1);
      next.splice(target, 0, moved);
      return next;
    });

  const persist = async (value: AuthFeaturePill[] | null) => {
    setSaving(true);
    try {
      const response = await fetch("/api/hero-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ authPageFeaturePills: value }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        toast.error(data.error || "Something went wrong. Please contact support.");
        return;
      }
      const stored = data.settings?.authPageFeaturePills;
      setUsingDefaults(stored === undefined || stored === null);
      setPills(resolveAuthFeaturePills(stored));
      toast.success(
        value === null ? "Feature pills reset to defaults" : "Feature pills saved",
      );
    } catch {
      toast.error("Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    const checked = validateAuthFeaturePills(pills);
    if (!checked.ok) {
      toast.error(checked.error);
      return;
    }
    void persist(checked.value);
  };

  return (
    <div className="bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700 rounded-2xl overflow-hidden shadow-xl">
      <div className="bg-gradient-to-r from-cyan-600 to-sky-600 p-6">
        <div className="flex items-center gap-4">
          <div className="h-14 w-14 bg-white rounded-xl flex items-center justify-center shadow-xl">
            <Sparkles className="h-7 w-7 text-cyan-600" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">
              Sign-in Feature Pills
            </h2>
            <p className="text-cyan-50 mt-1">
              The highlights shown under the login card. Up to{" "}
              {AUTH_PILL_MAX_COUNT}, each with an icon and a short label.
            </p>
          </div>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {loading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-6 w-6 text-cyan-400 animate-spin" />
          </div>
        ) : (
          <>
            <div className="rounded-xl border border-gray-700 bg-[#050814] p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
                Preview {usingDefaults && "(shipped defaults)"}
              </p>
              <PillPreview pills={pills} />
            </div>

            <div className="space-y-3">
              {pills.map((pill, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 p-3"
                >
                  <Select
                    value={pill.icon}
                    onValueChange={(icon) => update(index, { icon })}
                  >
                    <SelectTrigger className="w-44 bg-gray-900 border-gray-700 text-white">
                      <SelectValue placeholder="Icon" />
                    </SelectTrigger>
                    <SelectContent>
                      {ICON_SLUGS.map((slug) => {
                        const Icon = AUTH_PILL_ICONS.get(slug);
                        return (
                          <SelectItem key={slug} value={slug}>
                            {Icon && <Icon className="h-4 w-4" />}
                            {slug}
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                  <Input
                    value={pill.label}
                    maxLength={AUTH_PILL_MAX_LABEL_LENGTH}
                    onChange={(e) => update(index, { label: e.target.value })}
                    placeholder="Label, e.g. Live Leaderboards"
                    className="flex-1 min-w-[12rem] bg-gray-900 border-gray-700 text-white"
                  />
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Move up"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Move down"
                      disabled={index === pills.length - 1}
                      onClick={() => move(index, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      aria-label="Remove pill"
                      className="text-red-400 hover:text-red-300"
                      onClick={() =>
                        setPills((prev) => prev.filter((_, i) => i !== index))
                      }
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={pills.length >= AUTH_PILL_MAX_COUNT}
                onClick={() =>
                  setPills((prev) => [...prev, { label: "", icon: "star" }])
                }
                className="border-cyan-500 text-cyan-400 hover:bg-cyan-500 hover:text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add pill
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={saving || usingDefaults}
                onClick={() => void persist(null)}
                className="border-gray-600 text-gray-300"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Reset to defaults
              </Button>
            </div>

            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-gradient-to-r from-cyan-600 to-sky-600 hover:from-cyan-700 hover:to-sky-700 text-white font-bold h-14 text-lg"
            >
              <Save className="h-5 w-5 mr-2" />
              {saving ? "Saving..." : "Save Feature Pills"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
