import { buildCalendlySrc } from "@/lib/content/lead-embed";
import { CalendlyBookingRedirect } from "./CalendlyBookingRedirect";
import { CalendlyFrame } from "./CalendlyFrame";
import type { LeadAttribution } from "@/lib/lead-attribution";
import { cn } from "@/lib/utils";

type CalendlyEmbedProps = {
  url: string;
  /** Omit on surfaces with no lead/session context (e.g. /thank-you). */
  attribution?: LeadAttribution;
  /**
   * Open straight on the date picker (hides Calendly's event-details block).
   * "phone" hides it only below md: at md+ the two-column scheduler keeps the
   * event title and description beside the month.
   */
  hideDetails?: boolean | "phone";
  title?: string;
  /**
   * Height classes for the iframe. Calendly stacks the month and the times
   * on phones, so a single-column surface needs far more height there than
   * on desktop (e.g. "h-[1050px] md:h-[700px]").
   */
  heightClassName?: string;
  /** False drops the ink border and shadow, leaving only Calendly's own. */
  framed?: boolean;
};

/**
 * Inline Calendly scheduler rendered in the branded conversion shell. UTM
 * attribution is passed through as native Calendly utm_* params so bookings
 * stay attributed to the originating campaign.
 *
 * Every booking surface on the site renders its calendar through here, so the
 * post-booking redirect to /pre-call-resources is mounted here too rather than
 * repeated per page.
 */
export function CalendlyEmbed({
  url,
  attribution,
  hideDetails = false,
  title = "Book your Vendingpreneurs call",
  heightClassName = "h-[720px]",
  framed = true,
}: CalendlyEmbedProps) {
  const src = buildCalendlySrc(url, attribution, {
    hideDetails: hideDetails === true,
  });
  const phoneSrc =
    hideDetails === "phone"
      ? buildCalendlySrc(url, attribution, { hideDetails: true })
      : undefined;

  return (
    <div
      className={cn(
        "relative w-full overflow-hidden",
        framed &&
          "rounded-[10px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#55b8e8]",
      )}
    >
      <CalendlyFrame
        src={src}
        phoneSrc={phoneSrc}
        title={title}
        heightClassName={heightClassName}
      />
      <CalendlyBookingRedirect url={src} />
    </div>
  );
}
