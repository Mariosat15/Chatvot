import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import DynamicFavicon from "@/components/DynamicFavicon";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ChartVolt",
  description:
    "Monitor live market movements, receive tailored notifications, and dive deep into comprehensive company profiles.",
  openGraph: {
    title: "ChartVolt",
    description:
      "Monitor live market movements, receive tailored notifications, and dive deep into comprehensive company profiles.",
    url: "https://chartvolt.com",
    siteName: "ChartVolt",
    images: [
      {
        url: "https://chartvolt.com/og-image.png", // place your image at public/og-image.png
        width: 1200,
        height: 630,
        alt: "ChartVolt — Live Market Trading Platform",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "ChartVolt",
    description:
      "Monitor live market movements, receive tailored notifications, and dive deep into comprehensive company profiles.",
    images: ["https://chartvolt.com/og-image.png"],
  },
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
        <AppSettingsProvider>
          <DynamicFavicon />
          {children}
          <Toaster />
        </AppSettingsProvider>
      </body>
    </html>
  );
}
