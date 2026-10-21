import Image from "next/image";
import Link from "next/link";
import { CheckIcon } from "@/components/sections/playbook/PlaybookCta";
import { buttonClass } from "@/components/ui/Button";
import { GUIDE, guideOffer } from "@/lib/content/playbook-guide";
import { guideImages } from "@/lib/content/playbook-guide-images";
import { LTF_PATHS } from "@/lib/ltf/assignment";

interface GuideTeaserProps {
  /** The host page's searchParams; UTMs carry through to the offer. */
  searchParams?: Record<string, string | string[] | undefined>;
}

const UTM = /^utm_/;

/** The $5 playbook as one card another page can drop in (replaces PlaybookTeaser when live). */
export function GuideTeaser({ searchParams = {} }: GuideTeaserProps) {
  const query = new URLSearchParams(
    Object.entries(searchParams).flatMap(([k, v]) =>
      UTM.test(k) && typeof v === "string" ? [[k, v]] : [],
    ),
  ).toString();
  return (
    <div className="border-ink shadow-card rounded-card overflow-hidden border-2 bg-white md:grid md:grid-cols-[0.8fr_1.2fr]">
      <div className="bg-tint v2-dots border-ink flex items-center justify-center border-b-2 p-8 md:border-r-2 md:border-b-0">
        <Image
          src={guideImages.cover.src}
          alt={guideImages.cover.alt}
          width={guideImages.cover.width}
          height={guideImages.cover.height}
          sizes="(min-width: 768px) 300px, 70vw"
          className="border-ink h-auto w-full max-w-[280px] -rotate-2 border-2 bg-white shadow-[6px_6px_0_#111111]"
        />
      </div>
      <div className="p-6 lg:p-8">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          Mike Hoffmann&apos;s First Location Playbook
        </p>
        <h2 className="v2-display text-ink mt-2 text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.02] text-balance uppercase">
          Want to show up ahead of the room?
        </h2>
        <p className="mt-3 text-[15px] text-slate-600">
          Mike&apos;s First Location Playbook, our VIP prep packet. Totally
          optional: the masterclass is free either way.
        </p>
        <ul className="mt-5 space-y-2.5 text-[0.95rem] leading-snug">
          {guideOffer.benefits.map((b) => (
            <li key={b.title} className="flex gap-3">
              <CheckIcon className="text-brand-600 mt-0.5 size-5 shrink-0" />
              <span>
                <strong className="text-ink font-black">{b.title}.</strong>{" "}
                {b.body}
              </span>
            </li>
          ))}
        </ul>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
          <span className="v2-display text-brand-700 text-5xl leading-none">
            {GUIDE.priceLabel}
          </span>
          <Link
            data-track="playbook_clicked"
            data-track-detail="confirmed"
            href={`${LTF_PATHS.go}${query ? `?${query}` : ""}`}
            className={buttonClass({
              size: "lg",
              className: "w-full sm:w-auto",
            })}
          >
            See the Playbook
          </Link>
        </div>
      </div>
    </div>
  );
}
