import type { Metadata } from "next";
import { AboutPageContent } from "@/components/sections/AboutPageContent";
import { pageOpenGraph } from "@/lib/site";

const TITLE = "About — Meet Mike";
const DESCRIPTION =
  "Meet Mike, the founder of Vendingpreneurs — how he escaped the rat race, built passive income through vending, and the unique approach behind the program.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: {
    canonical: "/about",
  },
  openGraph: pageOpenGraph(TITLE, DESCRIPTION, "/about"),
};

export default function AboutPage() {
  return <AboutPageContent />;
}
