/**
 * Labels and picker groups for every grantable admin section.
 *
 * Model-free on purpose: `EmployeesSection.tsx` is a client component, so it must not
 * import `admin-employee.model.ts` (R58). The employee credentials email reads the same
 * labels. `__tests__/admin/admin-section-catalog.test.ts` asserts every `ADMIN_SECTIONS`
 * value is labelled and in exactly one group - a section missing here cannot be ticked,
 * which is how fourteen screens became grantable only by a super admin.
 */

export const ADMIN_SECTION_LABELS: Readonly<Record<string, string>> = {
  // Dashboard
  overview: "Overview",
  // Content
  "hero-page": "Hero Page",
  "site-pages": "Site Pages",
  "landing-pages": "Landing Pages",
  "cookie-consent": "Cookie Consent",
  visitors: "Visitor Analytics",
  marketplace: "Marketplace",
  "system-announcements": "System Announcements",
  // Trading
  competitions: "Competitions",
  challenges: "1v1 Challenges",
  "trading-history": "Trading History",
  analytics: "Analytics",
  market: "Market Hours",
  symbols: "Trading Symbols",
  "market-data": "Market Data",
  "trading-page": "Trading Page",
  // Games
  "game-providers": "All Games",
  "round-inspector": "Round Inspector",
  "provider-health": "Provider Health",
  "game-performance": "Game Performance",
  // User Management
  users: "Users",
  badges: "Badges & XP",
  "journey-map": "Journey Map",
  "gamification-wizard": "Gamification Wizard",
  "customer-assignment": "Customer Assignment",
  // Finance
  financial: "Financial Dashboard",
  payments: "Pending Payments",
  "failed-deposits": "Failed Deposits",
  withdrawals: "Withdrawal Settings",
  "pending-withdrawals": "Pending Withdrawals",
  // Security
  "kyc-settings": "KYC Settings",
  "kyc-history": "KYC History",
  fraud: "Fraud Detection",
  // Operations
  "price-health": "Price Feed Health",
  incidents: "Incident Management",
  // Messaging
  messaging: "Support Center",
  "messaging-settings": "Messaging Settings",
  // Help
  wiki: "Documentation",
  tutorials: "Tutorial Videos",
  // Game Master
  "gamemaster-dashboard": "GM Dashboard",
  "gamemaster-management": "Manage Game Masters",
  "gamemaster-reports-export": "Export GM Reports",
  "gm-competition-defaults": "GM Competition Defaults",
  // AI & Automation
  "ai-agent": "AI Agent",
  "ai-knowledge": "AI Database",
  // Settings
  settings: "Settings",
  credentials: "Credentials",
  environment: "Environment",
  vendors: "Vendor Subscriptions",
  branding: "Branding",
  terminology: "Wording",
  company: "Company",
  invoices: "Invoices",
  "email-templates": "Email Templates",
  notifications: "Notifications",
  "trading-risk": "Trading Risk",
  currency: "Currency",
  fees: "Fees",
  "payment-providers": "Payment Providers",
  database: "Database",
  "audit-logs": "Audit Logs",
  // Dev Zone
  "dev-zone-menu": "Dev Zone",
  "server-monitor": "Server Monitor",
  "server-fleet": "Server Fleet",
  "server-options": "Server Options",
  redis: "Redis Cache",
  "mdb-cluster": "MDB Cluster",
  "dev-settings": "Test",
  "performance-simulator": "Performance Simulator",
  "image-optimizer": "Image Optimizer",
  "dependency-updates": "Dependency Updates",
  "command-alerts": "Command Alerts",
  "data-cleanup": "Data Cleanup",
  "data-maintenance": "Data Maintenance",
  // Admin
  employees: "Employees",
  // My Account
  profile: "My Profile",
};

export const ADMIN_SECTION_GROUPS: Readonly<Record<string, readonly string[]>> = {
  Dashboard: ["overview"],
  Content: [
    "hero-page",
    "site-pages",
    "landing-pages",
    "cookie-consent",
    "visitors",
    "marketplace",
    "system-announcements",
  ],
  Trading: [
    "competitions",
    "challenges",
    "trading-history",
    "analytics",
    "market",
    "symbols",
    "market-data",
    "trading-page",
  ],
  Games: [
    "game-providers",
    "round-inspector",
    "provider-health",
    "game-performance",
  ],
  "User Management": [
    "users",
    "badges",
    "journey-map",
    "gamification-wizard",
    "customer-assignment",
  ],
  Finance: [
    "financial",
    "payments",
    "failed-deposits",
    "withdrawals",
    "pending-withdrawals",
  ],
  Security: ["kyc-settings", "kyc-history", "fraud"],
  Operations: ["price-health", "incidents"],
  Messaging: ["messaging", "messaging-settings"],
  Help: ["wiki", "tutorials"],
  "Game Master": [
    "gamemaster-dashboard",
    "gamemaster-management",
    "gamemaster-reports-export",
    "gm-competition-defaults",
  ],
  "AI & Automation": ["ai-agent", "ai-knowledge"],
  Settings: [
    "settings",
    "credentials",
    "environment",
    "vendors",
    "branding",
    "terminology",
    "company",
    "invoices",
    "email-templates",
    "notifications",
    "trading-risk",
    "currency",
    "fees",
    "payment-providers",
    "database",
    "audit-logs",
  ],
  "Dev Zone": [
    "dev-zone-menu",
    "server-monitor",
    "server-fleet",
    "server-options",
    "redis",
    "mdb-cluster",
    "dev-settings",
    "performance-simulator",
    "image-optimizer",
    "dependency-updates",
    "command-alerts",
    "data-cleanup",
    "data-maintenance",
  ],
  Admin: ["employees"],
  "My Account": ["profile"],
};

export function adminSectionLabel(section: string): string {
  return Object.prototype.hasOwnProperty.call(ADMIN_SECTION_LABELS, section)
    ? // eslint-disable-next-line security/detect-object-injection -- own-property checked above
      ADMIN_SECTION_LABELS[section]
    : section;
}
