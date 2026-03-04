"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Search,
  Loader2,
  X,
  Check,
  Image as ImageIconLucide,
  Camera,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

// ─── Types ───────────────────────────────────────────────────────────────────

interface PexelsPhoto {
  id: number;
  width: number;
  height: number;
  photographer: string;
  photographer_url: string;
  avg_color: string;
  src: {
    original: string;
    large2x: string;
    large: string;
    medium: string;
    small: string;
    portrait: string;
    landscape: string;
    tiny: string;
  };
  alt: string;
}

interface Props {
  /** Current image URL (shown as selected) */
  currentUrl?: string;
  /** Called when user picks an image — receives the image URL */
  onSelect: (url: string) => void;
  /** Called to close the browser */
  onClose: () => void;
  /** Default search query */
  defaultQuery?: string;
  /** Orientation filter */
  orientation?: "landscape" | "portrait" | "square";
}

// ─── Quick Search Suggestions ────────────────────────────────────────────────

const QUICK_SEARCHES = [
  "trading finance",
  "stock market charts",
  "forex trading",
  "cryptocurrency bitcoin",
  "business success",
  "trophy winner",
  "competition podium",
  "technology dashboard",
  "money growth",
  "team celebration",
  "luxury lifestyle",
  "city skyline night",
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function PexelsImageBrowser({
  currentUrl,
  onSelect,
  onClose,
  defaultQuery = "trading finance",
  orientation = "landscape",
}: Props) {
  const [query, setQuery] = useState(defaultQuery);
  const [photos, setPhotos] = useState<PexelsPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const perPage = 15;

  // Auto-search on mount
  useEffect(() => {
    if (defaultQuery) {
      searchImages(defaultQuery, 1);
    }
    // Focus the search input
    setTimeout(() => inputRef.current?.focus(), 100);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const searchImages = useCallback(
    async (searchQuery: string, pageNum: number) => {
      if (!searchQuery.trim()) return;

      setLoading(true);
      setHasSearched(true);
      setErrorMsg(null);
      try {
        const params = new URLSearchParams({
          query: searchQuery.trim(),
          page: String(pageNum),
          per_page: String(perPage),
        });
        // Reason: orientation param helps get better-fitting images
        if (orientation) {
          params.set("orientation", orientation);
        }

        const res = await fetch(`/api/pexels?${params}`);

        if (!res.ok) {
          const data = await res.json().catch(() => null);
          const errText = data?.error || `Pexels API error (${res.status})`;
          setErrorMsg(errText);
          setPhotos([]);
          return;
        }

        const data = await res.json();
        setPhotos(data.photos || []);
        setTotalResults(data.total_results || 0);
        setPage(pageNum);
        setSelectedId(null);
      } catch (err) {
        console.error("Pexels search error:", err);
        setErrorMsg("Network error — could not reach Pexels API.");
        setPhotos([]);
      } finally {
        setLoading(false);
      }
    },
    [orientation],
  );

  function handleSearch() {
    searchImages(query, 1);
  }

  function handleQuickSearch(term: string) {
    setQuery(term);
    searchImages(term, 1);
  }

  function handleSelect(photo: PexelsPhoto) {
    setSelectedId(photo.id);
    onSelect(photo.src.large);
  }

  const totalPages = Math.ceil(totalResults / perPage);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-500/20 rounded-lg">
              <Camera className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pexels Image Browser</h2>
              <p className="text-xs text-gray-500">
                Search millions of free stock photos · Powered by Pexels
              </p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Search Bar */}
        <div className="px-6 py-4 border-b border-gray-800 space-y-3">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
              <Input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleSearch();
                }}
                placeholder="Search for images..."
                className="pl-10 bg-gray-800 border-gray-700 h-10"
              />
            </div>
            <Button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="bg-cyan-600 hover:bg-cyan-500 text-white h-10 px-6"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Search"
              )}
            </Button>
          </div>

          {/* Quick search tags */}
          <div className="flex gap-1.5 flex-wrap">
            {QUICK_SEARCHES.map((term) => (
              <button
                key={term}
                onClick={() => handleQuickSearch(term)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors ${
                  query === term
                    ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
                    : "bg-gray-800 text-gray-500 border-gray-700 hover:text-gray-300 hover:border-gray-600"
                }`}
              >
                {term}
              </button>
            ))}
          </div>
        </div>

        {/* Image Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading && photos.length === 0 ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-cyan-500" />
            </div>
          ) : photos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-500">
              <ImageIconLucide className="h-16 w-16 mb-4 opacity-30" />
              {errorMsg ? (
                <div className="text-center max-w-md space-y-2">
                  <p className="text-red-400 text-sm font-medium">⚠️ {errorMsg}</p>
                  {errorMsg.includes("API key") && (
                    <p className="text-xs text-gray-600">
                      Go to <span className="text-cyan-400">Settings → Environment → Pexels</span> to
                      configure your API key.
                    </p>
                  )}
                </div>
              ) : hasSearched ? (
                <p>No images found. Try a different search term.</p>
              ) : (
                <p>Search for images to get started</p>
              )}
            </div>
          ) : (
            <>
              {totalResults > 0 && (
                <p className="text-xs text-gray-500 mb-3">
                  {totalResults.toLocaleString()} results for &ldquo;{query}&rdquo;
                </p>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {photos.map((photo) => {
                  const isSelected = selectedId === photo.id;
                  const isCurrent = currentUrl === photo.src.large;

                  return (
                    <button
                      key={photo.id}
                      onClick={() => handleSelect(photo)}
                      className={`group relative rounded-lg overflow-hidden border-2 transition-all aspect-[4/3] ${
                        isSelected
                          ? "border-cyan-500 ring-2 ring-cyan-500/30"
                          : isCurrent
                            ? "border-emerald-500 ring-2 ring-emerald-500/30"
                            : "border-transparent hover:border-gray-600"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.src.medium}
                        alt={photo.alt || "Stock photo"}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />

                      {/* Hover overlay */}
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end">
                        <div className="w-full p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                          <p className="text-[10px] text-white truncate">
                            📷 {photo.photographer}
                          </p>
                          <p className="text-[9px] text-gray-400">
                            {photo.width}×{photo.height}
                          </p>
                        </div>
                      </div>

                      {/* Selected / Current indicator */}
                      {isSelected && (
                        <div className="absolute top-2 right-2 p-1 bg-cyan-500 rounded-full">
                          <Check className="h-3 w-3 text-white" />
                        </div>
                      )}
                      {isCurrent && !isSelected && (
                        <Badge className="absolute top-2 right-2 bg-emerald-500/90 text-white text-[9px]">
                          Current
                        </Badge>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer — Pagination + Actions */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800 bg-gray-900/50">
          <div className="flex items-center gap-2">
            {totalPages > 1 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => searchImages(query, page - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs text-gray-500">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages || loading}
                  onClick={() => searchImages(query, page + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[10px] text-gray-600">
              Photos by{" "}
              <a
                href="https://www.pexels.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-cyan-500 hover:underline"
              >
                Pexels
              </a>
            </span>
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={onClose}
              disabled={!selectedId}
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
            >
              <Check className="h-4 w-4 mr-1" />
              Use Selected Image
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
