import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { AttributionSessionTracker } from "@/components/attribution/AttributionSessionTracker";
import { Header } from "@/components/site/Header";
import { Footer } from "@/components/site/Footer";
import { siteUrl } from "@/lib/site";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a href="#main-content" className="skip-to-content">
          Skip to content
        </a>
        <Header />
        <main id="main-content" className="flex-1">
          {children}
        </main>
        <Footer />
        <AttributionSessionTracker />
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
