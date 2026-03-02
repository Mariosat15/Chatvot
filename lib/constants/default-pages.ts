/**
 * Default Site Pages — Terms of Service, Privacy Policy & Action Terms
 *
 * These serve as the initial seed content for legal pages and action-specific
 * pop-up terms. They are inserted into the DB on first deployment (or DB reset)
 * and can be fully customized by the admin afterward.
 *
 * The admin-customized versions are also saved to data/defaults/pages.json
 * so they persist across DB resets (same pattern as badge defaults).
 *
 * Categories:
 *   "page"         — Regular full-page site pages (terms, privacy, about, etc.)
 *   "action_terms" — Short pop-up terms shown before critical user actions
 */

export type DefaultPageCategory = "page" | "action_terms";

export interface DefaultPageSection {
  id: string;
  type: "heading" | "paragraph" | "list" | "divider" | "html";
  title?: string;
  content: string;
  order: number;
}

export interface DefaultPage {
  slug: string;
  title: string;
  subtitle: string;
  isSystem: boolean;
  /** @default "page" */
  category?: DefaultPageCategory;
  seoTitle: string;
  seoDescription: string;
  sections: DefaultPageSection[];
}

// ─── Reserved slugs that cannot be used for site pages ───────────────────────
// Reason: These match existing Next.js routes and would cause conflicts
export const RESERVED_SLUGS = new Set([
  "dashboard",
  "competitions",
  "challenges",
  "championship",
  "wallet",
  "profile",
  "help",
  "leaderboard",
  "marketplace",
  "messaging",
  "notifications",
  "journey",
  "gamemaster",
  "stocks",
  "watchlist",
  "alerts",
  "sign-in",
  "sign-up",
  "arena",
  "enterprise",
  "landing",
  "api",
  "kyc",
  "verify-email-required",
  "stream",
]);

// ─── Terms of Service ────────────────────────────────────────────────────────
const TERMS_PAGE: DefaultPage = {
  slug: "terms",
  title: "Terms of Service",
  subtitle: "Please read these terms carefully before using our platform.",
  isSystem: true,
  seoTitle: "Terms of Service",
  seoDescription:
    "Read the Terms of Service governing your use of our trading competition platform.",
  sections: [
    {
      id: "t-1",
      type: "heading",
      title: "1. Acceptance of Terms",
      content: "",
      order: 0,
    },
    {
      id: "t-2",
      type: "paragraph",
      content:
        "By accessing or using this platform, you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site. The materials contained on this platform are protected by applicable copyright and trademark law.",
      order: 1,
    },
    { id: "t-3", type: "divider", content: "", order: 2 },
    {
      id: "t-4",
      type: "heading",
      title: "2. Platform Description",
      content: "",
      order: 3,
    },
    {
      id: "t-5",
      type: "paragraph",
      content:
        "This platform provides simulated trading competitions and challenges using virtual currency. No real money is traded on financial markets through this platform. All trading activities are simulated for educational and entertainment purposes. Virtual currency balances, profits, and losses do not represent real financial transactions.",
      order: 4,
    },
    { id: "t-6", type: "divider", content: "", order: 5 },
    {
      id: "t-7",
      type: "heading",
      title: "3. User Accounts",
      content: "",
      order: 6,
    },
    {
      id: "t-8",
      type: "paragraph",
      content:
        "To use this platform, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete. You are responsible for safeguarding your password and agree not to disclose your password to any third party. You must immediately notify us of any unauthorized use of your account.",
      order: 7,
    },
    {
      id: "t-9",
      type: "list",
      content:
        "You must be at least 18 years old to use this platform\nYou may only maintain one account per person\nYou are responsible for all activity under your account\nSharing account credentials is strictly prohibited\nWe reserve the right to suspend or terminate accounts that violate these terms",
      order: 8,
    },
    { id: "t-10", type: "divider", content: "", order: 9 },
    {
      id: "t-11",
      type: "heading",
      title: "4. Competition Rules",
      content: "",
      order: 10,
    },
    {
      id: "t-12",
      type: "paragraph",
      content:
        "Competitions and challenges on this platform are governed by specific rules set at the time of creation. By entering a competition, you agree to abide by those rules. The platform reserves the right to disqualify participants, cancel competitions, or modify rules when necessary to maintain fair play and platform integrity.",
      order: 11,
    },
    { id: "t-13", type: "divider", content: "", order: 12 },
    {
      id: "t-14",
      type: "heading",
      title: "5. Virtual Currency & Payments",
      content: "",
      order: 13,
    },
    {
      id: "t-15",
      type: "paragraph",
      content:
        "Virtual currency purchased on this platform is used exclusively for entering competitions and challenges. Virtual currency has no real-world monetary value and cannot be exchanged for real money, goods, or services outside this platform. All purchases of virtual currency are final and non-refundable unless otherwise required by applicable law.",
      order: 14,
    },
    { id: "t-16", type: "divider", content: "", order: 15 },
    {
      id: "t-17",
      type: "heading",
      title: "6. Fair Play & Anti-Fraud",
      content: "",
      order: 16,
    },
    {
      id: "t-18",
      type: "paragraph",
      content:
        "We employ automated fraud detection systems to maintain fair play. Any attempt to manipulate competitions, exploit bugs, collude with other users, or use automated trading bots (unless explicitly permitted) may result in immediate account suspension, forfeiture of winnings, and permanent ban from the platform.",
      order: 17,
    },
    { id: "t-19", type: "divider", content: "", order: 18 },
    {
      id: "t-20",
      type: "heading",
      title: "7. Intellectual Property",
      content: "",
      order: 19,
    },
    {
      id: "t-21",
      type: "paragraph",
      content:
        "All content, features, and functionality of this platform — including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software — are the exclusive property of the platform operator and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.",
      order: 20,
    },
    { id: "t-22", type: "divider", content: "", order: 21 },
    {
      id: "t-23",
      type: "heading",
      title: "8. Limitation of Liability",
      content: "",
      order: 22,
    },
    {
      id: "t-24",
      type: "paragraph",
      content:
        "In no event shall the platform, its directors, employees, partners, agents, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the platform.",
      order: 23,
    },
    { id: "t-25", type: "divider", content: "", order: 24 },
    {
      id: "t-26",
      type: "heading",
      title: "9. Modifications to Terms",
      content: "",
      order: 25,
    },
    {
      id: "t-27",
      type: "paragraph",
      content:
        "We reserve the right to modify or replace these Terms at any time at our sole discretion. If a revision is material, we will provide at least 30 days notice prior to any new terms taking effect. What constitutes a material change will be determined at our sole discretion. By continuing to access or use our platform after those revisions become effective, you agree to be bound by the revised terms.",
      order: 26,
    },
    { id: "t-28", type: "divider", content: "", order: 27 },
    {
      id: "t-29",
      type: "heading",
      title: "10. Contact Information",
      content: "",
      order: 28,
    },
    {
      id: "t-30",
      type: "paragraph",
      content:
        "If you have any questions about these Terms of Service, please contact us through the support channels available on our platform.",
      order: 29,
    },
  ],
};

// ─── Privacy Policy ──────────────────────────────────────────────────────────
const PRIVACY_PAGE: DefaultPage = {
  slug: "privacy",
  title: "Privacy Policy",
  subtitle: "How we collect, use, and protect your personal information.",
  isSystem: true,
  seoTitle: "Privacy Policy",
  seoDescription:
    "Learn how we collect, use, and protect your personal data on our trading competition platform.",
  sections: [
    {
      id: "p-1",
      type: "heading",
      title: "1. Information We Collect",
      content: "",
      order: 0,
    },
    {
      id: "p-2",
      type: "paragraph",
      content:
        "We collect information you provide directly to us when you create an account, participate in competitions, make purchases, communicate with us, or otherwise use our platform. This may include your name, email address, payment information, and trading activity data.",
      order: 1,
    },
    {
      id: "p-3",
      type: "list",
      content:
        "Account information: name, email, password (encrypted)\nProfile information: display name, avatar\nPayment information: processed securely through third-party providers\nTrading data: positions, orders, competition history\nDevice information: browser type, IP address, device identifiers\nUsage data: pages visited, features used, time spent",
      order: 2,
    },
    { id: "p-4", type: "divider", content: "", order: 3 },
    {
      id: "p-5",
      type: "heading",
      title: "2. How We Use Your Information",
      content: "",
      order: 4,
    },
    {
      id: "p-6",
      type: "paragraph",
      content:
        "We use the information we collect to provide, maintain, and improve our platform, to process transactions and send related information, to send you technical notices, updates, security alerts, and support messages, to respond to your comments, questions, and requests, and to monitor and analyze trends, usage, and activities in connection with our platform.",
      order: 5,
    },
    { id: "p-7", type: "divider", content: "", order: 6 },
    {
      id: "p-8",
      type: "heading",
      title: "3. Data Security",
      content: "",
      order: 7,
    },
    {
      id: "p-9",
      type: "paragraph",
      content:
        "We implement appropriate technical and organizational security measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction. However, no method of transmission over the Internet or method of electronic storage is 100% secure, and we cannot guarantee absolute security.",
      order: 8,
    },
    {
      id: "p-10",
      type: "list",
      content:
        "All passwords are hashed using industry-standard algorithms\nSensitive data is encrypted in transit (TLS/SSL)\nAccess to personal data is restricted to authorized personnel\nRegular security audits and vulnerability assessments\nAutomated fraud detection and prevention systems",
      order: 9,
    },
    { id: "p-11", type: "divider", content: "", order: 10 },
    {
      id: "p-12",
      type: "heading",
      title: "4. Cookies & Tracking",
      content: "",
      order: 11,
    },
    {
      id: "p-13",
      type: "paragraph",
      content:
        "We use cookies and similar tracking technologies to track activity on our platform and hold certain information. Cookies are files with a small amount of data that are sent to your browser from a website and stored on your device. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.",
      order: 12,
    },
    { id: "p-14", type: "divider", content: "", order: 13 },
    {
      id: "p-15",
      type: "heading",
      title: "5. Third-Party Services",
      content: "",
      order: 14,
    },
    {
      id: "p-16",
      type: "paragraph",
      content:
        "We may employ third-party companies and individuals to facilitate our platform, to provide services on our behalf, to perform platform-related services, or to assist us in analyzing how our platform is used. These third parties have access to your personal data only to perform these tasks on our behalf and are obligated not to disclose or use it for any other purpose.",
      order: 15,
    },
    { id: "p-17", type: "divider", content: "", order: 16 },
    {
      id: "p-18",
      type: "heading",
      title: "6. Data Retention",
      content: "",
      order: 17,
    },
    {
      id: "p-19",
      type: "paragraph",
      content:
        "We will retain your personal data only for as long as is necessary for the purposes set out in this Privacy Policy. We will retain and use your personal data to the extent necessary to comply with our legal obligations, resolve disputes, and enforce our policies.",
      order: 18,
    },
    { id: "p-20", type: "divider", content: "", order: 19 },
    {
      id: "p-21",
      type: "heading",
      title: "7. Your Rights",
      content: "",
      order: 20,
    },
    {
      id: "p-22",
      type: "paragraph",
      content:
        "Depending on your jurisdiction, you may have the right to access, correct, update, or request deletion of your personal information. You may also have the right to object to processing of your personal data, ask us to restrict processing, or request portability of your personal data. To exercise these rights, please contact us through the available support channels.",
      order: 21,
    },
    { id: "p-23", type: "divider", content: "", order: 22 },
    {
      id: "p-24",
      type: "heading",
      title: "8. Children's Privacy",
      content: "",
      order: 23,
    },
    {
      id: "p-25",
      type: "paragraph",
      content:
        "Our platform is not intended for use by children under the age of 18. We do not knowingly collect personal data from children under 18. If you become aware that a child has provided us with personal data, please contact us and we will take steps to remove such information.",
      order: 24,
    },
    { id: "p-26", type: "divider", content: "", order: 25 },
    {
      id: "p-27",
      type: "heading",
      title: "9. Changes to This Policy",
      content: "",
      order: 26,
    },
    {
      id: "p-28",
      type: "paragraph",
      content:
        "We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the effective date. You are advised to review this Privacy Policy periodically for any changes.",
      order: 27,
    },
    { id: "p-29", type: "divider", content: "", order: 28 },
    {
      id: "p-30",
      type: "heading",
      title: "10. Contact Us",
      content: "",
      order: 29,
    },
    {
      id: "p-31",
      type: "paragraph",
      content:
        "If you have any questions about this Privacy Policy or our data practices, please contact us through the support channels available on our platform.",
      order: 30,
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════════════
// ACTION TERMS — Pop-up terms shown before critical user actions
// Reason: Short, clear, and legally protective. Users must accept before
// proceeding with the action. Editable by admin in Site Pages section.
// ═══════════════════════════════════════════════════════════════════════════════

const ACTION_TERMS_CREDIT_PURCHASE: DefaultPage = {
  slug: "terms-credit-purchase",
  title: "Credit Purchase Terms",
  subtitle: "Please read and accept before purchasing credits.",
  isSystem: true,
  category: "action_terms",
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "acp-1",
      type: "heading",
      title: "Credit Purchase Agreement",
      content: "",
      order: 0,
    },
    {
      id: "acp-2",
      type: "paragraph",
      content:
        "By purchasing credits, you acknowledge and agree to the following terms. Credits are virtual currency used exclusively on this platform for entering trading competitions and challenges. Credits have no real-world monetary value outside this platform.",
      order: 1,
    },
    {
      id: "acp-3",
      type: "list",
      content:
        "All credit purchases are final and non-refundable except as required by applicable law\nCredits can only be used within this platform for competitions and challenges\nCredit value is determined by the platform's published conversion rate\nThe platform reserves the right to modify credit pricing with prior notice\nYou confirm you are at least 18 years of age and legally permitted to make this purchase\nVAT and processing fees may apply and will be shown before payment",
      order: 2,
    },
    {
      id: "acp-4",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you agree to these terms and authorize the charge to your selected payment method. If you have questions, please contact support before proceeding.",
      order: 3,
    },
  ],
};

const ACTION_TERMS_WITHDRAWAL: DefaultPage = {
  slug: "terms-withdrawal",
  title: "Withdrawal Terms",
  subtitle: "Please read and accept before withdrawing funds.",
  isSystem: true,
  category: "action_terms",
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "aw-1",
      type: "heading",
      title: "Withdrawal Agreement",
      content: "",
      order: 0,
    },
    {
      id: "aw-2",
      type: "paragraph",
      content:
        "By submitting a withdrawal request, you acknowledge and agree to the following terms. Withdrawals are subject to verification, processing fees, and minimum/maximum limits set by the platform.",
      order: 1,
    },
    {
      id: "aw-3",
      type: "list",
      content:
        "Withdrawal requests are subject to identity verification (KYC) as required by law\nProcessing fees and minimum withdrawal amounts apply as displayed\nFunds will be sent to your verified payment method — processing typically takes 3-5 business days\nThe platform reserves the right to delay or decline withdrawals pending fraud review\nYou confirm that you are the authorized account holder and the recipient of funds\nIncomplete or suspicious requests may require additional documentation",
      order: 2,
    },
    {
      id: "aw-4",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you confirm that all information provided is accurate, you are the authorized account holder, and you agree to the withdrawal terms and any applicable fees.",
      order: 3,
    },
  ],
};

const ACTION_TERMS_MARKETPLACE: DefaultPage = {
  slug: "terms-marketplace",
  title: "Marketplace Purchase Terms",
  subtitle: "Please read and accept before purchasing this item.",
  isSystem: true,
  category: "action_terms",
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "amp-1",
      type: "heading",
      title: "Marketplace Purchase Agreement",
      content: "",
      order: 0,
    },
    {
      id: "amp-2",
      type: "paragraph",
      content:
        "By purchasing an item from the marketplace, you acknowledge and agree to the following terms. Marketplace items are digital goods (indicators, strategies, cosmetics, or game master packages) delivered instantly to your account.",
      order: 1,
    },
    {
      id: "amp-3",
      type: "list",
      content:
        "All marketplace purchases are final — digital items are non-refundable once delivered\nItems are licensed for your personal use only and cannot be resold or transferred\nThe platform does not guarantee specific trading results from purchased indicators or strategies\nItem availability and pricing may change without prior notice\nCredits will be deducted from your wallet immediately upon purchase\nYou confirm you understand the item description and its intended use",
      order: 2,
    },
    {
      id: "amp-4",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you agree to purchase this item under these terms. The credit cost will be deducted from your wallet immediately.",
      order: 3,
    },
  ],
};

const ACTION_TERMS_COMPETITION: DefaultPage = {
  slug: "terms-competition-entry",
  title: "Competition Entry Terms",
  subtitle: "Please read and accept before entering this competition.",
  isSystem: true,
  category: "action_terms",
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "ace-1",
      type: "heading",
      title: "Competition Entry Agreement",
      content: "",
      order: 0,
    },
    {
      id: "ace-2",
      type: "paragraph",
      content:
        "By entering this competition, you acknowledge and agree to the following terms. Competitions involve simulated trading with virtual capital. Entry fees are non-refundable once the competition begins.",
      order: 1,
    },
    {
      id: "ace-3",
      type: "list",
      content:
        "Entry fees are deducted from your credit wallet and are non-refundable once the competition starts\nAll trading within competitions is simulated — no real financial instruments are traded\nThe platform reserves the right to disqualify participants for rule violations, collusion, or exploitation\nPrize distribution follows the competition rules defined at the time of creation\nMargin calls and liquidation may apply — resulting in disqualification and loss of entry fee\nResults and rankings are final as determined by the platform's scoring system",
      order: 2,
    },
    {
      id: "ace-4",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you agree to the competition rules, accept the risk of losing your entry fee, and acknowledge that results are final.",
      order: 3,
    },
  ],
};

const ACTION_TERMS_CHALLENGE: DefaultPage = {
  slug: "terms-challenge",
  title: "Challenge Terms",
  subtitle: "Please read and accept before creating or accepting this challenge.",
  isSystem: true,
  category: "action_terms",
  seoTitle: "",
  seoDescription: "",
  sections: [
    {
      id: "ach-1",
      type: "heading",
      title: "1v1 Challenge Agreement",
      content: "",
      order: 0,
    },
    {
      id: "ach-2",
      type: "paragraph",
      content:
        "By creating or accepting a 1v1 challenge, you acknowledge and agree to the following terms. Challenges are head-to-head simulated trading competitions between two participants.",
      order: 1,
    },
    {
      id: "ach-3",
      type: "list",
      content:
        "Entry fees are deducted immediately and are non-refundable once the challenge is accepted\nBoth participants trade with equal virtual starting capital under identical conditions\nA platform fee may be deducted from the prize pool as specified at the time of creation\nThe winner receives the combined prize pool minus the platform fee\nThe platform reserves the right to void challenges in cases of fraud, collusion, or exploitation\nDeclined or expired challenges result in a full refund of the entry fee to the challenger",
      order: 2,
    },
    {
      id: "ach-4",
      type: "paragraph",
      content:
        "By clicking 'I Accept', you agree to the challenge terms, accept the risk of losing your entry fee, and acknowledge that results are final.",
      order: 3,
    },
  ],
};

// ─── Export ──────────────────────────────────────────────────────────────────
// Reason: Regular pages and action terms are exported separately so the
// seed service can insert them with the correct `category` field.
export const DEFAULT_PAGES: DefaultPage[] = [TERMS_PAGE, PRIVACY_PAGE];

export const DEFAULT_ACTION_TERMS: DefaultPage[] = [
  ACTION_TERMS_CREDIT_PURCHASE,
  ACTION_TERMS_WITHDRAWAL,
  ACTION_TERMS_MARKETPLACE,
  ACTION_TERMS_COMPETITION,
  ACTION_TERMS_CHALLENGE,
];

/** All default pages combined (for backward compatibility with seed logic) */
export const ALL_DEFAULT_PAGES: DefaultPage[] = [
  ...DEFAULT_PAGES,
  ...DEFAULT_ACTION_TERMS,
];
