import { preload } from "react-dom";
import { fontFiles } from "@/fonts/files";
import "@/fonts/anton.css";

// Self-hosted subsets written by scripts/fonts/subset-fonts.py (rerun it when
// content needs a character outside the files' unicode-range). Only each
// face's core file is preloaded; the extended file downloads on demand.
function preloadFont(href: string) {
  preload(href, { as: "font", type: "font/woff2", crossOrigin: "anonymous" });
}

export function preloadInter() {
  preloadFont(fontFiles.inter.core);
}

export function preloadGeistBio() {
  for (const w of [400, 500, 600, 700] as const) {
    preloadFont(fontFiles[`geist-bio-${w}`].core);
  }
}

// The funnel display face (see ApplyHero). Pages put `antonFont()` on their
// root and headings use the `.v2-display` class from home-v2.css. It sets
// `--font-anton` for that subtree and preloads Anton on the page using it.
export function antonFont() {
  preloadFont(fontFiles.anton.core);
  return "anton-font";
}
