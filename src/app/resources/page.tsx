import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { FinalCta } from "@/components/sections/FinalCta";
import { NewsGuides } from "@/components/sections/NewsGuides";
import { listResourceGuides } from "@/lib/services/seo-page-public";
import { pageOpenGraph } from "@/lib/site";

const TITLE = "Vending Business Guides";
const DESCRIPTION =
  "Guides to starting and running a vending machine business: costs, financing, machines, LLC setup, and negotiating with locations.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/resources" },
  openGraph: pageOpenGraph(TITLE, DESCRIPTION, "/resources"),
};

export const revalidate = 60;

export default async function ResourcesPage() {
  const guides = await listResourceGuides();
  return (
    <>
      <section className="border-ink relative isolate overflow-hidden border-b-2 bg-[#f5fbff] pt-28 pb-16 lg:pt-32 lg:pb-20">
        <Container>
          <p className="text-eyebrow text-xs font-black tracking-[0.14em] uppercase">
            Free resources
          </p>
          <h1 className="text-ink mt-5 text-[clamp(2.25rem,4.6vw,4.25rem)] leading-[1.05] font-black uppercase">
            {TITLE}
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed font-semibold text-slate-700 lg:text-xl">
            What it costs, how to fund it, and how to set it up. Want the whole
            plan in one place? Get the{" "}
            <Link
              href="/resources/roadmap"
              className="text-[#066a99] underline decoration-2 underline-offset-4"
            >
              free 90-day roadmap
            </Link>
            .
          </p>
        </Container>
      </section>
      <NewsGuides guides={guides} />
      <FinalCta />
    </>
  );
}
