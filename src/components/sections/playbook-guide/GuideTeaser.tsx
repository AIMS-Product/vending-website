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
    <div className="border-ink shadow-card rounded-card overflow-hidden border-2 bg-white">
      <div className="border-ink bg-tint v2-dots flex items-center gap-4 border-b-2 p-4 sm:p-5">
        <Image
          src={guideImages.cover.src}
          alt={guideImages.cover.alt}
          width={guideImages.cover.width}
          height={guideImages.cover.height}
          sizes="112px"
          className="border-ink h-auto w-20 shrink-0 border-2 bg-white sm:w-28"
        />
        <div className="min-w-0 flex-1">
          <p className="text-ink leading-tight font-black">{GUIDE.title}</p>
          <p className="text-ink/65 mt-1 text-sm">PDF + 8 videos</p>
        </div>
        <p className="text-ink text-lg font-black tabular-nums">
          {GUIDE.priceLabel}
        </p>
      </div>
      <div className="p-6 lg:p-8">
        <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
          Your pre-webinar homework
        </p>
        <h2 className="v2-display text-ink mt-2 text-[clamp(1.8rem,3vw,2.4rem)] leading-[1.02] text-balance uppercase">
          Show up to the webinar ready to start
        </h2>
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
          <p className="text-ink/60 text-sm font-bold">
            {GUIDE.priceLabel} · one-time · Instant PDF
          </p>
        </div>
      </div>
    </div>
  );
}
