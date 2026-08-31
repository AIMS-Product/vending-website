import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AttributionSessionTracker } from "@/components/attribution/AttributionSessionTracker";
import { ChatWidget } from "@/components/chatbot/ChatWidget";
import { TrackingScripts } from "@/components/tracking/TrackingScripts";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { SitePopup } from "@/components/site/SitePopup";
import { loadSitePopups } from "@/lib/services/popups";
import { siteUrl } from "@/lib/site";
import { siteStructuredData } from "@/lib/site-structured-data";
import "./globals.css";

// `display: "optional"` (not the "swap" default) is deliberate: it gives the
// browser a ~100ms window to use Inter, and if it isn't ready the size-matched
// fallback (adjustFontFallback, on by default) is kept for the rest of the page
// load with NO later swap. That removes the cold-load reflow where Inter swaps
// in and re-flows text, which was pushing the footer down (measured CLS ~0.29).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "optional",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Vendingpreneurs",
    template: "%s | Vendingpreneurs",
  },
  description:
    "Mentorship, tools, and exclusive discounts to launch and scale a profitable vending machine business.",
  openGraph: {
    title: "Vendingpreneurs",
    description:
      "Mentorship, tools, and exclusive discounts to launch and scale a profitable vending machine business.",
    siteName: "Vendingpreneurs",
    url: "/",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Cached (5 min, tag "site-popups") and falls back to the static array on
  // any DB failure, so this fetch cannot slow or break public pages.
  const popups = await loadSitePopups();
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <script
          type="application/ld+json"
          // Serialised server-side from our own static config, never from user input.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(siteStructuredData()),
          }}
        />
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <AttributionSessionTracker />
        <SitePopup popups={popups} />
        <TrackingScripts />
        <ChatWidget />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
