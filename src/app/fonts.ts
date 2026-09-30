import { Anton } from "next/font/google";

// The funnel display face (see ApplyHero). Pages set `anton.variable` on their
// root and headings use the `.v2-display` class from home-v2.css.
export const anton = Anton({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-anton",
  display: "swap",
});
