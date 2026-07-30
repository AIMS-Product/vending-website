import {
  adminInputClass,
  adminPrimaryButtonClass,
  adminSecondaryButtonClass,
  adminSmallButtonClass,
  adminTextareaClass,
} from "@/components/admin/AdminUi";
import type { SeoReadinessStatus } from "@/lib/page-builder/seo-readiness";

/* Two kinds of style live in this file and they are not interchangeable.
   Editor chrome — buttons, inputs, pills, menus — is admin UI and uses the
   --ui-* tokens. The canvas inline inputs at the bottom sit inside a preview
   of the published page, so their type colours are the public site's own and
   deliberately stay raw: only the editing affordances (hover surface, focus
   ring, placeholder) are admin, because only those are invisible once the
   page publishes. */

export function labelForReadinessStatus(status: SeoReadinessStatus) {
  if (status === "blocked") return "Blocked";
  if (status === "needs_work") return "Needs work";
  if (status === "opportunities") return "Review";
  return "Strong";
}

export function readinessPillClass(status: SeoReadinessStatus) {
  if (status === "blocked") return "bg-ui-bad-fill text-ui-bad-ink";
  if (status === "needs_work") return "bg-ui-warn-fill text-ui-warn-ink";
  if (status === "opportunities") return "bg-ui-accent-soft text-ui-accent";
  return "bg-ui-ok-fill text-ui-ok-ink";
}

export function readinessCategoryClass(status: SeoReadinessStatus) {
  if (status === "blocked") return "border-l-4 border-l-ui-bad";
  if (status === "needs_work") return "border-l-4 border-l-ui-warn";
  if (status === "opportunities") return "border-l-4 border-l-ui-accent";
  return "border-l-4 border-l-ui-ok";
}

export function findingDotClass(
  severity: "blocker" | "warning" | "opportunity",
) {
  if (severity === "blocker") return "bg-ui-bad";
  if (severity === "warning") return "bg-ui-warn";
  return "bg-ui-accent";
}

/* The editor used to keep its own button and input shapes, which is how the
   builder drifted a shade off every other admin screen. They are now the
   shared ones. */
export const primaryButtonClass = adminPrimaryButtonClass;

export const secondaryButtonClass = adminSecondaryButtonClass;

export const smallButtonClass = `${adminSmallButtonClass} max-w-full whitespace-nowrap`;

export const compactInputClass = adminInputClass;

export const textareaClass = adminTextareaClass;

export const disabledLeadFieldClass =
  "rounded-ui border-ui-line bg-ui-surface text-ui-text-subtle shadow-ui border p-3 text-sm";

/* No AdminUi equivalent: these are the builder's dense toolbar and overflow
   menu, which have no counterpart on a list screen. Tokens, not new colours. */
export const miniButtonClass =
  "rounded-ui bg-ui-surface text-ui-text-muted shadow-ui ring-ui-line-strong hover:bg-ui-canvas hover:ring-ui-text-subtle focus-visible:ring-ui-line px-3 py-1 text-xs font-semibold ring-1 transition ring-inset focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

export const menuButtonClass =
  "rounded-ui bg-ui-surface text-ui-text-muted hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-line w-full px-3 py-2 text-left text-sm font-semibold transition focus-visible:ring-4 focus-visible:outline-none";

export const dangerButtonClass =
  "rounded-ui bg-ui-surface text-ui-bad hover:bg-ui-bad/5 focus-visible:ring-ui-bad/20 w-full px-3 py-2 text-left text-sm font-semibold transition focus-visible:ring-4 focus-visible:outline-none";

export const iconButtonClass =
  "rounded-ui text-ui-text-subtle hover:bg-ui-canvas hover:text-ui-text focus-visible:ring-ui-line inline-flex size-8 items-center justify-center transition-colors focus-visible:ring-4 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50";

/* Canvas inline inputs. The text colours below are the public page's, not the
   admin's — this markup is a preview of what publishes. */
export const leadInputClass =
  "rounded-ui hover:bg-ui-canvas focus:bg-ui-surface focus:border-ui-accent/30 focus:ring-ui-accent/10 placeholder:text-ui-text-subtle w-full resize-none border border-transparent bg-transparent px-2 py-1 text-base leading-7 text-slate-600 outline-none transition focus:ring-4";

export const eyebrowInputClass =
  "rounded-ui hover:bg-ui-canvas focus:bg-ui-surface focus:border-ui-accent/30 focus:ring-ui-accent/10 placeholder:text-ui-text-subtle w-full border border-transparent bg-transparent px-2 py-1.5 text-sm font-bold tracking-wider text-indigo-600 uppercase outline-none transition-all focus:ring-4";

export const heroHeadingInputClass =
  "rounded-ui hover:bg-ui-canvas focus:bg-ui-surface focus:border-ui-accent/30 focus:ring-ui-accent/10 placeholder:text-ui-text-subtle w-full resize-none border border-transparent bg-transparent px-2 py-1.5 text-3xl font-bold tracking-tight text-slate-900 outline-none transition-all focus:ring-4 md:text-4xl";

export const sectionHeadingInputClass =
  "rounded-ui hover:bg-ui-canvas focus:bg-ui-surface focus:border-ui-accent/30 focus:ring-ui-accent/10 placeholder:text-ui-text-subtle w-full border border-transparent bg-transparent px-2 py-1.5 text-2xl font-bold tracking-tight text-slate-900 outline-none transition-all focus:ring-4 md:text-3xl";

export const bodyTextareaClass =
  "rounded-ui hover:bg-ui-canvas focus:bg-ui-surface focus:border-ui-accent/30 focus:ring-ui-accent/10 placeholder:text-ui-text-subtle w-full resize-none border border-transparent bg-transparent px-2 py-1.5 text-base leading-8 text-slate-600 outline-none transition-all focus:ring-4";
