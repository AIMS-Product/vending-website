import Image from "next/image";
import { Card } from "@/components/ui/Card";
import {
  BUY_CTA_SHORT,
  DISCLAIMER,
  PRICE,
  faq,
  finalOffer,
  host,
  images,
} from "@/lib/content/playbook";
import { EYEBROW, H2, PlaybookCta, PlaybookCtaBand } from "./PlaybookCta";

interface PlaybookCloseProps {
  checkoutHref: string;
}

export function PlaybookHost({ checkoutHref }: PlaybookCloseProps) {
  return (
    <section className="bg-brand-50 border-ink border-b-2 py-16 lg:py-24">
      <div className="mx-auto grid max-w-[1180px] items-start gap-10 px-5 lg:grid-cols-[0.6fr_1.4fr] lg:px-10">
        <Image
          src={images.mike.src}
          alt={images.mike.alt}
          width={images.mike.width}
          height={images.mike.height}
          sizes="(min-width: 1024px) 340px, 70vw"
          className="border-ink shadow-card rounded-card mx-auto h-auto w-full max-w-[340px] border-2"
        />
        <div>
          <h2 data-reveal className={`${H2} text-[clamp(1.5rem,3vw,2.3rem)]`}>
            {host.title}
          </h2>
          <div className="mt-5 space-y-4 leading-relaxed">
            {host.paragraphs.map((p) => (
              <p key={p.slice(0, 24)}>{p}</p>
            ))}
          </div>
          <PlaybookCtaBand href={checkoutHref} label={BUY_CTA_SHORT} />
        </div>
      </div>
    </section>
  );
}

export function PlaybookFaq() {
  return (
    <section className="border-ink border-b-2 bg-white py-16 lg:py-24">
      <div className="mx-auto max-w-3xl px-5 lg:px-10">
        <p className={EYEBROW}>{faq.eyebrow}</p>
        <h2 data-reveal className={`${H2} mt-2`}>
          {faq.title}
        </h2>
        <div className="mt-8 space-y-3">
          {faq.items.map((item) => (
            <details key={item.q} className="group">
              <Card variant="flat" className="p-0 lg:p-0">
                <summary className="text-ink cursor-pointer list-none p-5 font-black">
                  {item.q}
                </summary>
                <p className="px-5 pb-5 leading-snug">{item.a}</p>
              </Card>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PlaybookFinalOffer({ checkoutHref }: PlaybookCloseProps) {
  return (
    <section className="bg-brand-50 py-16 lg:py-24">
      <div className="mx-auto max-w-2xl px-5 text-center lg:px-10">
        <Card>
          <p className={EYEBROW}>{finalOffer.badge}</p>
          <h2 className={`${H2} mt-3`}>{finalOffer.title}</h2>
          <p className="mt-3 text-sm font-bold">{finalOffer.proof}</p>
          <p className="text-eyebrow mt-1 text-sm font-black uppercase">
            {finalOffer.urgency}
          </p>
          <p className="mt-5 flex items-baseline justify-center gap-3">
            <span className="text-ink/60 text-xl font-black line-through">
              {PRICE.anchor}
            </span>
            <span className="text-brand-700 text-5xl font-black">
              {finalOffer.price}
            </span>
          </p>
          <p className="mt-1 text-sm font-bold">{PRICE.save}</p>
          <p className="mx-auto mt-4 max-w-md leading-snug">
            {finalOffer.line}
          </p>
          <div className="mt-6">
            <PlaybookCta
              href={checkoutHref}
              label={finalOffer.cta}
              className="w-full sm:w-auto"
            />
          </div>
          <p className="mt-4 text-xs font-bold">{finalOffer.secure}</p>
        </Card>
        <p className="mt-8 text-xs leading-relaxed">{DISCLAIMER}</p>
      </div>
    </section>
  );
}
