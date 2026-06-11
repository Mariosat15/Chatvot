"use client";

import { useEffect, useMemo, useState } from "react";
import { GraduationCap, PlayCircle, Search, X, Video } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface Tutorial {
  _id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  source: "file" | "youtube";
  youtubeId: string | null;
  embedUrl: string | null;
  mimeType: string;
  sizeBytes: number;
  durationSec: number | null;
  videoUrl: string | null;
  thumbnailUrl: string | null;
  order: number;
}

function categoryLabel(id: string): string {
  switch (id) {
    case "getting-started":
      return "Getting Started";
    case "trading":
      return "Trading";
    case "wallet":
      return "Wallet & Credits";
    case "competitions":
      return "Competitions";
    case "challenges":
      return "1v1 Challenges";
    case "marketplace":
      return "Marketplace";
    case "profile":
      return "Profile & KYC";
    case "other":
      return "Other";
    default:
      return id;
  }
}

const CATEGORY_ORDER = [
  "getting-started",
  "trading",
  "wallet",
  "competitions",
  "challenges",
  "marketplace",
  "profile",
  "other",
] as const;

function formatDuration(sec: number | null | undefined): string {
  if (!sec || sec <= 0) return "";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Tutorials tab — surfaces admin-uploaded tutorial videos in a
 * searchable, category-grouped grid. Clicking a card opens an
 * inline player that streams the video from
 * `/api/tutorials/videos/[filename]` with HTTP Range support.
 */
export default function TutorialsTab() {
  const [items, setItems] = useState<Tutorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [playing, setPlaying] = useState<Tutorial | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch("/api/tutorials", { credentials: "include" });
        const json = await res.json();
        if (!res.ok || !json.success) {
          throw new Error(json.error || "Failed to load tutorials");
        }
        if (!cancelled) setItems(json.items || []);
      } catch (e) {
        if (!cancelled)
          setError(
            e instanceof Error ? e.message : "Failed to load tutorials",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (t) =>
        t.title.toLowerCase().includes(q) ||
        t.description.toLowerCase().includes(q) ||
        categoryLabel(t.category).toLowerCase().includes(q),
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const map = new Map<string, Tutorial[]>();
    for (const t of filtered) {
      const arr = map.get(t.category) || [];
      arr.push(t);
      map.set(t.category, arr);
    }
    return CATEGORY_ORDER.map((id) => ({
      id,
      label: categoryLabel(id),
      items: map.get(id) || [],
    })).filter((g) => g.items.length > 0);
  }, [filtered]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Video className="h-5 w-5 mr-2 animate-pulse" />
        Loading tutorials…
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-red-300 text-sm">
        {error}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-gray-700/50 bg-gray-800/40 p-10 text-center">
        <GraduationCap className="h-10 w-10 mx-auto mb-3 text-gray-500" />
        <h3 className="text-lg font-semibold text-white mb-1">
          No tutorials available yet
        </h3>
        <p className="text-sm text-gray-400 max-w-md mx-auto">
          Tutorial videos will appear here as soon as the platform team
          publishes them. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header + search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <GraduationCap className="h-5 w-5 text-rose-400" />
            Tutorial Library
          </h2>
          <p className="text-sm text-gray-400">
            Step-by-step videos to help you get the most out of the platform.
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search tutorials…"
            className="pl-9"
          />
        </div>
      </div>

      {/* Sections */}
      {grouped.length === 0 ? (
        <p className="text-sm text-gray-400">
          No tutorials match your search.
        </p>
      ) : (
        grouped.map((g) => (
          <div key={g.id}>
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
              {g.label}{" "}
              <span className="text-gray-500 font-normal">
                ({g.items.length})
              </span>
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((t) => (
                <button
                  key={t._id}
                  onClick={() => setPlaying(t)}
                  className="group text-left rounded-xl overflow-hidden border border-gray-700/50 bg-gray-800/40 hover:border-rose-500/50 hover:bg-gray-800/70 transition-all"
                >
                  <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                    {t.thumbnailUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- intentional <img> for stream-served thumbnails (auth + Range) outside Next.js image loader.
                      <img
                        src={t.thumbnailUrl}
                        alt={t.title}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    ) : (
                      <Video className="h-10 w-10 text-gray-600" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity">
                      <PlayCircle className="h-14 w-14 text-white drop-shadow-lg" />
                    </div>
                    {t.durationSec ? (
                      <Badge className="absolute bottom-2 right-2 bg-black/70 text-white border-0">
                        {formatDuration(t.durationSec)}
                      </Badge>
                    ) : null}
                  </div>
                  <div className="p-3">
                    <h4 className="font-semibold text-white text-sm line-clamp-1">
                      {t.title}
                    </h4>
                    {t.description && (
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                        {t.description}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))
      )}

      {/* Player modal */}
      {playing && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setPlaying(null)}
        >
          <div
            className="relative w-full max-w-4xl bg-gray-900 rounded-xl overflow-hidden border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setPlaying(null)}
              className="absolute top-3 right-3 z-10 h-9 w-9 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center"
              aria-label="Close player"
            >
              <X className="h-5 w-5" />
            </button>
            {playing.embedUrl ? (
              <div className="relative w-full aspect-video bg-black">
                <iframe
                  key={playing._id}
                  src={`${playing.embedUrl}?autoplay=1&rel=0&modestbranding=1`}
                  title={playing.title}
                  className="absolute inset-0 h-full w-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>
            ) : playing.videoUrl ? (
              <video
                key={playing._id}
                src={playing.videoUrl}
                poster={playing.thumbnailUrl || undefined}
                controls
                autoPlay
                playsInline
                className="w-full bg-black"
              />
            ) : (
              <div className="w-full aspect-video bg-black flex items-center justify-center text-gray-400 text-sm">
                This tutorial is unavailable.
              </div>
            )}
            <div className="p-4">
              <h3 className="text-white font-semibold">{playing.title}</h3>
              {playing.description && (
                <p className="text-sm text-gray-400 mt-1">
                  {playing.description}
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
