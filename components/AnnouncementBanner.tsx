"use client";

import { useState, useEffect, useCallback } from "react";
import {
  X,
  AlertTriangle,
  Info,
  Wrench,
  Zap,
  Gift,
  AlertCircle,
  Clock,
} from "lucide-react";

interface Announcement {
  _id: string;
  title: string;
  message: string;
  type: "maintenance" | "info" | "warning" | "critical" | "update" | "promotion";
  dismissible: boolean;
  showCountdown: boolean;
  scheduledEnd?: string;
}

const TYPE_CONFIG: Record<
  string,
  { bg: string; border: string; text: string; icon: typeof Info }
> = {
  critical: {
    bg: "bg-red-500/15",
    border: "border-red-500/40",
    text: "text-red-300",
    icon: AlertCircle,
  },
  warning: {
    bg: "bg-yellow-500/15",
    border: "border-yellow-500/40",
    text: "text-yellow-300",
    icon: AlertTriangle,
  },
  maintenance: {
    bg: "bg-orange-500/15",
    border: "border-orange-500/40",
    text: "text-orange-300",
    icon: Wrench,
  },
  info: {
    bg: "bg-blue-500/15",
    border: "border-blue-500/40",
    text: "text-blue-300",
    icon: Info,
  },
  update: {
    bg: "bg-green-500/15",
    border: "border-green-500/40",
    text: "text-green-300",
    icon: Zap,
  },
  promotion: {
    bg: "bg-purple-500/15",
    border: "border-purple-500/40",
    text: "text-purple-300",
    icon: Gift,
  },
};

function Countdown({ endDate }: { endDate: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    const update = () => {
      const diff = new Date(endDate).getTime() - Date.now();
      if (diff <= 0) {
        setRemaining("Ending soon");
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(h > 0 ? `${h}h ${m}m remaining` : `${m}m ${s}s remaining`);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  return (
    <span className="flex items-center gap-1 text-xs opacity-75">
      <Clock className="h-3 w-3" /> {remaining}
    </span>
  );
}

const POLL_INTERVAL = 60_000;
const DISMISS_KEY = "dismissed-announcements";

function getDismissed(): Set<string> {
  try {
    const raw = sessionStorage.getItem(DISMISS_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function setDismissed(ids: Set<string>) {
  try {
    sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...ids]));
  } catch {
    // sessionStorage may be unavailable
  }
}

export default function AnnouncementBanner() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [dismissed, setDismissedState] = useState<Set<string>>(new Set());

  const fetchAnnouncements = useCallback(async () => {
    try {
      const res = await fetch("/api/announcements/active");
      if (!res.ok) return;
      const data = await res.json();
      if (data.success && Array.isArray(data.announcements)) {
        setAnnouncements(data.announcements);
      }
    } catch {
      // Silent fail — banner is non-critical
    }
  }, []);

  useEffect(() => {
    setDismissedState(getDismissed());
    fetchAnnouncements();
    const id = setInterval(fetchAnnouncements, POLL_INTERVAL);
    return () => clearInterval(id);
  }, [fetchAnnouncements]);

  const dismiss = useCallback(
    (announcementId: string) => {
      const next = new Set(dismissed);
      next.add(announcementId);
      setDismissedState(next);
      setDismissed(next);
    },
    [dismissed],
  );

  const visible = announcements.filter((a) => !dismissed.has(a._id));
  if (visible.length === 0) return null;

  return (
    <div className="space-y-2 mb-3">
      {visible.map((a) => {
        const cfg = TYPE_CONFIG[a.type] || TYPE_CONFIG.info;
        const Icon = cfg.icon;

        return (
          <div
            key={a._id}
            className={`relative flex items-start gap-3 rounded-lg border px-4 py-3 ${cfg.bg} ${cfg.border} ${cfg.text}`}
          >
            <Icon className="h-5 w-5 mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-sm">{a.title}</span>
                {a.showCountdown && a.scheduledEnd && (
                  <Countdown endDate={a.scheduledEnd} />
                )}
              </div>
              <p className="text-sm opacity-85 mt-0.5">{a.message}</p>
            </div>
            {a.dismissible && (
              <button
                onClick={() => dismiss(a._id)}
                className="shrink-0 p-1 rounded hover:bg-white/10 transition-colors"
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
