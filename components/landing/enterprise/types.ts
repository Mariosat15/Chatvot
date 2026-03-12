export interface EnterpriseSettings {
  siteName: string;
  logo: string;
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  heroBadge: string;
  heroCTAText: string;
  heroCTALink: string;
  heroSecondaryCTAText: string;
  heroSecondaryCTALink: string;
  trustBadges: Array<{
    id: string;
    icon: string;
    text: string;
    enabled: boolean;
  }>;
  whiteLabelTitle: string;
  whiteLabelSubtitle: string;
  whiteLabelFeatures: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
    order: number;
  }>;
  adminTitle: string;
  adminSubtitle: string;
  adminDescription: string;
  adminFeatures: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    color: string;
    enabled: boolean;
    order: number;
  }>;
  pricingTitle: string;
  pricingSubtitle: string;
  pricingTiers: Array<{
    id: string;
    name: string;
    price: string;
    period: string;
    description: string;
    features: string[];
    ctaText: string;
    highlighted: boolean;
    enabled: boolean;
    order: number;
  }>;
  contactTitle: string;
  contactSubtitle: string;
  contactEmail: string;
  contactPhone: string;
  contactCTAText: string;
  competitionTypes?: Array<{
    id: string;
    icon: string;
    name: string;
    description: string;
    color: string;
    enabled: boolean;
  }>;
  gameMasterBenefits?: Array<{
    id: string;
    icon: string;
    title: string;
    description: string;
    enabled: boolean;
    order: number;
  }>;
  sectionVisibility: {
    hero: boolean;
    trustBadges: boolean;
    whiteLabel: boolean;
    platformCapabilities?: boolean;
    gameMasterProgram?: boolean;
    adminShowcase: boolean;
    caseStudies?: boolean;
    pricing: boolean;
    contact: boolean;
    footer: boolean;
  };
  footerCopyright: string;
  caseStudies?: Array<{
    id: string;
    companyName: string;
    companyLogo: string;
    industry: string;
    quote: string;
    quotePerson: string;
    quoteTitle: string;
    metrics: { label: string; value: string }[];
    enabled: boolean;
    order: number;
  }>;
  caseStudiesTitle?: string;
  caseStudiesSubtitle?: string;
  demoScheduling?: {
    enabled: boolean;
    calendlyUrl: string;
    buttonText: string;
  };
}
