import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import DynamicFavicon from "@/components/DynamicFavicon";
import { connectToDatabase } from "@/database/mongoose";
import { WhiteLabel } from "@/database/models/whitelabel.model";
import "./globals.css";

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
  "ChartVolt — Live Market Trading Platform";
const DEFAULT_DESC =
  "Monitor live market movements, receive tailored notifications, and dive deep into comprehensive company profiles.";
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
        <AppSettingsProvider>
          <DynamicFavicon />
          {children}
          <Toaster />
        </AppSettingsProvider>
      </body>
    </html>
  );
}
