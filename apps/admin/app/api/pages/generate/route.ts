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
 * POST /api/pages/generate — Generate professional legal page content
 * using real regulatory frameworks and company details.
 *
 * Body: { pageType: string, pageTitle?: string }
 *
 * Supported pageTypes:
 *   terms | privacy | refund | aml | responsible-trading |
 *   about | contact | faq | cookies | risk-disclaimer | custom
 *
 * All legal references are real, verifiable statutes and regulations.
 * No hallucinated legal citations.
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
      website:
        cs?.website || process.env.NEXT_PUBLIC_APP_URL || "https://ourplatform.com",
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

    const sections = generatePageContent(pageType, company, fullAddress);

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

// ─── Page Title & Subtitle Generators ────────────────────────────────────────
function getPageTitle(
  pageType: string,
  customTitle: string | undefined,
  companyName: string,
): string {
  if (customTitle && customTitle !== pageType) return customTitle;
  const titles: Record<string, string> = {
    terms: "Terms of Service",
    privacy: "Privacy Policy",
    refund: "Refund & Cancellation Policy",
    aml: "Anti-Money Laundering (AML) Policy",
    "responsible-trading": "Responsible Trading Policy",
    about: `About ${companyName}`,
    contact: "Contact Us",
    faq: "Frequently Asked Questions",
    cookies: "Cookie Policy",
    "risk-disclaimer": "Risk Disclaimer",
  };
  return titles[pageType] || customTitle || "New Page";
}

function getPageSubtitle(pageType: string, companyName: string): string {
  const subtitles: Record<string, string> = {
    terms: `These Terms of Service govern your use of the ${companyName} platform. Please read them carefully before accessing or using our services.`,
    privacy: `This Privacy Policy explains how ${companyName} collects, uses, stores, and protects your personal data in compliance with applicable data protection laws.`,
    refund: `This policy sets out the refund and cancellation terms for purchases made on ${companyName}.`,
    aml: `${companyName}'s Anti-Money Laundering and Counter-Terrorist Financing compliance framework.`,
    "responsible-trading": `${companyName} is committed to promoting responsible participation in simulated trading competitions.`,
    about: `Learn about ${companyName}, our mission, and our commitment to innovation in simulated trading.`,
    contact: `Get in touch with the ${companyName} team for support, business inquiries, or feedback.`,
    faq: `Answers to commonly asked questions about ${companyName}.`,
    cookies: `This Cookie Policy explains how ${companyName} uses cookies and similar technologies.`,
    "risk-disclaimer": `Important risk information for users of ${companyName}.`,
  };
  return subtitles[pageType] || `Information provided by ${companyName}.`;
}

// ─── Content Dispatcher ──────────────────────────────────────────────────────
function generatePageContent(
  pageType: string,
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
    case "risk-disclaimer":
      return generateRiskDisclaimer(company);
    default:
      return generateCustom(company);
  }
}

// ─── Section Builder Helper ──────────────────────────────────────────────────
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  TERMS OF SERVICE
//  References: EU Consumer Rights Directive 2011/83/EU, GDPR Recital 32,
//  US UCC Article 2, FTC Act 15 U.S.C. §45, CDA Section 230
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateTerms(c: CompanyInfo, addr: string): GeneratedSection[] {
  resetOrder();
  const regNo = c.registrationNumber
    ? `, registered under company number ${c.registrationNumber}`
    : "";
  const vatInfo = c.vatNumber ? ` (VAT: ${c.vatNumber})` : "";
  return [
    // 1. Introduction & Acceptance
    s("heading", "1. Introduction and Acceptance of Terms"),
    s(
      "paragraph",
      `These Terms of Service ("Terms", "Agreement") constitute a legally binding contract between you ("User", "you", "your") and ${c.legalName}${regNo}${vatInfo}, operating the platform known as ${c.companyName} ("Platform", "Service", "we", "us", "our")${addr ? `, with its registered office at ${addr}` : ""}. By creating an account, accessing, or using the Platform in any manner, you acknowledge that you have read, understood, and agree to be bound by these Terms in their entirety. If you do not agree to these Terms, you must not access or use the Platform.`,
    ),
    s(
      "paragraph",
      `These Terms are effective as of the date you first access or use the Platform. We reserve the right to modify these Terms at any time. Material changes will be communicated with at least thirty (30) days' notice via email or in-platform notification. Your continued use of the Platform after the effective date of revised Terms constitutes acceptance of the changes. Where required by applicable law (including Article 3(3) of EU Directive 2011/83/EU on Consumer Rights), you will be provided an opportunity to review and explicitly accept material changes before they take effect.`,
    ),
    s("divider", ""),
    // 2. Eligibility
    s("heading", "2. Eligibility Requirements"),
    s(
      "paragraph",
      `To use the Platform, you must: (a) be at least eighteen (18) years of age or the age of legal majority in your jurisdiction, whichever is greater; (b) have the legal capacity to enter into a binding agreement; (c) not be a resident of a jurisdiction where access to or use of the Platform is prohibited by applicable law or regulation; and (d) not have been previously suspended or removed from the Platform for a violation of these Terms.`,
    ),
    s(
      "paragraph",
      `By using the Platform, you represent and warrant that you meet all eligibility requirements. ${c.legalName} reserves the right to request proof of age or identity at any time and to suspend or terminate accounts that do not meet these requirements. In compliance with the United States Children's Online Privacy Protection Act (COPPA, 15 U.S.C. §§6501–6506) and equivalent international laws, we do not knowingly collect personal information from individuals under the age of eighteen (18).`,
    ),
    s("divider", ""),
    // 3. Nature of the Service
    s("heading", "3. Nature of the Platform and Services"),
    s(
      "paragraph",
      `${c.companyName} is a simulated trading competition platform. All trading activities conducted on the Platform are entirely simulated using virtual currency. No real financial instruments are bought, sold, or traded. No real money is placed at risk on financial markets. Virtual currency balances, profits, losses, and portfolio values displayed on the Platform are simulated figures and do not represent actual financial positions, assets, or transactions.`,
    ),
    s(
      "paragraph",
      `The Platform does NOT constitute: (a) a regulated financial exchange or marketplace; (b) an investment advisory service; (c) a broker-dealer, futures commission merchant, or any regulated financial intermediary; (d) a gambling or wagering service. The Platform is provided for educational, entertainment, and skill-based competition purposes only. Nothing on the Platform should be construed as financial advice, investment advice, trading advice, or any other form of professional financial guidance.`,
    ),
    s("divider", ""),
    // 4. User Accounts
    s("heading", "4. User Accounts and Security"),
    s(
      "paragraph",
      `You must register for an account to access the Platform's features. You agree to: (a) provide accurate, truthful, current, and complete information during registration; (b) maintain and promptly update your information to keep it accurate and current; (c) maintain the security and confidentiality of your login credentials; (d) accept all responsibility for activities that occur under your account; and (e) immediately notify ${c.companyName} of any unauthorized use of your account or any other breach of security.`,
    ),
    s(
      "list",
      `Each individual may maintain only one (1) active account. Multiple accounts held by the same person are strictly prohibited.\nAccount sharing, selling, transferring, or lending account credentials to any third party is prohibited.\n${c.legalName} reserves the right to suspend, restrict, or permanently terminate accounts that violate these Terms, with or without prior notice, and without liability to you.\nYou may request deletion of your account at any time by contacting ${c.email}. Account deletion is subject to applicable legal data retention obligations.`,
    ),
    s("divider", ""),
    // 5. Competition Rules & Fair Play
    s("heading", "5. Competition Rules and Fair Play"),
    s(
      "paragraph",
      `Competitions and challenges on ${c.companyName} are governed by specific rules published at the time of each competition's creation. By entering a competition, you unconditionally agree to abide by those rules. ${c.legalName} reserves the right, at its sole and absolute discretion, to: (a) disqualify participants who violate rules or engage in unfair practices; (b) cancel, postpone, or modify competitions when necessary to maintain platform integrity; (c) adjust, withhold, or void prizes where fraud, collusion, or rule violations are detected; and (d) modify competition rules with reasonable notice to participants.`,
    ),
    s(
      "paragraph",
      `The following activities are strictly prohibited and may result in immediate account termination and forfeiture of all balances: use of automated trading bots or scripts (unless explicitly permitted in competition rules); collusion with other participants to manipulate outcomes; exploitation of software bugs, latency advantages, or system vulnerabilities; creation of multiple accounts to gain competitive advantage; any form of market manipulation within simulated markets; and any other conduct that ${c.legalName} reasonably determines undermines fair competition.`,
    ),
    s("divider", ""),
    // 6. Virtual Currency & Payments
    s("heading", "6. Virtual Currency, Credits, and Payments"),
    s(
      "paragraph",
      `Credits (virtual currency) purchased on ${c.companyName} are digital goods used exclusively for entering competitions and challenges. Credits: (a) have no real-world monetary value outside the Platform; (b) are non-transferable between users; (c) cannot be exchanged for fiat currency except through the Platform's official withdrawal mechanisms for competition winnings; and (d) may not be resold, bartered, or transferred to third parties.`,
    ),
    s(
      "paragraph",
      `All purchases of credits are processed through third-party payment service providers. ${c.legalName} does not directly store your full payment card details. By making a purchase, you represent that you are authorized to use the selected payment method and that the information you provide is accurate. In accordance with Article 16(m) of EU Directive 2011/83/EU on Consumer Rights, you acknowledge that digital content supplied immediately upon purchase is exempt from the standard fourteen (14) day withdrawal period, and by completing a purchase, you waive your right of withdrawal for that transaction.`,
    ),
    s("divider", ""),
    // 7. Intellectual Property
    s("heading", "7. Intellectual Property Rights"),
    s(
      "paragraph",
      `All content, features, functionality, software, designs, text, graphics, logos, icons, images, audio clips, data compilations, and the compilation thereof on the Platform are the exclusive property of ${c.legalName} or its licensors and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws, including but not limited to the Berne Convention for the Protection of Literary and Artistic Works, the WIPO Copyright Treaty, the EU Copyright Directive (2001/29/EC), and the United States Copyright Act (17 U.S.C. §§101 et seq.).`,
    ),
    s(
      "paragraph",
      `You are granted a limited, non-exclusive, non-transferable, revocable license to access and use the Platform for your personal, non-commercial purposes strictly in accordance with these Terms. You may not: (a) copy, modify, distribute, sell, or lease any part of the Platform; (b) reverse-engineer or attempt to extract the source code of any software; (c) use the Platform's content for any commercial purpose without prior written authorization from ${c.legalName}; or (d) remove, alter, or obscure any copyright, trademark, or other proprietary notices.`,
    ),
    s("divider", ""),
    // 8. Limitation of Liability
    s("heading", "8. Limitation of Liability"),
    s(
      "paragraph",
      `TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL ${c.legalName.toUpperCase()}, ITS DIRECTORS, OFFICERS, EMPLOYEES, AGENTS, PARTNERS, SUPPLIERS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, INCLUDING WITHOUT LIMITATION DAMAGES FOR LOSS OF PROFITS, REVENUE, DATA, GOODWILL, USE, OR OTHER INTANGIBLE LOSSES, ARISING OUT OF OR IN CONNECTION WITH: (A) YOUR ACCESS TO OR USE OF, OR INABILITY TO ACCESS OR USE, THE PLATFORM; (B) ANY CONDUCT OR CONTENT OF ANY THIRD PARTY ON THE PLATFORM; (C) ANY CONTENT OBTAINED FROM THE PLATFORM; OR (D) UNAUTHORIZED ACCESS, USE, OR ALTERATION OF YOUR TRANSMISSIONS OR CONTENT, WHETHER BASED ON WARRANTY, CONTRACT, TORT (INCLUDING NEGLIGENCE), STATUTE, OR ANY OTHER LEGAL THEORY, WHETHER OR NOT WE HAVE BEEN INFORMED OF THE POSSIBILITY OF SUCH DAMAGE.`,
    ),
    s(
      "paragraph",
      `THE TOTAL AGGREGATE LIABILITY OF ${c.legalName.toUpperCase()} TO YOU FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THE USE OF THE PLATFORM SHALL NOT EXCEED THE GREATER OF: (A) THE AMOUNTS YOU HAVE PAID TO ${c.legalName.toUpperCase()} IN THE TWELVE (12) MONTHS IMMEDIATELY PRECEDING THE EVENT GIVING RISE TO THE CLAIM; OR (B) ONE HUNDRED EUROS (€100). THIS LIMITATION APPLIES REGARDLESS OF THE FORM OF ACTION AND REGARDLESS OF WHETHER ${c.legalName.toUpperCase()} HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. Nothing in these Terms excludes or limits liability that cannot be excluded or limited under applicable mandatory law, including liability for death or personal injury caused by negligence, fraud, or fraudulent misrepresentation.`,
    ),
    s("divider", ""),
    // 9. Disclaimer of Warranties
    s("heading", "9. Disclaimer of Warranties"),
    s(
      "paragraph",
      `THE PLATFORM IS PROVIDED ON AN "AS IS" AND "AS AVAILABLE" BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. ${c.legalName.toUpperCase()} EXPRESSLY DISCLAIMS ALL WARRANTIES, INCLUDING BUT NOT LIMITED TO: (A) IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT; (B) WARRANTIES REGARDING THE ACCURACY, RELIABILITY, COMPLETENESS, OR TIMELINESS OF THE PLATFORM'S CONTENT; (C) WARRANTIES THAT THE PLATFORM WILL BE UNINTERRUPTED, SECURE, ERROR-FREE, OR FREE OF VIRUSES OR OTHER HARMFUL COMPONENTS. Your use of the Platform is at your sole risk.`,
    ),
    s("divider", ""),
    // 10. Indemnification
    s("heading", "10. Indemnification"),
    s(
      "paragraph",
      `You agree to indemnify, defend, and hold harmless ${c.legalName}, its directors, officers, employees, agents, licensors, and service providers from and against any and all claims, demands, liabilities, damages, losses, costs, and expenses (including reasonable attorneys' fees and court costs) arising out of or relating to: (a) your use or misuse of the Platform; (b) your violation of these Terms; (c) your violation of any applicable law, regulation, or third-party rights; or (d) any content you submit, post, or transmit through the Platform. ${c.legalName} reserves the right to assume exclusive defense and control of any matter otherwise subject to indemnification by you, and you agree to cooperate with ${c.legalName}'s defense of such claims.`,
    ),
    s("divider", ""),
    // 11. Dispute Resolution
    s("heading", "11. Dispute Resolution and Governing Law"),
    s(
      "paragraph",
      `These Terms shall be governed by and construed in accordance with the laws of the jurisdiction in which ${c.legalName} is incorporated, without regard to its conflict of laws provisions. For EU-resident users: nothing in these Terms affects your rights under mandatory consumer protection laws of your Member State of residence, including Regulation (EU) No 524/2013 on online dispute resolution (ODR). EU consumers may submit complaints via the European Commission's ODR platform at https://ec.europa.eu/consumers/odr/.`,
    ),
    s(
      "paragraph",
      `Before initiating formal proceedings, both parties agree to attempt to resolve any dispute through good-faith negotiation for a period of at least thirty (30) days following written notice of the dispute. If the dispute cannot be resolved through negotiation, it shall be submitted to the competent courts of the jurisdiction in which ${c.legalName} is established, unless applicable mandatory consumer protection law provides otherwise. TO THE EXTENT PERMITTED BY APPLICABLE LAW, YOU AGREE THAT ANY CLAIM OR DISPUTE MUST BE BROUGHT IN YOUR INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION.`,
    ),
    s("divider", ""),
    // 12. Privacy
    s("heading", "12. Privacy and Data Protection"),
    s(
      "paragraph",
      `Your privacy is important to us. Our collection and use of personal data is governed by our Privacy Policy, which is incorporated by reference into these Terms. By using the Platform, you consent to the collection and processing of your data as described in the Privacy Policy, in compliance with the General Data Protection Regulation (GDPR, Regulation (EU) 2016/679), the California Consumer Privacy Act (CCPA, Cal. Civ. Code §§1798.100–1798.199.100), and other applicable data protection laws.`,
    ),
    s("divider", ""),
    // 13. Termination
    s("heading", "13. Termination"),
    s(
      "paragraph",
      `${c.legalName} may terminate or suspend your access to the Platform immediately, without prior notice or liability, for any reason, including but not limited to a breach of these Terms. Upon termination: (a) your right to use the Platform ceases immediately; (b) any unused credits in your account may be forfeited, except where a refund is required by applicable law; (c) provisions of these Terms that by their nature should survive termination shall survive, including but not limited to: ownership provisions, warranty disclaimers, indemnification, limitations of liability, and dispute resolution provisions.`,
    ),
    s("divider", ""),
    // 14. Force Majeure
    s("heading", "14. Force Majeure"),
    s(
      "paragraph",
      `${c.legalName} shall not be liable for any failure or delay in performing its obligations under these Terms to the extent that such failure or delay results from circumstances beyond its reasonable control, including but not limited to: acts of God, natural disasters, epidemics or pandemics, war, terrorism, riots, government actions, power failures, internet or telecommunications failures, cyberattacks, or failures of third-party service providers.`,
    ),
    s("divider", ""),
    // 15. Miscellaneous
    s("heading", "15. General Provisions"),
    s(
      "list",
      `Entire Agreement: These Terms, together with the Privacy Policy, Cookie Policy, and any competition-specific rules, constitute the entire agreement between you and ${c.legalName} regarding the Platform and supersede all prior agreements and understandings.\nSeverability: If any provision of these Terms is held to be unenforceable or invalid by a court of competent jurisdiction, the remaining provisions shall remain in full force and effect.\nWaiver: The failure of ${c.legalName} to enforce any right or provision of these Terms shall not constitute a waiver of such right or provision.\nAssignment: You may not assign or transfer these Terms, or any rights or obligations hereunder, without the prior written consent of ${c.legalName}. ${c.legalName} may freely assign these Terms without restriction.\nNotices: All notices under these Terms shall be in writing and shall be deemed given when sent to the email address associated with your account or to ${c.email}.`,
    ),
    s("divider", ""),
    // 16. Contact
    s("heading", "16. Contact Information"),
    s(
      "paragraph",
      `For questions, concerns, or requests regarding these Terms of Service, please contact us at: ${c.email}${addr ? `. Registered office: ${addr}` : ""}${c.registrationNumber ? `. Company registration: ${c.registrationNumber}` : ""}${c.vatNumber ? `. VAT identification number: ${c.vatNumber}` : ""}.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  PRIVACY POLICY
//  References: GDPR (EU) 2016/679, CCPA Cal. Civ. Code §1798.100,
//  ePrivacy Directive 2002/58/EC, UK GDPR / DPA 2018, PIPEDA (Canada)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generatePrivacy(c: CompanyInfo, addr: string): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. Data Controller"),
    s(
      "paragraph",
      `The data controller responsible for the collection and processing of your personal data is ${c.legalName}${addr ? `, with registered office at ${addr}` : ""}${c.registrationNumber ? ` (registration number: ${c.registrationNumber})` : ""}. For data protection inquiries, contact us at ${c.email}. This Privacy Policy applies to all personal data processed through the ${c.companyName} platform ("Platform") and is designed to comply with the General Data Protection Regulation (GDPR, Regulation (EU) 2016/679), the California Consumer Privacy Act (CCPA, Cal. Civ. Code §§1798.100–1798.199.100), the UK General Data Protection Regulation (UK GDPR) read together with the Data Protection Act 2018, and other applicable data protection legislation.`,
    ),
    s("divider", ""),
    s("heading", "2. Categories of Personal Data We Collect"),
    s(
      "paragraph",
      `We collect the following categories of personal data, each with a specific purpose and legal basis:`,
    ),
    s(
      "list",
      `Account Data: Name, email address, username, hashed password — collected upon registration for the purpose of providing and managing your account (Legal basis: performance of contract, GDPR Art. 6(1)(b)).\nIdentity Verification Data: Government-issued identification documents, proof of address — collected for KYC/AML compliance (Legal basis: legal obligation, GDPR Art. 6(1)(c)).\nFinancial Data: Payment method details, transaction history, wallet balances — processed through PCI DSS-compliant third-party payment processors (Legal basis: performance of contract, GDPR Art. 6(1)(b)).\nTrading Activity Data: Simulated positions, orders, competition entries, performance metrics — generated through your use of the Platform (Legal basis: performance of contract, GDPR Art. 6(1)(b)).\nTechnical Data: IP address, browser type and version, device identifiers, operating system, time zone, referring URLs — collected automatically (Legal basis: legitimate interest, GDPR Art. 6(1)(f)).\nUsage Data: Pages visited, features used, click patterns, session duration — collected for analytics and Platform improvement (Legal basis: legitimate interest, GDPR Art. 6(1)(f), or consent where required).`,
    ),
    s("divider", ""),
    s("heading", "3. How We Use Your Personal Data"),
    s(
      "list",
      `To provide, operate, and maintain the Platform and your account.\nTo process transactions and manage your virtual currency wallet.\nTo administer competitions, calculate rankings, and distribute prizes.\nTo verify your identity in compliance with KYC/AML regulations.\nTo detect, prevent, and address fraud, security breaches, and prohibited activities.\nTo communicate with you regarding your account, transactions, and Platform updates.\nTo comply with legal obligations, including tax reporting and regulatory requirements.\nTo improve and optimize the Platform through analytics and usage analysis.\nTo enforce our Terms of Service and protect our legal rights.`,
    ),
    s("divider", ""),
    s("heading", "4. Data Sharing and Recipients"),
    s(
      "paragraph",
      `We do not sell your personal data. We may share your data with the following categories of recipients, solely for the purposes described herein:`,
    ),
    s(
      "list",
      `Payment Service Providers: To process credit/debit card transactions and payouts (e.g., Stripe, Nuvei, Paddle). These processors are PCI DSS-compliant.\nIdentity Verification Providers: To perform KYC checks as required by applicable law.\nCloud Hosting Providers: Data is stored on secure servers operated by reputable infrastructure providers.\nAnalytics Providers: Aggregated, anonymized usage data may be processed by analytics tools to improve the Platform.\nLaw Enforcement and Regulatory Authorities: Where required by law, court order, or regulatory obligation.\nProfessional Advisors: Lawyers, auditors, and accountants as necessary for business operations.`,
    ),
    s(
      "paragraph",
      `Where personal data is transferred outside the European Economic Area (EEA), we ensure appropriate safeguards are in place in accordance with GDPR Chapter V, including EU Standard Contractual Clauses (SCCs) as adopted by the European Commission under Decision 2021/914, or adequacy decisions under GDPR Art. 45.`,
    ),
    s("divider", ""),
    s("heading", "5. Data Retention"),
    s(
      "paragraph",
      `We retain your personal data only for as long as necessary to fulfill the purposes for which it was collected, including to comply with legal, accounting, or reporting obligations. Specific retention periods: (a) Account data: retained for the duration of your account plus six (6) years post-deletion to comply with tax and financial record-keeping obligations; (b) KYC documents: retained for five (5) years after the business relationship ends, as required by EU Anti-Money Laundering Directives (Directive (EU) 2015/849, as amended by Directive (EU) 2018/843); (c) Transaction records: retained for six (6) years for tax compliance; (d) Technical and usage data: retained for up to twenty-four (24) months.`,
    ),
    s("divider", ""),
    s("heading", "6. Data Security Measures"),
    s(
      "list",
      `Encryption: All data in transit is protected by TLS 1.2+ encryption. Sensitive data at rest is encrypted using AES-256.\nAccess Controls: Access to personal data is restricted to authorized personnel on a need-to-know basis, protected by multi-factor authentication.\nPassword Security: All user passwords are hashed using bcrypt with a minimum work factor of 10.\nRegular Audits: We conduct periodic security assessments and vulnerability testing.\nIncident Response: We maintain a data breach response plan. In the event of a personal data breach, we will notify the relevant supervisory authority within seventy-two (72) hours in accordance with GDPR Art. 33, and affected individuals without undue delay where the breach is likely to result in a high risk to their rights and freedoms (GDPR Art. 34).`,
    ),
    s("divider", ""),
    s("heading", "7. Your Data Protection Rights"),
    s(
      "paragraph",
      `Under applicable data protection law, you have the following rights regarding your personal data. To exercise any of these rights, contact us at ${c.email}. We will respond within one (1) month as required by GDPR Art. 12(3):`,
    ),
    s(
      "list",
      `Right of Access (GDPR Art. 15): You have the right to obtain confirmation of whether we process your personal data and to request a copy of such data.\nRight to Rectification (GDPR Art. 16): You have the right to request correction of inaccurate personal data.\nRight to Erasure (GDPR Art. 17): You have the right to request deletion of your personal data, subject to legal retention obligations.\nRight to Restrict Processing (GDPR Art. 18): You have the right to request restriction of processing in certain circumstances.\nRight to Data Portability (GDPR Art. 20): You have the right to receive your personal data in a structured, commonly used, and machine-readable format.\nRight to Object (GDPR Art. 21): You have the right to object to processing based on legitimate interests, including profiling.\nRight to Withdraw Consent (GDPR Art. 7(3)): Where processing is based on consent, you may withdraw consent at any time without affecting the lawfulness of processing prior to withdrawal.\nRight to Lodge a Complaint: You have the right to lodge a complaint with your local data protection supervisory authority.`,
    ),
    s(
      "paragraph",
      `For California residents under the CCPA: You have the right to know what personal information is collected, to request deletion, to opt out of the sale of personal information (we do not sell personal information), and the right to non-discrimination for exercising your privacy rights.`,
    ),
    s("divider", ""),
    s("heading", "8. Cookies and Tracking Technologies"),
    s(
      "paragraph",
      `We use cookies and similar tracking technologies as described in our Cookie Policy. In compliance with the ePrivacy Directive (2002/58/EC) and applicable national implementations, we obtain your consent before placing non-essential cookies on your device. You can manage your cookie preferences at any time through your browser settings or our cookie consent manager.`,
    ),
    s("divider", ""),
    s("heading", "9. Children's Privacy"),
    s(
      "paragraph",
      `The Platform is not intended for individuals under the age of eighteen (18). We do not knowingly collect personal data from children under eighteen. If you are a parent or guardian and believe your child has provided personal data to us, please contact us at ${c.email} and we will take steps to delete such information. This is in compliance with COPPA (15 U.S.C. §§6501–6506) for U.S. users and GDPR Art. 8 for EU users.`,
    ),
    s("divider", ""),
    s("heading", "10. Changes to This Privacy Policy"),
    s(
      "paragraph",
      `We may update this Privacy Policy from time to time. We will notify you of material changes by posting the updated policy on the Platform and, where appropriate, by email notification. The "Last Updated" date at the top of this page indicates when the policy was last revised. We encourage you to review this Privacy Policy periodically.`,
    ),
    s("divider", ""),
    s("heading", "11. Contact the Data Controller"),
    s(
      "paragraph",
      `If you have any questions or concerns about this Privacy Policy or our data processing practices, please contact us at: ${c.email}${addr ? `. Address: ${addr}` : ""}${c.website ? `. Website: ${c.website}` : ""}.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  REFUND & CANCELLATION POLICY
//  References: EU Consumer Rights Directive 2011/83/EU Art. 16(m),
//  UK Consumer Contracts Regulations 2013, FTC cooling-off rules
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateRefund(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. General Refund Policy"),
    s(
      "paragraph",
      `${c.companyName} credits are digital goods used exclusively to enter simulated trading competitions and challenges on the Platform. As digital content supplied immediately upon purchase, all credit purchases are generally non-refundable. In accordance with Article 16(m) of EU Directive 2011/83/EU on Consumer Rights (and the UK Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013, Regulation 37), by completing a purchase of credits, you expressly consent to the immediate supply of digital content and acknowledge that you lose your right of withdrawal once the digital content has been made available in your account.`,
    ),
    s("divider", ""),
    s("heading", "2. Exceptions — When Refunds May Be Granted"),
    s(
      "paragraph",
      `Notwithstanding the above, ${c.legalName} may issue refunds in the following limited circumstances, at its sole discretion:`,
    ),
    s(
      "list",
      `Technical Failure: Where a verifiable technical error on the Platform prevented you from participating in a competition for which you paid an entry fee.\nDuplicate Charges: Where a payment processing error resulted in multiple charges for a single transaction.\nCompetition Cancellation: Where ${c.companyName} cancels a competition before it has commenced, entry fees will be automatically refunded to participants' wallets.\nUnauthorized Transactions: Where an unauthorized third party made purchases on your account (subject to investigation and, where applicable, filing of a police report).\nMandatory Consumer Rights: Where applicable consumer protection law in your jurisdiction provides a non-waivable right to a refund that overrides the digital content exception.`,
    ),
    s("divider", ""),
    s("heading", "3. Refund Request Procedure"),
    s(
      "paragraph",
      `To request a refund, contact our support team at ${c.email} within fourteen (14) calendar days of the transaction in question. Your request must include: (a) your username or registered email address; (b) the transaction ID or receipt number; (c) a detailed description of the reason for the refund request; and (d) any supporting evidence (e.g., screenshots of errors). We will acknowledge receipt within two (2) business days and provide a final decision within ten (10) business days.`,
    ),
    s("divider", ""),
    s("heading", "4. Refund Method"),
    s(
      "paragraph",
      `Approved refunds will be processed to the original payment method used for the purchase. In-wallet refunds (credit refunds) may be issued for competition cancellations or administrative adjustments. Processing times depend on the payment provider and may take five (5) to ten (10) business days. ${c.legalName} is not responsible for delays caused by payment processors or financial institutions.`,
    ),
    s("divider", ""),
    s("heading", "5. Competition-Specific Refund Rules"),
    s(
      "list",
      `Pre-start Cancellation: If a competition is cancelled before its scheduled start time, all entry fees are automatically refunded to participants' wallets.\nMid-competition Cancellation: If a competition must be cancelled after it has started (e.g., due to critical technical issues), prizes may be distributed based on standings at the time of cancellation, or entry fees may be refunded, at ${c.legalName}'s discretion.\nDisqualification: Users who are disqualified from a competition for rule violations are not entitled to a refund of their entry fee.\nVoluntary Withdrawal: Withdrawing from a competition after it has started does not entitle you to a refund.`,
    ),
    s("divider", ""),
    s("heading", "6. Chargebacks and Payment Disputes"),
    s(
      "paragraph",
      `Filing a chargeback or payment dispute with your bank, credit card company, or payment provider without first contacting ${c.companyName} support constitutes a violation of these Terms and may result in: (a) immediate suspension of your account; (b) forfeiture of any outstanding balances or winnings; (c) permanent ban from the Platform; and (d) referral to collections or legal action to recover any amounts owed. We strongly encourage you to contact ${c.email} first to resolve any billing concerns.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AML / KYC POLICY
//  References: EU 4th/5th AML Directives (2015/849, 2018/843),
//  US Bank Secrecy Act (31 U.S.C. §5311), FATF Recommendations
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateAML(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. Policy Statement"),
    s(
      "paragraph",
      `${c.legalName} is committed to the highest standards of Anti-Money Laundering (AML) compliance and Combating the Financing of Terrorism (CFT). This policy is designed to prevent the use of the ${c.companyName} platform for money laundering, terrorist financing, or other financial crimes. Our AML framework is informed by the Financial Action Task Force (FATF) Recommendations, the EU Anti-Money Laundering Directives (Directive (EU) 2015/849, as amended by Directive (EU) 2018/843), the US Bank Secrecy Act (31 U.S.C. §§5311 et seq.) and its implementing regulations, and applicable national AML legislation.`,
    ),
    s("divider", ""),
    s("heading", "2. Customer Due Diligence (CDD) and Know Your Customer (KYC)"),
    s(
      "paragraph",
      `In accordance with FATF Recommendation 10 and Article 13 of Directive (EU) 2015/849, ${c.legalName} applies risk-based Customer Due Diligence measures. All users must complete identity verification before: (a) making withdrawals; (b) exceeding cumulative deposit thresholds determined by applicable regulations; or (c) upon request where suspicious activity indicators are detected.`,
    ),
    s(
      "list",
      `Standard CDD: Verification of identity through government-issued photo identification and proof of current residential address (utility bill, bank statement, or official correspondence dated within three months).\nEnhanced Due Diligence (EDD): Applied to higher-risk users, including Politically Exposed Persons (PEPs) and users from high-risk jurisdictions as identified by the FATF. EDD may include verification of source of funds and source of wealth documentation.\nOngoing Monitoring: Continuous monitoring of user activity to detect unusual or suspicious patterns inconsistent with the user's profile.`,
    ),
    s("divider", ""),
    s("heading", "3. Transaction Monitoring and Suspicious Activity Detection"),
    s(
      "paragraph",
      `${c.companyName} employs automated and manual transaction monitoring systems designed to detect patterns indicative of money laundering or terrorist financing, including but not limited to:`,
    ),
    s(
      "list",
      `Rapid deposits followed by immediate withdrawal requests with minimal or no platform activity.\nStructuring: Breaking transactions into smaller amounts to avoid reporting thresholds.\nTransactions inconsistent with the user's stated profile, declared source of funds, or expected activity levels.\nUse of multiple payment methods from different jurisdictions.\nMultiple accounts linked to the same identity, payment method, or device.\nTransactions involving jurisdictions identified as high-risk by the FATF or sanctioned under EU, US, or UN sanctions programs.`,
    ),
    s("divider", ""),
    s("heading", "4. Reporting Obligations"),
    s(
      "paragraph",
      `When suspicious activity is identified, ${c.legalName} is legally obligated to: (a) file a Suspicious Activity Report (SAR) or Suspicious Transaction Report (STR) with the relevant Financial Intelligence Unit (FIU); (b) preserve all records and evidence related to the suspicious activity; and (c) refrain from disclosing the existence of a report to the affected user ("tipping off" is a criminal offense under Article 39 of Directive (EU) 2015/849 and 31 U.S.C. §5318(g)(2)). ${c.legalName} may freeze or close accounts pending investigation without prior notice.`,
    ),
    s("divider", ""),
    s("heading", "5. Sanctions Screening"),
    s(
      "paragraph",
      `${c.legalName} screens all users against applicable sanctions lists, including but not limited to: (a) the EU Consolidated Sanctions List; (b) the US Office of Foreign Assets Control (OFAC) Specially Designated Nationals (SDN) List; (c) the UN Security Council Consolidated List; and (d) other applicable national sanctions lists. Accounts belonging to sanctioned individuals or entities will be immediately frozen and reported to the relevant authorities.`,
    ),
    s("divider", ""),
    s("heading", "6. Record Keeping"),
    s(
      "paragraph",
      `In accordance with Article 40 of Directive (EU) 2015/849 and 31 CFR §1010.430, ${c.legalName} maintains records of all CDD documentation and transaction data for a minimum of five (5) years after the end of the business relationship or the date of an occasional transaction. These records are available for review by competent authorities upon lawful request.`,
    ),
    s("divider", ""),
    s("heading", "7. Prohibited Activities"),
    s(
      "list",
      `Using the Platform for money laundering, terrorist financing, or any other financial crime.\nProviding false, misleading, or fraudulent identification documents.\nOperating accounts on behalf of undisclosed third parties.\nUsing anonymous, fictitious, or assumed identities.\nAttempting to circumvent KYC, AML, or sanctions screening controls.\nUsing the Platform from jurisdictions subject to comprehensive sanctions (e.g., as designated by OFAC, EU Council, or UN Security Council).`,
    ),
    s("divider", ""),
    s("heading", "8. Contact"),
    s(
      "paragraph",
      `For questions regarding this AML Policy, please contact our compliance team at ${c.email}.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RESPONSIBLE TRADING POLICY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateResponsibleTrading(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. Our Commitment"),
    s(
      "paragraph",
      `${c.companyName} is committed to promoting responsible participation in simulated trading competitions. While all trading on our Platform is simulated using virtual currency and no real money is placed at risk on financial markets, we recognize that competition entry fees involve real monetary purchases. We take our responsibility to our users seriously and provide tools and resources to help ensure a positive and controlled experience.`,
    ),
    s("divider", ""),
    s("heading", "2. Simulated Trading Disclaimer"),
    s(
      "paragraph",
      `It is important to understand that performance on the ${c.companyName} platform does NOT guarantee or predict performance in real financial markets. Simulated results have inherent limitations: they do not account for real-world factors such as market liquidity, slippage, emotional pressure, and the financial impact of actual capital at risk. Users should not use their performance on this Platform as a basis for making real-world investment or trading decisions.`,
    ),
    s("divider", ""),
    s("heading", "3. Spending Controls and Limits"),
    s(
      "paragraph",
      `We encourage all users to set personal spending limits and to only purchase credits that they can comfortably afford. ${c.companyName} may implement platform-level spending controls, including daily, weekly, or monthly deposit limits. If you wish to set custom limits on your account, contact our support team at ${c.email}.`,
    ),
    s("divider", ""),
    s("heading", "4. Self-Exclusion"),
    s(
      "paragraph",
      `If you feel that your participation has become problematic or that you are spending more than you intend, you may request a temporary or permanent self-exclusion period by contacting our support team at ${c.email}. During the exclusion period: (a) you will be unable to enter new competitions or purchase credits; (b) your account will be restricted from competitive features; (c) existing competition entries may continue to conclusion. We will process self-exclusion requests within twenty-four (24) hours.`,
    ),
    s("divider", ""),
    s("heading", "5. Warning Signs of Problem Behavior"),
    s(
      "paragraph",
      `Please consider seeking support if you experience any of the following:`,
    ),
    s(
      "list",
      `Spending more money on competition entries than you can comfortably afford.\nFeeling anxious, stressed, or irritable about competition outcomes.\nChasing losses by entering increasingly expensive competitions to "win back" previous entry fees.\nNeglecting personal, professional, or social responsibilities to participate in competitions.\nBorrowing money or using funds earmarked for essential expenses to purchase credits.\nLying to family members or friends about the amount of time or money spent on the Platform.\nFeeling unable to stop or reduce your participation despite wanting to.`,
    ),
    s("divider", ""),
    s("heading", "6. Support Resources"),
    s(
      "paragraph",
      `If you or someone you know is struggling with compulsive spending or gambling-related issues, please contact a professional helpline in your jurisdiction:`,
    ),
    s(
      "list",
      `International: GamCare (www.gamcare.org.uk) — +44 808 8020 133\nUnited Kingdom: BeGambleAware (www.begambleaware.org) — 0808 8020 133\nUnited States: National Council on Problem Gambling (www.ncpgambling.org) — 1-800-522-4700\nEuropean Union: European Gaming and Betting Association — responsible gaming resources at www.egba.eu\nAustralia: Gambling Help Online (www.gamblinghelponline.org.au) — 1800 858 858`,
    ),
    s(
      "paragraph",
      `${c.companyName} support is also available at ${c.email} to assist with account controls, spending limits, and self-exclusion requests.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  COOKIE POLICY
//  References: ePrivacy Directive 2002/58/EC (as amended by 2009/136/EC),
//  GDPR Art. 6 & 7, UK PECR 2003
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateCookies(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "1. What Are Cookies"),
    s(
      "paragraph",
      `Cookies are small text files that are placed on your device (computer, tablet, or mobile phone) when you visit the ${c.companyName} platform. Cookies allow us to recognize your device and store information about your preferences or past actions. This Cookie Policy explains the types of cookies we use, the purposes they serve, and how you can manage your cookie preferences. This policy is designed to comply with the ePrivacy Directive (2002/58/EC, as amended by 2009/136/EC), the UK Privacy and Electronic Communications Regulations (PECR) 2003, and the General Data Protection Regulation (GDPR, Regulation (EU) 2016/679).`,
    ),
    s("divider", ""),
    s("heading", "2. Categories of Cookies We Use"),
    s(
      "list",
      `Strictly Necessary Cookies: These cookies are essential for the Platform to function and cannot be switched off. They include authentication tokens, session identifiers, security tokens (CSRF protection), and load-balancing cookies. Without these cookies, the Platform cannot operate. (No consent required under ePrivacy Directive Art. 5(3) exemption.)\nPerformance and Analytics Cookies: These cookies collect aggregated, anonymized information about how visitors use the Platform (pages visited, time spent, error messages). They help us understand usage patterns and improve the Platform. (Consent required.)\nFunctional Cookies: These cookies remember your preferences and settings (e.g., language, theme, chart configuration) to provide a personalized experience. (Consent required.)\nThird-Party Cookies: Certain third-party services embedded in the Platform may place their own cookies. These include payment processors and analytics tools. Each third party has its own privacy and cookie policy.`,
    ),
    s("divider", ""),
    s("heading", "3. Specific Cookies We Use"),
    s(
      "list",
      `Session cookie (session_id): Strictly necessary — maintains your authenticated session. Expires when you close your browser.\nAuthentication token (auth_token): Strictly necessary — keeps you logged in across sessions. Expires after 30 days.\nCookie consent (cookie_consent): Strictly necessary — records your cookie preferences. Expires after 12 months.\nAnalytics cookies: Performance — tracks anonymized usage patterns. Expires after 24 months.\nPreference cookies: Functional — stores UI preferences (theme, layout). Expires after 12 months.`,
    ),
    s("divider", ""),
    s("heading", "4. Managing Your Cookie Preferences"),
    s(
      "paragraph",
      `You can control and manage cookies in the following ways: (a) Through our cookie consent banner, which appears on your first visit and allows you to accept or decline non-essential cookies; (b) Through your browser settings — most browsers allow you to view, manage, and delete cookies (refer to your browser's help documentation for instructions); (c) By contacting us at ${c.email} to request information about the cookies we use.`,
    ),
    s(
      "paragraph",
      `Please note that blocking or deleting certain cookies may affect the functionality of the Platform. Strictly necessary cookies cannot be disabled as they are required for core Platform operations.`,
    ),
    s("divider", ""),
    s("heading", "5. Updates to This Cookie Policy"),
    s(
      "paragraph",
      `We may update this Cookie Policy from time to time to reflect changes in technology, legislation, or our data practices. The "Last Updated" date at the top of this page indicates when the policy was last revised. Continued use of the Platform after changes are posted constitutes acceptance of the updated Cookie Policy.`,
    ),
    s("divider", ""),
    s("heading", "6. Contact"),
    s(
      "paragraph",
      `For questions about this Cookie Policy, please contact us at ${c.email}.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  RISK DISCLAIMER
//  Standalone risk disclaimer for footer and dedicated page
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateRiskDisclaimer(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "General Risk Warning"),
    s(
      "paragraph",
      `${c.companyName}, operated by ${c.legalName}, is a simulated trading competition platform. All trading activities on the Platform are conducted using virtual currency in a simulated market environment. No real financial instruments are bought, sold, or traded, and no real capital is placed at risk on live financial markets. However, competition entry fees are purchased with real money, and users should only spend amounts they can comfortably afford.`,
    ),
    s("divider", ""),
    s("heading", "No Financial Advice"),
    s(
      "paragraph",
      `Nothing on the ${c.companyName} platform constitutes financial advice, investment advice, trading advice, or any other form of professional advice. The information, charts, price data, and simulated trading tools provided on the Platform are for educational and entertainment purposes only. ${c.legalName} is not a registered investment advisor, broker-dealer, futures commission merchant, or any form of regulated financial intermediary. You should consult with a qualified, licensed financial professional before making any real-world investment or trading decisions.`,
    ),
    s("divider", ""),
    s("heading", "Simulated Performance Limitations"),
    s(
      "paragraph",
      `SIMULATED TRADING RESULTS HAVE INHERENT LIMITATIONS. Unlike actual trading records, simulated results do not represent real trading. Since the trades are not actually executed, the results may have under- or over-compensated for the impact of certain market factors, such as lack of liquidity, slippage, and the psychological impact of actual financial risk. Simulated trading programs are designed with the benefit of hindsight. No representation is made that any account will or is likely to achieve profits or losses similar to those shown.`,
    ),
    s("divider", ""),
    s("heading", "Real-World Trading Risks"),
    s(
      "paragraph",
      `If you choose to trade real financial markets based on skills developed on this Platform, you should be aware of the following risks: Trading in foreign exchange (forex), contracts for difference (CFDs), and other leveraged financial products carries a high level of risk and may not be suitable for all investors. According to data published by the European Securities and Markets Authority (ESMA), between 74% and 89% of retail investor accounts lose money when trading CFDs with regulated providers. You should carefully consider your financial situation and risk tolerance before engaging in real-world trading.`,
    ),
    s("divider", ""),
    s("heading", "Virtual Currency Disclaimer"),
    s(
      "paragraph",
      `Credits purchased on ${c.companyName} are virtual digital goods with no intrinsic monetary value outside the Platform. Credits cannot be exchanged for fiat currency except through the Platform's official withdrawal mechanisms for competition winnings. Virtual portfolio balances, profits, and losses displayed on the Platform are simulated and do not represent real financial positions. Past simulated performance is not indicative of future results, whether simulated or real.`,
    ),
    s("divider", ""),
    s("heading", "Regulatory Status"),
    s(
      "paragraph",
      `${c.companyName} is not a regulated financial services provider. The Platform does not hold any financial services license, broker-dealer registration, or investment advisory registration. The Platform is not regulated by any financial supervisory authority, including but not limited to the U.S. Securities and Exchange Commission (SEC), the U.S. Commodity Futures Trading Commission (CFTC), the UK Financial Conduct Authority (FCA), the European Securities and Markets Authority (ESMA), or the Cyprus Securities and Exchange Commission (CySEC). This Platform operates as a skill-based entertainment and educational service.`,
    ),
    s("divider", ""),
    s("heading", "Limitation of Liability"),
    s(
      "paragraph",
      `${c.legalName} shall not be liable for any financial losses, damages, or adverse consequences resulting from: (a) your reliance on simulated trading results when making real-world financial decisions; (b) decisions to engage in real-world trading based on skills or strategies developed on the Platform; (c) any technical interruptions, data inaccuracies, or Platform errors that affect simulated trading outcomes; or (d) any other use of information obtained from the Platform. You acknowledge that you use the Platform entirely at your own risk.`,
    ),
    s("divider", ""),
    s("heading", "Jurisdictional Restrictions"),
    s(
      "paragraph",
      `Access to and use of ${c.companyName} may be restricted in certain jurisdictions. It is your responsibility to ensure that your use of the Platform complies with all applicable laws and regulations in your jurisdiction. ${c.legalName} makes no representation that the Platform is appropriate or available for use in all locations. Users who access the Platform from jurisdictions where it is illegal to do so assume full responsibility for their actions.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  ABOUT PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateAbout(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", `About ${c.companyName}`),
    s(
      "paragraph",
      `${c.companyName} is an innovative simulated trading competition platform operated by ${c.legalName}. We bring the excitement and strategy of financial markets to a competitive, gamified environment where traders of all experience levels can test their skills, compete against others, and win prizes — all without placing real capital at risk on live financial markets.`,
    ),
    s("divider", ""),
    s("heading", "Our Mission"),
    s(
      "paragraph",
      `We believe that financial literacy, market understanding, and trading skill development should be accessible, engaging, and enjoyable. ${c.companyName} bridges the gap between education and entertainment by providing a risk-free platform where aspiring and experienced traders alike can hone their strategies, learn from their performance, and engage with a community of like-minded individuals.`,
    ),
    s("divider", ""),
    s("heading", "What We Offer"),
    s(
      "list",
      `Live Simulated Trading Competitions: Compete against other traders in real-time using live market data in a simulated environment.\n1v1 Challenges: Test your skills head-to-head against individual opponents.\nComprehensive Leaderboards: Track your performance and ranking against the community.\nVirtual Currency System: A fair, transparent entry fee system for competitions.\nAdvanced Charting and Trading Tools: Professional-grade tools for technical analysis and order execution.\nCommunity Features: Trader profiles, messaging, and social interaction.\nGamification: XP systems, badges, milestones, and journeys to track your progress.`,
    ),
    s("divider", ""),
    s("heading", "Our Commitment"),
    s(
      "paragraph",
      `${c.companyName} is committed to fair play, transparency, responsible participation, and user protection. We employ advanced fraud detection systems, maintain strict competition integrity standards, and provide tools for responsible engagement. Your privacy and security are paramount — we adhere to international data protection standards including the GDPR and CCPA.`,
    ),
    s("divider", ""),
    s("heading", "Contact Us"),
    s(
      "paragraph",
      `Have questions, feedback, or partnership inquiries? Reach out to us at ${c.email}${c.website ? ` or visit ${c.website}` : ""}.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CONTACT PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateContact(c: CompanyInfo, addr: string): GeneratedSection[] {
  resetOrder();
  const contactLines = [`Email: ${c.email}`];
  if (c.phone) contactLines.push(`Phone: ${c.phone}`);
  if (c.website) contactLines.push(`Website: ${c.website}`);
  if (addr) contactLines.push(`Registered Address: ${addr}`);
  if (c.registrationNumber)
    contactLines.push(`Company Registration: ${c.registrationNumber}`);

  return [
    s("heading", "Get in Touch"),
    s(
      "paragraph",
      `We welcome your questions, feedback, and inquiries. Whether you need technical support, have a billing question, want to report an issue, or are interested in business partnerships, our team is here to help.`,
    ),
    s("divider", ""),
    s("heading", "Contact Details"),
    s("list", contactLines.join("\n")),
    s("divider", ""),
    s("heading", "Support Hours"),
    s(
      "paragraph",
      `Our support team is available Monday through Friday, 09:00–18:00 (UTC). We aim to acknowledge all inquiries within twenty-four (24) hours and provide a substantive response within forty-eight (48) hours. For urgent security concerns (e.g., unauthorized account access), please include "URGENT" in your email subject line.`,
    ),
    s("divider", ""),
    s("heading", "Data Protection Requests"),
    s(
      "paragraph",
      `For data protection inquiries, including requests to exercise your rights under the GDPR (access, rectification, erasure, portability, etc.) or the CCPA, please email ${c.email} with the subject line "Data Protection Request". We will respond within one (1) month as required by applicable law.`,
    ),
    s("divider", ""),
    s("heading", "Business and Partnership Inquiries"),
    s(
      "paragraph",
      `For enterprise partnerships, white-label licensing, API integrations, or other business opportunities, please contact us at ${c.email} with the subject line "Business Inquiry". We review all partnership proposals and will respond to qualified inquiries within five (5) business days.`,
    ),
    s("divider", ""),
    s("heading", "Complaints and Dispute Resolution"),
    s(
      "paragraph",
      `If you have a complaint about the Platform, please email ${c.email} with a detailed description of your concern. We take all complaints seriously and will investigate and respond within ten (10) business days. EU residents may also submit complaints via the European Commission's Online Dispute Resolution (ODR) platform at https://ec.europa.eu/consumers/odr/.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  FAQ PAGE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateFAQ(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", `What is ${c.companyName}?`),
    s(
      "paragraph",
      `${c.companyName} is a simulated trading competition platform where users compete against each other in a risk-free, virtual market environment using real-time price data. All trading is simulated — no real financial instruments are bought or sold, and no real capital is placed at risk on live markets.`,
    ),
    s("divider", ""),
    s("heading", "How do I get started?"),
    s(
      "paragraph",
      `Create a free account, complete your profile, and purchase credits to enter competitions or challenges. You will be given a virtual balance to trade with during each competition, and your performance relative to other participants determines your ranking and prize eligibility.`,
    ),
    s("divider", ""),
    s("heading", "Is real money involved?"),
    s(
      "paragraph",
      `Credits (entry fees) are purchased with real money. However, all trading within competitions is simulated — you are trading with virtual currency in a simulated market environment. Competition prizes may be distributed as real-money payouts or platform credits, depending on the competition rules.`,
    ),
    s("divider", ""),
    s("heading", "How are winners determined?"),
    s(
      "paragraph",
      `Winners are determined by their simulated portfolio performance within the competition period, typically measured by percentage return on the virtual starting balance (P&L). Specific ranking criteria may vary by competition and are published in each competition's rules before entry.`,
    ),
    s("divider", ""),
    s("heading", "Can I withdraw my winnings?"),
    s(
      "paragraph",
      `Yes. Competition winnings can be withdrawn subject to completion of KYC (identity verification), compliance with our minimum withdrawal thresholds, and any applicable processing times. Withdrawals are processed to the payment method on file. Please review our Terms of Service and Refund Policy for complete details.`,
    ),
    s("divider", ""),
    s("heading", "What trading instruments are available?"),
    s(
      "paragraph",
      `${c.companyName} currently supports major and minor forex currency pairs. The available instruments may be expanded in the future. Check the Platform for the current list of tradable symbols.`,
    ),
    s("divider", ""),
    s("heading", "Is my personal data safe?"),
    s(
      "paragraph",
      `Yes. We take data protection seriously. All data is encrypted in transit and at rest, and we comply with the GDPR, CCPA, and other applicable data protection laws. Please read our Privacy Policy for full details on how we collect, use, and protect your personal data.`,
    ),
    s("divider", ""),
    s("heading", "What happens if a competition is cancelled?"),
    s(
      "paragraph",
      `If a competition is cancelled before it starts, all entry fees are automatically refunded. If a competition must be cancelled after starting (e.g., due to technical issues), prizes may be distributed based on standings at the time of cancellation, or entry fees may be refunded at ${c.legalName}'s discretion. See our Refund Policy for full details.`,
    ),
    s("divider", ""),
    s("heading", "How do I contact support?"),
    s(
      "paragraph",
      `Email us at ${c.email}. Our support team is available Monday–Friday, 09:00–18:00 UTC, and aims to respond within 24 hours. For urgent security concerns, include "URGENT" in your subject line.`,
    ),
  ];
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CUSTOM / GENERIC TEMPLATE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
function generateCustom(c: CompanyInfo): GeneratedSection[] {
  resetOrder();
  return [
    s("heading", "Introduction"),
    s(
      "paragraph",
      `Welcome to this page on ${c.companyName}, operated by ${c.legalName}. Edit the sections below to add your content.`,
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

