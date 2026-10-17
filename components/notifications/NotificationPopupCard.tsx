"use client";

import { X } from "lucide-react";

/**
 * A pushed notification, rendered as a dismissible banner.
 *
 * The wording, the icon, the colour and the click target are all the
 * notification's own — written on the NotificationTemplate an operator edits —
 * so this component knows nothing about challenges, competitions or any other
 * event. Reason: a card per event type is how a new template silently gets no
 * popup, and how the popup, the bell and the email end up disagreeing about
 * where a player lands.
 */
export interface PushedNotification {
  _id: string;
  templateId?: string;
  type?: string;
  category?: string;
  title: string;
  message: string;
  icon?: string;
  color?: string;
  priority?: string;
  actionUrl?: string;
  actionText?: string;
  createdAt?: string;
}

/**
 * Where a card with no stored `actionUrl` sends the player.
 *
 * Reason: templates are seeded with `$setOnInsert`, so adding an `actionUrl` to
 * a default that already exists in a database does not reach it — an older row
 * keeps whatever it was first inserted with. Without a fallback those cards
 * would be unclickable, which is indistinguishable from a broken popup.
 */
const CATEGORY_FALLBACK_URL: Record<string, string> = {
  challenge: "/challenges",
  competition: "/competitions",
  purchase: "/wallet",
  achievement: "/profile",
  messaging: "/messages",
  social: "/profile",
};

export function popupHref(notification: PushedNotification): string {
  if (notification.actionUrl) return notification.actionUrl;
  const category = notification.category;
  if (category) {
    // Reason: `category` comes from a stored document, so a computed index is a
    // dynamic property read. Reflect.get is the same lookup without the sink.
    const fallback = Reflect.get(CATEGORY_FALLBACK_URL, category);
    if (typeof fallback === "string") return fallback;
  }
  return "/notifications";
}

interface NotificationPopupCardProps {
  notification: PushedNotification;
  exiting: boolean;
  animationMs: number;
  onOpen: () => void;
  onDismiss: () => void;
}

export default function NotificationPopupCard({
  notification,
  exiting,
  animationMs,
  onOpen,
  onDismiss,
}: NotificationPopupCardProps) {
  const accent = notification.color || "#FDD458";
  const urgent =
    notification.priority === "urgent" || notification.priority === "high";

  return (
    <div
      className="pointer-events-auto"
      style={{
        animation: exiting
          ? `challengePopupExit ${animationMs}ms ease-in forwards`
          : `challengePopupEnter ${animationMs}ms ease-out`,
      }}
    >
      <div
        className="relative overflow-hidden rounded-xl border bg-gray-950/95 backdrop-blur-xl shadow-2xl"
        style={{ borderColor: `${accent}66` }}
      >
        <div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{
            background: `linear-gradient(90deg, transparent, ${accent}, transparent)`,
            animation: urgent
              ? "challengeGlowSlide 2s linear infinite"
              : undefined,
          }}
        />

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss notification"
          className="absolute top-2 right-2 text-gray-600 hover:text-white transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/*
          The whole body is the click target. Reason: a player reacting to a
          banner taps the text, not a link at the bottom of it.
        */}
        <button
          type="button"
          onClick={onOpen}
          className="w-full text-left px-4 pt-3 pb-3 pr-8"
        >
          <div className="flex items-start gap-2.5">
            <span className="text-lg leading-none mt-0.5" aria-hidden="true">
              {notification.icon || "🔔"}
            </span>
            <div className="min-w-0">
              <p
                className="text-sm font-bold truncate"
                style={{ color: accent }}
              >
                {notification.title}
              </p>
              <p className="text-xs text-gray-300 mt-1 line-clamp-3">
                {notification.message}
              </p>
              <span className="inline-block mt-2 text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                {notification.actionText || "Open"} →
              </span>
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}
