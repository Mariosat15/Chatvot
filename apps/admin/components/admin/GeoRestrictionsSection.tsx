"use client";

/**
 * Country restrictions (legal opinion s9 item 7): the markets where sign-up and paid
 * entry are refused. Enforced by the main app on two facts - the country the request
 * arrives from (Cloudflare's `cf-ipcountry`) and the country the player declared - and
 * either one being restricted refuses. Restricted countries are also removed from the
 * sign-up form's country list, but that is a convenience: the server refuses regardless.
 */

import { useEffect, useMemo, useState } from "react";
import countryList from "react-select-country-list";
import { Globe, Loader2, Save, Search, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useTerms } from "@/contexts/TerminologyContext";

interface GeoSettings {
  enabled: boolean;
  restrictedCountries: string[];
  blockRegistration: boolean;
  blockPaidEntry: boolean;
  blockUnknownNetworkCountry: boolean;
  updatedAt: string | null;
}

const EMPTY: GeoSettings = {
  enabled: false,
  restrictedCountries: [],
  blockRegistration: true,
  blockPaidEntry: true,
  blockUnknownNetworkCountry: false,
  updatedAt: null,
};

export default function GeoRestrictionsSection() {
  const terms = useTerms();
  const countries = useMemo(() => countryList().getData(), []);
  const nameOf = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of countries) map.set(c.value, c.label);
    return map;
  }, [countries]);

  const [settings, setSettings] = useState<GeoSettings>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/geo-restrictions", { cache: "no-store" });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load");
        if (alive) setSettings(data.settings);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Something went wrong. Please contact support.");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const restricted = useMemo(() => new Set(settings.restrictedCountries), [settings.restrictedCountries]);
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return countries
      .filter((c) => !restricted.has(c.value))
      .filter((c) => c.label.toLowerCase().includes(q) || c.value.toLowerCase() === q)
      .slice(0, 8);
  }, [countries, query, restricted]);

  const toggleCountry = (code: string) => {
    setSettings((s) => {
      const next = new Set(s.restrictedCountries);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return { ...s, restrictedCountries: [...next].sort() };
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      const { updatedAt: _ignored, ...body } = settings;
      const res = await fetch("/api/geo-restrictions", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");
      setSettings(data.settings);
      toast.success("Country restrictions saved. They take effect within 30 seconds.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Something went wrong. Please contact support.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading country restrictions...
      </div>
    );
  }

  const toggles: { key: keyof GeoSettings; label: string; hint: string; disabled?: boolean }[] = [
    {
      key: "blockRegistration",
      label: "Block sign-up",
      hint: "New accounts cannot be created from, or declaring, a restricted country. Restricted countries are removed from the sign-up country list.",
    },
    {
      key: "blockPaidEntry",
      label: `Block paid entry`,
      hint: `Paid ${terms.contests} and ${terms.challenges} refuse entry from a restricted country. Existing accounts keep logging in and can still withdraw.`,
    },
    {
      key: "blockUnknownNetworkCountry",
      label: "Refuse when the network country is unknown",
      hint: "Refuse when the request carries no country (no Cloudflare header, or Tor). Leave off unless the site is served through Cloudflare, or every request is refused.",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-white">
            <Globe className="h-6 w-6 text-orange-400" /> Country Restrictions
          </h2>
          <p className="mt-1 max-w-3xl text-sm text-gray-400">
            Offer paid play only in reviewed markets. A request is refused when either the
            country it comes from (by IP) or the country the {terms.player.toLowerCase()} declared is restricted.
          </p>
        </div>
        <Button onClick={save} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Save
        </Button>
      </div>

      <div className="rounded-lg border border-gray-700 bg-gray-800/50 p-5">
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="block font-semibold text-white">Restrictions enabled</span>
            <span className="block text-sm text-gray-400">
              Off means nothing is refused, whatever the list says.
            </span>
          </span>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => setSettings((s) => ({ ...s, enabled: v }))}
          />
        </label>
      </div>

      <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/50 p-5">
        {toggles.map((t) => (
          <label key={t.key} className="flex items-center justify-between gap-4">
            <span>
              <span className="block font-medium text-white">{t.label}</span>
              <span className="block text-sm text-gray-400">{t.hint}</span>
            </span>
            <Switch
              checked={settings[t.key] === true}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, [t.key]: v }))}
            />
          </label>
        ))}
      </div>

      <div className="space-y-4 rounded-lg border border-gray-700 bg-gray-800/50 p-5">
        <div>
          <h3 className="font-semibold text-white">
            Restricted countries ({settings.restrictedCountries.length})
          </h3>
          <p className="text-sm text-gray-400">Search by name or two-letter code.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Add a country..."
            className="pl-9"
          />
          {matches.length > 0 && (
            <ul className="absolute z-10 mt-1 w-full rounded-md border border-gray-700 bg-gray-900 shadow-lg">
              {matches.map((c) => (
                <li key={c.value}>
                  <button
                    type="button"
                    onClick={() => {
                      toggleCountry(c.value);
                      setQuery("");
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-gray-200 hover:bg-gray-800"
                  >
                    {c.label}
                    <span className="text-xs text-gray-500">{c.value}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        {settings.restrictedCountries.length === 0 ? (
          <p className="text-sm text-gray-500">No countries restricted.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {settings.restrictedCountries.map((code) => (
              <span
                key={code}
                className="inline-flex items-center gap-1 rounded-full border border-orange-500/40 bg-orange-500/10 px-3 py-1 text-sm text-orange-200"
              >
                {nameOf.get(code) ?? code} <span className="text-xs text-orange-400/70">{code}</span>
                <button
                  type="button"
                  aria-label={`Remove ${nameOf.get(code) ?? code}`}
                  onClick={() => toggleCountry(code)}
                  className="ml-1 rounded-full p-0.5 hover:bg-orange-500/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
