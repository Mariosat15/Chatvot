"use client";

import { useEffect } from "react";
import { useAppSettings } from "@/contexts/AppSettingsContext";

const OWN_LINK_ATTR = "data-dynamic-favicon";

function iconType(href: string): string | undefined {
  const path = href.split("?")[0].toLowerCase();
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  return undefined;
}

/**
 * Client follow-up after a Brand Icon upload without a full reload.
 * Reason: Google/Bing read the server `icons` from generateMetadata in
 * app/layout.tsx — this component alone is not enough for search results.
 *
 * Reason (15 Oct 2026): it must NEVER remove the `<link rel="icon">` tags
 * Next.js renders from `generateMetadata` — React owns those nodes, and
 * deleting them makes the next client navigation crash while committing the
 * new head, so every link and menu item needed a second press. It only
 * updates one link of its own, appended last so browsers prefer it.
 */
export default function DynamicFavicon() {
  const { settings, loading } = useAppSettings();

  useEffect(() => {
    const favicon = settings?.branding?.favicon;
    if (loading || !favicon) return;

    let link = document.head.querySelector<HTMLLinkElement>(
      `link[${OWN_LINK_ATTR}]`,
    );
    if (!link) {
      link = document.createElement("link");
      link.setAttribute(OWN_LINK_ATTR, "");
      link.rel = "icon";
      document.head.appendChild(link);
    }
    if (link.getAttribute("href") !== favicon) link.href = favicon;
    const type = iconType(favicon);
    if (type) link.type = type;
    else link.removeAttribute("type");
  }, [settings, loading]);

  return null;
}
