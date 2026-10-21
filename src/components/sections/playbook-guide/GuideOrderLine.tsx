import Image from "next/image";
import { GUIDE } from "@/lib/content/playbook-guide";
import { guideImages } from "@/lib/content/playbook-guide-images";

interface GuideOrderLineProps {
  /** Short state chip on the right, e.g. "Paid". */
  status?: string;
}

/** Product line from the order card (cover thumb, title, format), reused after checkout. */
export function GuideOrderLine({ status }: GuideOrderLineProps) {
  return (
    <div className="border-ink flex items-center gap-4 border-b-2 pb-5">
      <Image
        src={guideImages.cover.src}
        alt=""
        width={guideImages.cover.width}
        height={guideImages.cover.height}
        sizes="80px"
        className="border-ink h-auto w-14 shrink-0 border-2 sm:w-20"
      />
      <div className="min-w-0 flex-1">
        <p className="text-ink leading-tight font-black">{GUIDE.title}</p>
        <p className="text-ink/65 mt-1 text-sm">PDF + 8 videos</p>
      </div>
      {status ? (
        <span className="border-ink text-ink shrink-0 border-2 px-2.5 py-1 text-xs font-black tracking-[0.08em] uppercase">
          {status}
        </span>
      ) : null}
    </div>
  );
}

/** Small help line: the support inbox when configured, the delivery email otherwise. */
export function GuideHelpLine({ email }: { email?: string }) {
  return (
    <p className="text-ink/60 mt-6 text-sm break-words">
      Questions?{" "}
      {email ? (
        <>
          Email <span className="text-ink font-bold">{email}</span>.
        </>
      ) : (
        "Reply to your delivery email."
      )}
    </p>
  );
}
