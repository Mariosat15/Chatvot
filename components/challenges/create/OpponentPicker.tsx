"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Search, UserRound, Users, X } from "lucide-react";

export interface ChallengeOpponent {
  userId: string;
  username: string;
  avatar?: string;
}

interface OpponentPickerProps {
  value: ChallengeOpponent | null;
  onSelect: (opponent: ChallengeOpponent | null) => void;
  disabled: boolean;
  /*
    Reason: "anyone" is a SEPARATE flag rather than a sentinel `ChallengeOpponent` with an
    empty id, matching `Challenge.openToAnyone`. A sentinel would be indistinguishable
    from a directed challenge whose opponent id went missing, which is the one failure a
    capability gate must not have.
  */
  openToAnyone: boolean;
  onOpenToAnyoneChange: (open: boolean) => void;
}

const MIN_QUERY_LENGTH = 2;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Who the challenge is for: a friend, or anybody found by name.
 *
 * FRIENDS FIRST, THEN A SEARCH BOX (owner decision, 14 September 2026). The friends list is
 * fetched once when the picker mounts; the search only runs once two characters are typed,
 * because the underlying endpoint refuses a shorter query and a one-character search over every
 * registered player is a scan nobody asked for.
 *
 * THE SEARCH IS THE MESSAGING ONE and is reused rather than reimplemented. It returns only id,
 * name and avatar, and it already filters both directions of the block list - so this screen
 * cannot show somebody who has blocked the player, and cannot leak an address or a country
 * while doing it. One consequence is inherited rather than chosen: that endpoint matches on
 * email as well as name and falls back to the email when a player has no name, so a player
 * searching an address they already know can confirm it is registered. That is unchanged from
 * the friend search every signed-in player already reaches, and narrowing it here would change
 * the behaviour of a screen nobody asked to touch.
 *
 * WILLINGNESS IS NOT FILTERED HERE. Whether a player accepts challenges at all is decided by
 * the create route against their stored presence, so a refusal names the reason rather than a
 * name quietly going missing from a list - and a list that hides people is indistinguishable,
 * from the searcher's seat, from the person not existing.
 */
export default function OpponentPicker({
  value,
  onSelect,
  disabled,
  openToAnyone,
  onOpenToAnyoneChange,
}: OpponentPickerProps) {
  const [friends, setFriends] = useState<ChallengeOpponent[]>([]);
  const [friendsLoading, setFriendsLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ChallengeOpponent[]>([]);
  const [searching, setSearching] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await fetch("/api/challenges/opponents");
        if (res.ok) {
          const data = await res.json();
          if (mounted) setFriends(data.opponents || []);
        }
      } catch (error) {
        console.error("Failed to load friends:", error);
      } finally {
        if (mounted) setFriendsLoading(false);
      }
    };
    load();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < MIN_QUERY_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    /*
      Reason: every response carries the id of the request that asked for it, and a late one is
      discarded. Without it a slow "ab" landing after a fast "abcd" replaces the narrower
      results with the broader ones - the list appears to ignore what was typed, which reads as
      a broken search rather than as a race.
    */
    const id = ++requestId.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/messaging/search/users?q=${encodeURIComponent(trimmed)}&limit=12`,
        );
        if (!res.ok) throw new Error("search failed");
        const data = await res.json();
        if (id !== requestId.current) return;
        setResults(
          (data.users || []).map(
            (user: { id: string; name: string; avatar?: string }) => ({
              userId: user.id,
              username: user.name,
              avatar: user.avatar,
            }),
          ),
        );
      } catch (error) {
        console.error("Failed to search players:", error);
        if (id === requestId.current) setResults([]);
      } finally {
        if (id === requestId.current) setSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [query]);

  if (openToAnyone) {
    return (
      <div className="space-y-1.5">
        <Label className="text-gray-300 flex items-center gap-2 text-sm">
          <UserRound className="h-3.5 w-3.5 text-orange-400" />
          Opponent
        </Label>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-green-500/30 bg-green-500/5 px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500">
              <Users className="h-3.5 w-3.5 text-white" />
            </span>
            <span className="truncate text-sm font-semibold text-white">
              Open to anyone
            </span>
          </div>
          <button
            type="button"
            onClick={() => onOpenToAnyoneChange(false)}
            disabled={disabled}
            className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
            aria-label="Choose a specific opponent instead"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-[11px] text-gray-500">
          The first player to take the seat becomes your opponent.
        </p>
      </div>
    );
  }

  if (value) {
    return (
      <div className="space-y-1.5">
        <Label className="text-gray-300 flex items-center gap-2 text-sm">
          <UserRound className="h-3.5 w-3.5 text-orange-400" />
          Opponent
        </Label>
        <div className="flex items-center justify-between gap-3 rounded-xl border border-orange-500/30 bg-orange-500/5 px-3 py-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar opponent={value} />
            <span className="truncate text-sm font-semibold text-white">
              {value.username}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onSelect(null)}
            disabled={disabled}
            className="shrink-0 rounded-lg p-1 text-gray-400 transition-colors hover:bg-gray-800 hover:text-white disabled:opacity-50"
            aria-label="Choose a different opponent"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  const showing = query.trim().length >= MIN_QUERY_LENGTH ? results : friends;
  const loading =
    query.trim().length >= MIN_QUERY_LENGTH ? searching : friendsLoading;

  return (
    <div className="space-y-2">
      <Label className="text-gray-300 flex items-center gap-2 text-sm">
        <UserRound className="h-3.5 w-3.5 text-orange-400" />
        Choose your opponent
      </Label>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-500" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          placeholder="Search any player by name"
          className="h-9 border-gray-700 bg-gray-800/60 pl-9 text-white"
        />
      </div>

      {query.trim().length === 0 && (
        <p className="flex items-center gap-1.5 text-[11px] text-gray-500">
          <Users className="h-3 w-3" />
          {friendsLoading
            ? "Loading your friends…"
            : friends.length > 0
              ? "Your friends, or search for anyone else"
              : "You have no friends yet — search for a player by name"}
        </p>
      )}

      {/*
        Offered above the list and only while nothing has been typed: once a player is
        searching for somebody they have named a person, and an "anyone" row that stays put
        under a search is a click away from sending the opposite of what they asked for.
      */}
      {query.trim().length === 0 && (
        <button
          type="button"
          onClick={() => onOpenToAnyoneChange(true)}
          disabled={disabled}
          className="flex w-full items-center gap-2.5 rounded-xl border border-green-500/30 bg-green-500/5 px-3 py-2 text-left transition-colors hover:border-green-500/60 hover:bg-green-500/10 disabled:opacity-50"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-500">
            <Users className="h-3.5 w-3.5 text-white" />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-white">
              Anyone
            </span>
            <span className="block truncate text-[11px] text-gray-400">
              Leave the seat open for the first player to take it
            </span>
          </span>
        </button>
      )}

      <div className="max-h-44 space-y-1 overflow-y-auto pr-0.5">
        {loading && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-gray-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Searching…
          </div>
        )}

        {!loading && showing.length === 0 && query.trim().length > 0 && (
          <p className="px-3 py-3 text-xs text-gray-500">
            {query.trim().length < MIN_QUERY_LENGTH
              ? `Type at least ${MIN_QUERY_LENGTH} characters to search`
              : "No players found"}
          </p>
        )}

        {!loading &&
          showing.map((opponent) => (
            <button
              key={opponent.userId}
              type="button"
              onClick={() => onSelect(opponent)}
              disabled={disabled}
              className="flex w-full items-center gap-2.5 rounded-xl border border-gray-800 bg-gray-900/40 px-3 py-2 text-left transition-colors hover:border-orange-500/40 hover:bg-orange-500/5 disabled:opacity-50"
            >
              <Avatar opponent={opponent} />
              <span className="truncate text-sm text-gray-200">
                {opponent.username}
              </span>
            </button>
          ))}
      </div>
    </div>
  );
}

function Avatar({ opponent }: { opponent: ChallengeOpponent }) {
  if (opponent.avatar) {
    /*
      Reason: a plain `<img>` rather than `next/image`. An avatar URL is whatever host a
      player set on their own profile, and the optimiser needs every one of those hosts
      allow-listed in `next.config.ts` - an unlisted host does not degrade, it throws. The
      friends list and the messaging screens already render avatars this way.
    */
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={opponent.avatar}
        alt=""
        className="h-7 w-7 shrink-0 rounded-full object-cover"
      />
    );
  }
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-orange-500 to-red-500 text-[11px] font-bold text-white">
      {opponent.username?.charAt(0).toUpperCase() || "?"}
    </span>
  );
}
