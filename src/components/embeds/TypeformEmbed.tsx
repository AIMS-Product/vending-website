import { buildTypeformSrc } from "@/lib/content/lead-embed";
import type { LeadAttribution } from "@/lib/lead-attribution";

type TypeformEmbedProps = {
  formId: string;
  attribution: LeadAttribution;
  title?: string;
};

/**
 * Inline Typeform embed rendered in the branded conversion shell. UTM + source
 * attribution is baked into the iframe src server-side, so no client JS is
 * needed and tracking survives the handoff into Typeform.
 */
export function TypeformEmbed({
  formId,
  attribution,
  title = "Vendingpreneurs application form",
}: TypeformEmbedProps) {
  const src = buildTypeformSrc(formId, attribution);

  return (
    <div className="w-full rounded-[10px] border-2 border-[#111111] bg-white shadow-[6px_6px_0_#55b8e8]">
      <iframe
        allow="camera; microphone; autoplay; encrypted-media; fullscreen; geolocation"
        className="h-[640px] w-full rounded-[8px] border-0"
        loading="eager"
        src={src}
        title={title}
      />
    </div>
  );
}
