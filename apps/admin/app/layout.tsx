import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { unstable_noStore as noStore } from "next/cache";
import { Toaster } from "@/components/ui/sonner";
import { AppSettingsProvider } from "@/contexts/AppSettingsContext";
import { TerminologyProvider } from "@/contexts/TerminologyContext";
import { getTerms } from "@/lib/services/terminology.service";
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
  title: "ChartVolt Admin",
  description: "ChartVolt Administration Dashboard",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  /*
    The display vocabulary is resolved here rather than on each page, and read fresh rather
    than statically. App settings (credit symbol, currency) load client-side via
    AppSettingsProvider — mounted here since R110 so every admin screen sees the configured
    values rather than createContext defaults.

    // Reason for the ROOT LAYOUT rather than the seven pages: the admin app has seven render
    // roots outside `/login`, and the contest create wizard - the largest block of wording in
    // this pass - sits in `competitions/new`, which is not inside the dashboard tree. Mounting
    // per page is seven places to forget today and one more with every page added.
    //
    // Reason for `noStore()`: without it Next.js may prerender `/login` and the root redirect
    // at build time, which runs this read during `next build`. `getTerms()` catches a failed
    // read and answers the defaults, so a build machine with no database would BAKE the default
    // wording into a static page - and a frozen word is indistinguishable, from the operator's
    // seat, from the override not having saved.
    //
    // The cost is one projected `findOne` on a singleton per admin page render. That is
    // acceptable here specifically because this app is behind a login and carries no public
    // traffic; the same read on a player route would want caching.
    //
    // Reason AppSettings wraps Terminology: settings fetch is client-side and independent of
    // the server-resolved terms pack; either order works, and matching the main app's outer
    // AppSettingsProvider keeps the two trees familiar.
  */
  noStore();
  const terms = await getTerms();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AppSettingsProvider>
          <TerminologyProvider terms={terms}>{children}</TerminologyProvider>
        </AppSettingsProvider>
        <Toaster />
      </body>
    </html>
  );
}
