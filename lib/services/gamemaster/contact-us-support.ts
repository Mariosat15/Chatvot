/**
 * Support-chat handoff for "Contact us" Game Master packages.
 *
 * A contact-us package cannot be bought from the marketplace (see `contact-us-package.ts`):
 * only an employee can enable it for one player. So when a player asks the AI assistant
 * about such a package, the AI must not try to answer - it tells the player they are being
 * transferred to a person and hands the chat to their assigned support employee, or to any
 * available employee when nobody is assigned.
 *
 * Both AI paths (`/api/messaging/support` and the conversation messages route) call
 * `detectContactUsPackageRequest`, so the two cannot disagree about which messages hand off.
 */

import { connectToDatabase } from "@/database/mongoose";
import { MarketplaceItem } from "@/database/models/marketplace/marketplace-item.model";
import { mustContactUsToBuy, type ContactUsPackageFacts } from "./contact-us-package";

export const GM_CONTACT_US_ESCALATION_REASON = "Game Master contact-us package request";

const GM_PACKAGE_PHRASES = [
  "game master package",
  "game master pack",
  "gamemaster package",
  "gamemaster pack",
  "gm package",
  "gm pack",
];

function normalise(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Pure matcher. Returns the matched package name, `""` for a generic contact-us request
 * that names no package, or `null` when the message is not about a contact-us package.
 */
export function matchContactUsPackage(
  message: string,
  contactUsPackageNames: readonly string[],
): string | null {
  const text = normalise(message);
  if (!text || contactUsPackageNames.length === 0) return null;

  // Reason: prefer the longest name so "Pro Plus" wins over "Pro" when both exist.
  const byLength = [...contactUsPackageNames]
    .filter((n) => normalise(n).length >= 3)
    .sort((a, b) => b.length - a.length);
  const named = byLength.find((n) => text.includes(normalise(n)));
  if (named) return named;

  const mentionsGmPackage = GM_PACKAGE_PHRASES.some((p) => text.includes(p));
  if (mentionsGmPackage && text.includes("contact")) return "";
  return null;
}

/**
 * Loads the contact-us packages this player cannot buy yet and matches the message
 * against them. Fails closed to `null` (no handoff) if the lookup errors, so a database
 * problem leaves the ordinary AI flow untouched.
 */
export async function detectContactUsPackageRequest(
  message: string,
  userId: string,
): Promise<{ packageName: string } | null> {
  try {
    await connectToDatabase();
    const items = await MarketplaceItem.find({
      category: "gamemaster",
      "gameMasterConfig.contactUsOnly": true,
    })
      .select("name category gameMasterConfig +contactUsUnlockedUserIds")
      .lean<(ContactUsPackageFacts & { name?: string })[]>();

    const names = items
      .filter((item) => mustContactUsToBuy(item, userId))
      .map((item) => item.name)
      .filter((n): n is string => typeof n === "string" && n.length > 0);

    const match = matchContactUsPackage(message, names);
    return match === null ? null : { packageName: match };
  } catch (error) {
    console.warn("⚠️ [GM contact-us] Package lookup failed, skipping handoff:", error);
    return null;
  }
}

/** What the AI tells the player as it hands the chat over. */
export function contactUsTransferMessage(packageName: string, employeeName: string): string {
  const pkg = packageName ? `the "${packageName}" Game Master package` : "this Game Master package";
  return `${pkg[0].toUpperCase()}${pkg.slice(1)} is available on request, so I'm transferring you to a member of our team. ${employeeName} will be with you shortly to help you get it enabled.`;
}
