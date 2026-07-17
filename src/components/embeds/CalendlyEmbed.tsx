import { buildCalendlySrc } from "@/lib/content/lead-embed";
import type { LeadAttribution } from "@/lib/lead-attribution";

type CalendlyEmbedProps = {
  url: string;
  attribution: LeadAttribution;
  title?: string;
};

/**
 * Inline Calendly scheduler rendered in the branded conversion shell. UTM
 * attribution is passed through as native Calendly utm_* params so bookings
 * stay attributed to the originating campaign.
 */
export function CalendlyEmbed({
  url,
  attribution,
  title = "Book your Vendingpreneurs call",
}: CalendlyEmbedProps) {
  const src = buildCalendlySrc(url, attribution);

  return (
    <div className="w-full rounded-[10px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#55b8e8]">
      <iframe
        className="h-[720px] w-full rounded-[8px] border-0"
        loading="eager"
        src={src}
        title={title}
      />
    </div>
  );
}
