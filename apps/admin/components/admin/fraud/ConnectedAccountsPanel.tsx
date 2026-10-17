"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users,
  ExternalLink,
  Mail,
  Calendar,
  User,
  Loader2,
  AlertTriangle,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

interface ResolvedUser {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  image?: string;
  isDeactivated?: boolean;
}

interface ConnectedAccountsPanelProps {
  accountIds: string[];
  /** Label for the section header. Defaults to "Connected Accounts". */
  title?: string;
  /** Callback to navigate to a user's detail panel in the admin. */
  onNavigateToUser?: (userId: string) => void;
}

/**
 * Reusable component for displaying connected fraud accounts
 * with resolved user details (name, email) and navigation links.
 *
 * Reason: Replaces plain `<code>` blocks that only showed raw ObjectIds,
 * making it easy for admins to identify and navigate to flagged accounts.
 */
export default function ConnectedAccountsPanel({
  accountIds,
  title = "Connected Accounts",
  onNavigateToUser,
}: ConnectedAccountsPanelProps) {
  const [usersMap, setUsersMap] = useState(new Map<string, ResolvedUser>());
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const resolveUsers = useCallback(async () => {
    if (!accountIds || accountIds.length === 0) return;

    setLoading(true);
    try {
      const response = await fetch("/api/fraud/resolve-users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userIds: accountIds }),
      });

      if (!response.ok) {
        console.error("Failed to resolve users:", response.status);
        return;
      }

      const data = await response.json();
      if (data.success && data.users) {
        setUsersMap(new Map(Object.entries(data.users as Record<string, ResolvedUser>)));
      }
    } catch (error) {
      console.error("Error resolving users:", error);
    } finally {
      setLoading(false);
    }
  }, [accountIds]);

  useEffect(() => {
    resolveUsers();
  }, [resolveUsers]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleNavigateToUser = (userId: string) => {
    if (onNavigateToUser) {
      onNavigateToUser(userId);
    } else {
      // Fallback: try to click the users tab with userId as search
      const adminTab = document.querySelector(
        '[data-value="users"]',
      ) as HTMLElement;
      if (adminTab) {
        adminTab.click();
        // Brief delay then try to set search field
        setTimeout(() => {
          const searchInput = document.querySelector(
            'input[placeholder*="Search"]',
          ) as HTMLInputElement;
          if (searchInput) {
            const resolved = usersMap.get(userId);
            searchInput.value = resolved?.email || userId;
            searchInput.dispatchEvent(new Event("input", { bubbles: true }));
            searchInput.dispatchEvent(new Event("change", { bubbles: true }));
          }
        }, 300);
      }
    }
  };

  if (!accountIds || accountIds.length === 0) return null;

  return (
    <div className="p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-yellow-400" />
          <span className="text-sm font-semibold text-yellow-400">
            {title} ({accountIds.length})
          </span>
        </div>
        {loading && (
          <Loader2 className="h-3 w-3 text-yellow-400 animate-spin" />
        )}
      </div>

      <div className="space-y-2">
        {accountIds.map((accountId, idx) => {
          const resolved = usersMap.get(accountId);
          const isResolved = !!resolved;

          return (
            <div
              key={accountId}
              className="flex items-center justify-between p-2.5 bg-gray-900/80 rounded-lg border border-gray-700/50 hover:border-yellow-500/30 transition-colors group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {/* Index badge */}
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-yellow-500/20 flex items-center justify-center">
                  <span className="text-[10px] font-bold text-yellow-400">
                    {idx + 1}
                  </span>
                </div>

                {/* User details */}
                <div className="min-w-0 flex-1">
                  {isResolved ? (
                    <>
                      <div className="flex items-center gap-2">
                        <User className="h-3 w-3 text-gray-400 flex-shrink-0" />
                        <span className="text-sm font-medium text-gray-200 truncate">
                          {resolved.name}
                        </span>
                        {resolved.isDeactivated && (
                          <Badge className="bg-red-700/80 text-white text-[9px] px-1">
                            DEACTIVATED
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Mail className="h-3 w-3 text-gray-500 flex-shrink-0" />
                        <span className="text-xs text-gray-400 truncate">
                          {resolved.email}
                        </span>
                      </div>
                      {resolved.createdAt && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <Calendar className="h-3 w-3 text-gray-500 flex-shrink-0" />
                          <span className="text-[10px] text-gray-500">
                            Joined{" "}
                            {new Date(resolved.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-3 w-3 text-gray-500 flex-shrink-0" />
                      <code className="font-mono text-xs text-yellow-300/70 truncate">
                        {accountId}
                      </code>
                      {loading && (
                        <Badge className="bg-gray-700 text-gray-400 text-[9px] px-1">
                          Loading...
                        </Badge>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-gray-400 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => copyToClipboard(accountId)}
                  title="Copy user ID"
                >
                  {copiedId === accountId ? (
                    <Check className="h-3 w-3 text-green-400" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs text-blue-400 hover:text-blue-300"
                  onClick={() => handleNavigateToUser(accountId)}
                  title="View user profile"
                >
                  <ExternalLink className="h-3 w-3 mr-1" />
                  View
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
