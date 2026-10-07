import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import DynamicFavicon from "@/components/DynamicFavicon";
import SiteTracker from "@/components/tracking/SiteTracker";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import Script from "next/script";
import CookieConsentBanner from "@/components/CookieConsentBanner";
import MobileViewportLock from "@/components/MobileViewportLock";
import "./globals.css";

/**
 * Reason (7 Oct 2026): client useEffect runs after first paint, so a stuck
 * Safari zoom is visible for a flash (and sometimes sticks). Run the unlock →
 * re-lock dance before hydration. Keep in sync with MobileViewportLock.tsx.
 */
const VIEWPORT_BOOT = `(function(){try{var m=document.querySelector('meta[name="viewport"]');if(!m){m=document.createElement("meta");m.setAttribute("name","viewport");document.head.appendChild(m);}var unlock="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=10,user-scalable=yes,viewport-fit=cover";var lock="width=device-width,initial-scale=1,minimum-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover";m.setAttribute("content",unlock);requestAnimationFrame(function(){m.setAttribute("content",lock);});}catch(e){}})();`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ── Defaults (used when DB has no values yet) ─────────────────────────────
const DEFAULT_TITLE =
  "ChartVolt — Live Market competition Trading Platform";
const DEFAULT_DESC =
  "Trading competitions for the champions.";
const DEFAULT_URL = "https://chartvolt.com";
const DEFAULT_OG_IMAGE = `${DEFAULT_URL}/og-image.png`;

// ── generateMetadata — runs server-side on every request ─────────────────
// This replaces the static `export const metadata` so the admin panel values
// are picked up at runtime without a redeploy.
export async function generateMetadata(): Promise<Metadata> {
  try {
    await connectToDatabase();
    const wl = await WhiteLabel.findOne().lean<{
      seoTitle?: string;
      seoDescription?: string;
      ogImageUrl?: string;
      siteUrl?: string;
    }>();

    const title = wl?.seoTitle || DEFAULT_TITLE;
    const description = wl?.seoDescription || DEFAULT_DESC;
    const siteUrl = wl?.siteUrl || DEFAULT_URL;
    const ogImage = wl?.ogImageUrl || DEFAULT_OG_IMAGE;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        url: siteUrl,
        siteName: title,
        images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
        locale: "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: [ogImage],
      },
    };
  } catch {
    // Fallback to hardcoded defaults if DB is unavailable during build
    return {
      title: DEFAULT_TITLE,
      description: DEFAULT_DESC,
      openGraph: {
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
        url: DEFAULT_URL,
        siteName: DEFAULT_TITLE,
        images: [
          { url: DEFAULT_OG_IMAGE, width: 1200, height: 630, alt: DEFAULT_TITLE },
        ],
        locale: "en_US",
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: DEFAULT_TITLE,
        description: DEFAULT_DESC,
        images: [DEFAULT_OG_IMAGE],
      },
    };
  }
}

/**
 * Reason: owner 6 Oct 2026 — phones should feel like a native app, so pinch-zoom
 * cannot stretch Wallet / Performance until taps miss SignOut.
 *
 * Amended 7 Oct 2026 (second report): do NOT emit maximumScale:1 from Next's
 * viewport export. Safari ships that meta on first paint and then refuses to
 * honour a later initial-scale=1 reset while a visual zoom is stuck. Boot script
 * + MobileViewportLock unlock briefly, then re-lock pinch. Landing inherits the
 * same dance on purpose.
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  // Reason: temporary ceiling only — lock re-applies maximum-scale=1 in JS.
  maximumScale: 10,
  userScalable: true,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Script id="cv-viewport-boot" strategy="beforeInteractive">
          {VIEWPORT_BOOT}
        </Script>
        <AppSettingsProvider>
          <MobileViewportLock />
          <DynamicFavicon />
          <SiteTracker />
          {children}
          <CookieConsentBanner />
          <Toaster />
        </AppSettingsProvider>
      </body>
    </html>
  );
}
