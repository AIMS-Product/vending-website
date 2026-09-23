import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// The public-site tokens in globals.css (`shadow-card`, `rounded-card`,
// `max-w-page`, …) are custom theme names tailwind-merge can't infer, so a
// `className` override would otherwise keep both classes and let CSS order pick.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      shadow: ["btn", "btn-hover", "card", "card-hover"],
      radius: ["control", "card"],
      container: ["page", "article", "narrow"],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
