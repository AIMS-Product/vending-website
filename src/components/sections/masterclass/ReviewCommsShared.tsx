/** Shared pieces of the briefing's messages, swap map and checklist sections. */
import type { CommsChannel } from "@/lib/content/masterclass-review-comms-types";

export const H2 =
  "v2-display text-ink mt-14 text-[2rem] leading-none text-balance uppercase";
export const CARD = "rounded-card border-ink border-2 bg-white";
export const CHIP =
  "inline-block rounded px-1.5 py-0.5 text-[11px] font-black tracking-wider uppercase";

export const CHANNEL_LABEL: Record<CommsChannel, string> = {
  sms: "Text",
  email: "Email",
  voice: "Voicemail",
  zoom: "Zoom email",
};

export const CHANNEL_CHIP: Record<CommsChannel, string> = {
  sms: "bg-tint text-eyebrow",
  email: "bg-slate-100 text-slate-700",
  voice: "bg-slate-100 text-slate-700",
  zoom: "bg-slate-100 text-slate-700",
};

/** Merge fields and links ({first}, {zoom link}, {link: ...}) as chips. */
export function WithPlaceholders({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\{[^}]+\})/g).map((part, i) =>
        /^\{[^}]+\}$/.test(part) ? (
          <span
            key={i}
            className="border-brand-600 text-eyebrow mx-0.5 inline-block rounded border px-1 text-[0.85em] font-bold whitespace-nowrap"
          >
            {part.slice(1, -1)}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
