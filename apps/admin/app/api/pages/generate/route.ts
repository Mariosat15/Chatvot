import { NextRequest, NextResponse } from "next/server";
import { connectToDatabase } from "@/database/mongoose";
import CompanySettingsModel from "@/database/models/company-settings.model";

// ─── Company details interface ───────────────────────────────────────────────
interface CompanyInfo {
  companyName: string;
  legalName: string;
  email: string;
  phone: string;
  website: string;
  addressLine1: string;
  city: string;
  stateProvince: string;
  postalCode: string;
  country: string;
  registrationNumber: string;
  vatNumber: string;
}

// ─── Section type ────────────────────────────────────────────────────────────
interface GeneratedSection {
  id: string;
  type: "heading" | "paragraph" | "list" | "divider";
  title?: string;
  content: string;
  order: number;
}

/**
 * POST /api/pages/generate — Generate page content from templates + company details.
 *
 * Body: { pageType: string, pageTitle?: string }
 * pageType: "terms" | "privacy" | "refund" | "aml" | "responsible-trading" | "about" | "contact" | "faq" | "cookies" | "custom"
 *
 * Reads company details from WhiteLabel / company-settings to fill in templates.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { pageType, pageTitle } = body;

    if (!pageType) {
      return NextResponse.json(
        { success: false, error: "pageType is required" },
        { status: 400 },
      );
    }

    // Fetch company details from CompanySettings collection (singleton)
    await connectToDatabase();
    const cs = await CompanySettingsModel.findOne({}).lean();

    const company: CompanyInfo = {
      companyName: cs?.companyName || "Our Platform",
      legalName: cs?.legalName || "Our Platform Ltd.",
      email: cs?.email || "support@ourplatform.com",
      phone: cs?.phone || "",
      website: cs?.website || process.env.NEXT_PUBLIC_APP_URL || "https://ourplatform.com",
      addressLine1: cs?.addressLine1 || "",
      city: cs?.city || "",
      stateProvince: cs?.stateProvince || "",
      postalCode: cs?.postalCode || "",
      country: cs?.country || "",
      registrationNumber: cs?.registrationNumber || "",
      vatNumber: cs?.vatNumber || "",
    };

    const fullAddress = [
      company.addressLine1,
      company.city,
      company.stateProvince,
      company.postalCode,
      company.country,
    ]
      .filter(Boolean)
      .join(", ");

    // Generate sections based on page type
    const sections = generatePageContent(
      pageType,
      pageTitle || pageType,
      company,
      fullAddress,
    );

    return NextResponse.json({
      success: true,
      sections,
      title: getPageTitle(pageType, pageTitle, company.companyName),
      subtitle: getPageSubtitle(pageType, company.companyName),
      seoTitle: getPageTitle(pageType, pageTitle, company.companyName),
      seoDescription: getPageSubtitle(pageType, company.companyName),
    });
  } catch (error) {
    console.error("❌ Error generating page content:", error);
    return NextResponse.json(
      { success: false, error: "Failed to generate page content" },
      { status: 500 },
    );
  }
}

// ─── Page Title Generator ────────────────────────────────────────────────────
function getPageTitle(
  pageType: string,
  customTitle: string | undefined,
  companyName: string,
): string {
  if (customTitle && customTitle !== pageType) return customTitle;
  const titles: Record<string, string> = {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    refund: "Refund Policy",
    aml: "Anti-Money Laundering Policy",
    "responsible-trading": "Responsible Trading Policy",
    about: `About ${companyName}`,
    contact: "Contact Us",
    faq: "Frequently Asked Questions",
    cookies: "Cookie Policy",
  };
  return titles[pageType] || customTitle || "New Page";
}

function getPageSubtitle(pageType: string, companyName: string): string {
  const subtitles: Record<string, string> = {
    terms: `Please read these terms carefully before using ${companyName}.`,
    privacy: `How ${companyName} collects, uses, and protects your personal information.`,
    refund: `Our refund and cancellation policies for ${companyName}.`,
    aml: `${companyName}'s commitment to preventing money laundering and financial crime.`,
    "responsible-trading": `${companyName} promotes responsible and ethical simulated trading.`,
    about: `Learn about ${companyName} and our mission.`,
    contact: `Get in touch with the ${companyName} team.`,
    faq: `Common questions about ${companyName}.`,
    cookies: `How ${companyName} uses cookies and similar technologies.`,
  };
  return subtitles[pageType] || `Information provided by ${companyName}.`;
}

// ─── Content Templates ───────────────────────────────────────────────────────
function generatePageContent(
  pageType: string,
  _pageTitle: string,
  company: CompanyInfo,
  fullAddress: string,
): GeneratedSection[] {
  switch (pageType) {
    case "terms":
      return generateTerms(company, fullAddress);
    case "privacy":
      return generatePrivacy(company, fullAddress);
    case "refund":
      return generateRefund(company);
    case "aml":
      return generateAML(company);
    case "responsible-trading":
      return generateResponsibleTrading(company);
    case "about":
      return generateAbout(company);
    case "contact":
      return generateContact(company, fullAddress);
    case "faq":
      return generateFAQ(company);
    case "cookies":
      return generateCookies(company);
    default:
      return generateCustom(company);
  }
}

// ─── Helper ──────────────────────────────────────────────────────────────────
let orderCounter = 0;
function s(
  type: GeneratedSection["type"],
  titleOrContent: string,
  content = "",
): GeneratedSection {
  return {
    id: `gen-${++orderCounter}`,
    type,
    title: type === "heading" ? titleOrContent : undefined,
    content: type === "heading" ? content : titleOrContent,
    order: orderCounter - 1,
  };
}
function resetOrder() {
  orderCounter = 0;
}

// ─── Terms Template ──────────────────────────────────────────────────────────
function generateTerms(
  c: CompanyInfo,
  addr: string,
): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. Acceptance of Terms"),
    s(
      "paragraph",
      `By accessing or using the ${c.companyName} platform (operated by ${c.legalName}), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site.`,
    ),
    s("divider", ""),
    s("heading", "2. Platform Description"),
    s(
      "paragraph",
      `${c.companyName} provides simulated trading competitions and challenges using virtual currency. No real money is traded on financial markets through this platform. All trading activities are simulated for educational and entertainment purposes. Virtual currency balances, profits, and losses do not represent real financial transactions.`,
    ),
    s("divider", ""),
    s("heading", "3. User Accounts"),
    s(
      "paragraph",
      `To use ${c.companyName}, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current, and complete.`,
    ),
    s(
      "list",
      `You must be at least 18 years old to use this platform\nYou may only maintain one account per person\nYou are responsible for all activity under your account\nSharing account credentials is strictly prohibited\n${c.legalName} reserves the right to suspend or terminate accounts that violate these terms`,
    ),
    s("divider", ""),
    s("heading", "4. Competition Rules"),
    s(
      "paragraph",
      `Competitions and challenges on ${c.companyName} are governed by specific rules set at the time of creation. By entering a competition, you agree to abide by those rules. The platform reserves the right to disqualify participants, cancel competitions, or modify rules when necessary to maintain fair play and platform integrity.`,
    ),
    s("divider", ""),
    s("heading", "5. Virtual Currency & Payments"),
    s(
      "paragraph",
      `Virtual currency (credits) purchased on ${c.companyName} is used exclusively for entering competitions and challenges. Credits are non-refundable digital goods and have no real-world monetary value outside the platform. All purchases are final unless otherwise required by applicable law.`,
    ),
    s("divider", ""),
    s("heading", "6. Fair Play & Anti-Fraud"),
    s(
      "paragraph",
      `${c.companyName} employs automated fraud detection systems to maintain fair play. Any attempt to manipulate competitions, exploit bugs, collude with other users, or use automated trading bots (unless explicitly permitted) may result in immediate account suspension, forfeiture of winnings, and permanent ban from the platform.`,
    ),
    s("divider", ""),
    s("heading", "7. Intellectual Property"),
    s(
      "paragraph",
      `All content, features, and functionality of ${c.companyName} — including but not limited to text, graphics, logos, icons, images, audio clips, digital downloads, data compilations, and software — are the exclusive property of ${c.legalName} and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws.`,
    ),
    s("divider", ""),
    s("heading", "8. Limitation of Liability"),
    s(
      "paragraph",
      `In no event shall ${c.legalName}, its directors, employees, partners, agents, suppliers, or affiliates be liable for any indirect, incidental, special, consequential, or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of or inability to access or use the platform.`,
    ),
    s("divider", ""),
    s("heading", "9. Modifications to Terms"),
    s(
      "paragraph",
      `${c.legalName} reserves the right to modify or replace these Terms at any time. If a revision is material, we will provide at least 30 days' notice prior to any new terms taking effect. By continuing to access or use ${c.companyName} after revisions become effective, you agree to be bound by the revised terms.`,
    ),
    s("divider", ""),
    s("heading", "10. Contact Information"),
    s(
      "paragraph",
      `If you have any questions about these Terms of Service, please contact us at ${c.email}${addr ? ` or write to us at: ${addr}` : ""}.`,
    ),
  ];
}

// ─── Privacy Template ────────────────────────────────────────────────────────
function generatePrivacy(
  c: CompanyInfo,
  addr: string,
): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. Information We Collect"),
    s(
      "paragraph",
      `${c.legalName} ("${c.companyName}", "we", "us") collects information you provide directly when you create an account, participate in competitions, make purchases, or communicate with us. This may include your name, email address, payment information, and trading activity data.`,
    ),
    s(
      "list",
      `Account information: name, email, password (encrypted)\nProfile information: display name, avatar\nPayment information: processed securely through third-party providers\nTrading data: positions, orders, competition history\nDevice information: browser type, IP address, device identifiers\nUsage data: pages visited, features used, time spent`,
    ),
    s("divider", ""),
    s("heading", "2. How We Use Your Information"),
    s(
      "paragraph",
      `We use the information we collect to provide, maintain, and improve ${c.companyName}, to process transactions and send related information, to send technical notices, updates, security alerts, and support messages, and to monitor and analyze trends, usage, and activities.`,
    ),
    s("divider", ""),
    s("heading", "3. Data Security"),
    s(
      "paragraph",
      `We implement appropriate technical and organizational security measures to protect your personal data against unauthorized access, alteration, disclosure, or destruction.`,
    ),
    s(
      "list",
      `All passwords are hashed using industry-standard algorithms\nSensitive data is encrypted in transit (TLS/SSL)\nAccess to personal data is restricted to authorized personnel\nRegular security audits and vulnerability assessments\nAutomated fraud detection and prevention systems`,
    ),
    s("divider", ""),
    s("heading", "4. Cookies & Tracking"),
    s(
      "paragraph",
      `${c.companyName} uses cookies and similar tracking technologies to track activity on our platform and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.`,
    ),
    s("divider", ""),
    s("heading", "5. Third-Party Services"),
    s(
      "paragraph",
      `We may employ third-party companies to facilitate our platform, provide services on our behalf, or assist us in analyzing platform usage. These third parties have access to your personal data only to perform tasks on our behalf and are obligated not to disclose or use it for any other purpose.`,
    ),
    s("divider", ""),
    s("heading", "6. Data Retention"),
    s(
      "paragraph",
      `We retain your personal data only for as long as necessary for the purposes set out in this Privacy Policy, including to comply with legal obligations, resolve disputes, and enforce our policies.`,
    ),
    s("divider", ""),
    s("heading", "7. Your Rights"),
    s(
      "paragraph",
      `Depending on your jurisdiction, you may have the right to access, correct, update, or request deletion of your personal information. You may also have the right to object to processing, request restriction, or request portability of your data. Contact us at ${c.email} to exercise these rights.`,
    ),
    s("divider", ""),
    s("heading", "8. Children's Privacy"),
    s(
      "paragraph",
      `${c.companyName} is not intended for use by children under 18. We do not knowingly collect personal data from children under 18. If you become aware that a child has provided us with personal data, please contact us.`,
    ),
    s("divider", ""),
    s("heading", "9. Changes to This Policy"),
    s(
      "paragraph",
      `We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the effective date.`,
    ),
    s("divider", ""),
    s("heading", "10. Contact Us"),
    s(
      "paragraph",
      `If you have questions about this Privacy Policy, contact us at ${c.email}${addr ? ` or write to: ${addr}` : ""}${c.website ? `. Visit us at ${c.website}` : ""}.`,
    ),
  ];
}

// ─── Refund Template ─────────────────────────────────────────────────────────
function generateRefund(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. General Policy"),
    s(
      "paragraph",
      `${c.companyName} credits are non-refundable digital goods used to enter trading competitions and challenges. By purchasing credits, you acknowledge that all sales are final.`,
    ),
    s("divider", ""),
    s("heading", "2. Exceptions"),
    s(
      "paragraph",
      `In certain limited circumstances, ${c.legalName} may issue refunds at its sole discretion:`,
    ),
    s(
      "list",
      `Technical errors that prevented participation in a paid competition\nDuplicate charges caused by payment processing errors\nCompetitions cancelled by ${c.companyName} before they started\nUnauthorized transactions (subject to investigation)`,
    ),
    s("divider", ""),
    s("heading", "3. How to Request a Refund"),
    s(
      "paragraph",
      `To request a refund, contact our support team at ${c.email} within 14 days of the transaction. Include your username, transaction ID, and a description of the issue. We will review your request within 5 business days.`,
    ),
    s("divider", ""),
    s("heading", "4. Competition Credits"),
    s(
      "paragraph",
      `If a competition is cancelled by ${c.companyName} before it starts, all entry fees will be automatically refunded to participants' wallets. Competitions that have already started are not eligible for refunds, even if cancelled early due to technical issues — in such cases, prizes may be distributed based on standings at the time of cancellation.`,
    ),
    s("divider", ""),
    s("heading", "5. Chargebacks"),
    s(
      "paragraph",
      `Filing a chargeback with your payment provider without first contacting ${c.companyName} support may result in immediate account suspension. We encourage you to reach out to us first to resolve any billing disputes.`,
    ),
  ];
}

// ─── AML Template ────────────────────────────────────────────────────────────
function generateAML(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. Commitment"),
    s(
      "paragraph",
      `${c.legalName} is committed to the highest standards of Anti-Money Laundering (AML) compliance and combating the financing of terrorism (CFT). This policy outlines our procedures for detecting and preventing money laundering activities.`,
    ),
    s("divider", ""),
    s("heading", "2. Know Your Customer (KYC)"),
    s(
      "paragraph",
      `All users must complete identity verification before making withdrawals or exceeding certain transaction thresholds. This includes providing government-issued identification, proof of address, and in some cases, source of funds documentation.`,
    ),
    s("divider", ""),
    s("heading", "3. Transaction Monitoring"),
    s(
      "paragraph",
      `${c.companyName} employs automated transaction monitoring systems that flag unusual patterns, including rapid deposits and withdrawals, structuring of transactions to avoid reporting thresholds, and transactions inconsistent with the user's profile.`,
    ),
    s("divider", ""),
    s("heading", "4. Reporting"),
    s(
      "paragraph",
      `When suspicious activity is detected, ${c.legalName} will file the appropriate reports with relevant authorities and may freeze or close the associated account pending investigation.`,
    ),
    s("divider", ""),
    s("heading", "5. Prohibited Activities"),
    s(
      "list",
      `Using the platform for money laundering or terrorist financing\nProviding false or misleading identification documents\nOperating accounts on behalf of third parties without disclosure\nUsing anonymous or fictitious identities\nAttempting to circumvent KYC or AML controls`,
    ),
  ];
}

// ─── Responsible Trading Template ────────────────────────────────────────────
function generateResponsibleTrading(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. Our Commitment"),
    s(
      "paragraph",
      `${c.companyName} is committed to promoting responsible participation in simulated trading competitions. While our platform uses virtual currency and no real money is at risk in financial markets, we recognize that competition entry fees involve real purchases and we encourage all users to trade responsibly.`,
    ),
    s("divider", ""),
    s("heading", "2. Spending Limits"),
    s(
      "paragraph",
      `We encourage users to set personal spending limits and to only purchase credits they can comfortably afford. ${c.companyName} may implement platform-level spending controls to protect users.`,
    ),
    s("divider", ""),
    s("heading", "3. Self-Exclusion"),
    s(
      "paragraph",
      `If you feel your participation has become problematic, you may request a temporary or permanent self-exclusion by contacting our support team at ${c.email}. During the exclusion period, you will be unable to enter new competitions or purchase credits.`,
    ),
    s("divider", ""),
    s("heading", "4. Warning Signs"),
    s(
      "list",
      `Spending more than you can afford on competition entry fees\nFeeling anxious or stressed about competition outcomes\nNeglecting personal or professional responsibilities to participate\nChasing losses by entering increasingly expensive competitions\nBorrowing money to fund competition entries`,
    ),
    s("divider", ""),
    s("heading", "5. Resources"),
    s(
      "paragraph",
      `If you or someone you know is struggling with gambling-related issues, please contact a professional helpline in your jurisdiction. ${c.companyName} support is also available at ${c.email} to assist with account controls and self-exclusion.`,
    ),
  ];
}

// ─── About Template ──────────────────────────────────────────────────────────
function generateAbout(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", `About ${c.companyName}`),
    s(
      "paragraph",
      `${c.companyName} is a cutting-edge simulated trading competition platform operated by ${c.legalName}. We bring the excitement of financial markets to a competitive, gamified environment where traders can test their skills, compete against others, and win prizes — all without risking real capital on live markets.`,
    ),
    s("divider", ""),
    s("heading", "Our Mission"),
    s(
      "paragraph",
      `We believe that financial literacy and trading skill development should be accessible, engaging, and fun. ${c.companyName} bridges the gap between education and entertainment by providing a platform where aspiring and experienced traders alike can hone their strategies in a risk-free environment.`,
    ),
    s("divider", ""),
    s("heading", "What We Offer"),
    s(
      "list",
      `Live simulated trading competitions with real-time market data\n1v1 challenges for head-to-head skill tests\nComprehensive leaderboards and ranking systems\nVirtual currency system for fair competition entry\nAdvanced charting and trading tools\nCommunity features and trader profiles`,
    ),
    s("divider", ""),
    s("heading", "Contact"),
    s(
      "paragraph",
      `Have questions or feedback? Reach out to us at ${c.email}${c.website ? ` or visit ${c.website}` : ""}.`,
    ),
  ];
}

// ─── Contact Template ────────────────────────────────────────────────────────
function generateContact(c: CompanyInfo, addr: string): GeneratedSection[] {
  resetOrder();
  const contactLines = [`Email: ${c.email}`];
  if (c.phone) contactLines.push(`Phone: ${c.phone}`);
  if (c.website) contactLines.push(`Website: ${c.website}`);
  if (addr) contactLines.push(`Address: ${addr}`);

  return [
    s("heading", "Get in Touch"),
    s(
      "paragraph",
      `We'd love to hear from you. Whether you have a question about features, competitions, billing, or anything else, our team is ready to answer all your questions.`,
    ),
    s("divider", ""),
    s("heading", "Contact Details"),
    s("list", contactLines.join("\n")),
    s("divider", ""),
    s("heading", "Support Hours"),
    s(
      "paragraph",
      `Our support team is available Monday through Friday, 9:00 AM to 6:00 PM (UTC). We aim to respond to all inquiries within 24 hours.`,
    ),
    s("divider", ""),
    s("heading", "Business Inquiries"),
    s(
      "paragraph",
      `For enterprise partnerships, white-label solutions, or business opportunities, please contact us at ${c.email} with the subject line "Business Inquiry".`,
    ),
  ];
}

// ─── FAQ Template ────────────────────────────────────────────────────────────
function generateFAQ(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "What is " + c.companyName + "?"),
    s(
      "paragraph",
      `${c.companyName} is a simulated trading competition platform where users can compete against each other using virtual currency. All trading is simulated — no real money is traded on live financial markets.`,
    ),
    s("divider", ""),
    s("heading", "How do I get started?"),
    s(
      "paragraph",
      `Create an account, purchase credits, and join a competition or challenge. You'll be given a virtual balance to trade with, and your performance determines your ranking.`,
    ),
    s("divider", ""),
    s("heading", "Is real money involved?"),
    s(
      "paragraph",
      `Credits are purchased with real money and used as entry fees for competitions. However, all trading is simulated — you're not trading real assets. Prizes are distributed based on competition rules.`,
    ),
    s("divider", ""),
    s("heading", "How are winners determined?"),
    s(
      "paragraph",
      `Winners are determined by their simulated trading performance within the competition period. This is typically measured by portfolio return (P&L), though specific rules may vary by competition.`,
    ),
    s("divider", ""),
    s("heading", "Can I withdraw my winnings?"),
    s(
      "paragraph",
      `Yes, competition winnings can be withdrawn subject to our withdrawal policies and KYC verification requirements. Please review our Terms of Service for full details.`,
    ),
    s("divider", ""),
    s("heading", "What trading instruments are available?"),
    s(
      "paragraph",
      `${c.companyName} currently supports major forex pairs. The available instruments may be expanded in the future. Check the platform for the current list of tradable symbols.`,
    ),
    s("divider", ""),
    s("heading", "Still have questions?"),
    s(
      "paragraph",
      `Contact our support team at ${c.email} — we're happy to help!`,
    ),
  ];
}

// ─── Cookies Template ────────────────────────────────────────────────────────
function generateCookies(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. What Are Cookies?"),
    s(
      "paragraph",
      `Cookies are small text files stored on your device when you visit ${c.companyName}. They help us remember your preferences, understand how you use our platform, and improve your experience.`,
    ),
    s("divider", ""),
    s("heading", "2. Types of Cookies We Use"),
    s(
      "list",
      `Essential cookies: Required for the platform to function (authentication, security)\nPerformance cookies: Help us understand how visitors use our platform\nFunctional cookies: Remember your preferences and settings\nAnalytics cookies: Help us measure and improve platform performance`,
    ),
    s("divider", ""),
    s("heading", "3. Managing Cookies"),
    s(
      "paragraph",
      `You can control cookies through your browser settings. Most browsers allow you to block or delete cookies. However, blocking essential cookies may affect platform functionality.`,
    ),
    s("divider", ""),
    s("heading", "4. Third-Party Cookies"),
    s(
      "paragraph",
      `Some cookies may be set by third-party services we use for analytics, payment processing, or other functionality. These third parties have their own privacy policies governing the use of cookies.`,
    ),
    s("divider", ""),
    s("heading", "5. Updates to This Policy"),
    s(
      "paragraph",
      `We may update this Cookie Policy from time to time. Check this page periodically for changes. Continued use of ${c.companyName} constitutes acceptance of the updated policy.`,
    ),
  ];
}

// ─── Custom/Generic Template ─────────────────────────────────────────────────
function generateCustom(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "Introduction"),
    s(
      "paragraph",
      `Welcome to this page on ${c.companyName}. Edit the sections below to add your content.`,
    ),
    s("divider", ""),
    s("heading", "Section 1"),
    s(
      "paragraph",
      `Add your content here. You can edit each section individually in the Site Pages editor.`,
    ),
    s("divider", ""),
    s("heading", "Contact"),
    s(
      "paragraph",
      `For questions, please contact us at ${c.email}.`,
    ),
  ];
}
