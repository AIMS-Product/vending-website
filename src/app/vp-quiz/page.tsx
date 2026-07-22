import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import { submitQualificationLead } from "@/app/qualification-intake/actions";
import { PublicLeadForm } from "@/components/forms/PublicLeadForm";
import { emptyLeadAttribution } from "@/lib/lead-attribution";

// Staging QA entry point for the VP Lead Capture qualification + scoring flow.
// Renders Window 1 (contact + name); submitting creates a session and hands off
// to the /qualify/[token] runtime, which scores the answers and routes to the
// matching /thank-you fit state. Kept out of search indexes — it is a test seam,
// not a marketing page. The real production entry is a page-builder lead_form
// block; this exists so the flow is verifiable before that page is authored.
export const metadata: Metadata = {
  title: "See if vending is right for you",
  robots: { index: false, follow: false },
};

// Force-dynamic so each visit mints a fresh idempotency key (and therefore a
// fresh lead + qualification session), which keeps repeat QA runs independent.
export const dynamic = "force-dynamic";

// The seeded VP Lead Capture form (see the seed migration). Passing it
// explicitly avoids depending on which form happens to be the global default.
const VP_QUALIFICATION_FORM_ID = "a1b2c3d4-0000-4000-8000-000000000001";

export default function VpQuizPage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center gap-8 px-5 py-16">
      <header className="grid gap-3">
        <p className="text-sm font-black text-[#0b63f6] uppercase">
          Vendingpreneurs
        </p>
        <h1 className="text-[clamp(2rem,5vw,3.25rem)] leading-[1.05] font-black text-slate-950">
          Find out if starting a vending business is right for you.
        </h1>
        <p className="text-base leading-7 font-medium text-slate-600">
          Answer a few quick questions and we&apos;ll show you where you stand.
        </p>
      </header>

      <PublicLeadForm
        action={submitQualificationLead}
        attribution={emptyLeadAttribution("/vp-quiz")}
        hiddenFields={{ qualification_form_id: VP_QUALIFICATION_FORM_ID }}
        idempotencyKey={randomUUID()}
        intent="qualification"
        submitLabel="See if I qualify"
      />
    </main>
  );
}
