import "server-only";

import {
  PublicLeadForm,
  type PublicLeadFormAction,
} from "@/components/forms/PublicLeadForm";
import type {
  LegacyLeadRoute,
  LegacyLeadVariant,
} from "@/lib/content/legacy-routes";
import type { LeadAttribution } from "@/lib/lead-attribution";

type LegacyLeadPageContentProps = {
  action: PublicLeadFormAction;
  attribution: LeadAttribution;
  idempotencyKey: string;
  route: LegacyLeadRoute;
};

type LegacySection = {
  title: string;
  body: string;
};

const variantSections: Record<LegacyLeadVariant, LegacySection[]> = {
  advisory: [
    {
      title: "Meet the Founder",
      body: "Mike built vending into a practical income stream after starting with limited time, limited capital, and a need for more freedom.",
    },
    {
      title: "This Is Where Thinking About It Becomes An Actual Plan.",
      body: "Use the call to review your market, your budget, your launch timeline, and the gaps that would slow you down alone.",
    },
    {
      title: "Hear From Our Community",
      body: "Members use Vendingpreneurs to avoid common mistakes, compare real route decisions, and move faster with guidance from operators who have already placed machines.",
    },
    {
      title: "Meet Your Ambassadors",
      body: "The program connects you with people who understand machines, products, locations, and the realities of getting a route live.",
    },
  ],
  market: [
    {
      title: "Market Fit",
      body: "The first question is whether your target city or region still has room for a vending route with the right locations.",
    },
    {
      title: "Route Readiness",
      body: "The team reviews your timeline, capital, and current experience so the conversation starts from a real operating picture.",
    },
    {
      title: "Next Step",
      body: "If there is a fit, the advisory call focuses on what to do before buying machines or approaching locations.",
    },
  ],
  schedule: [
    {
      title: "You're In the Right Place.",
      body: "Use this page to get connected with the right Vendingpreneurs advisory path and prepare for the next conversation.",
    },
    {
      title: "Bring Your Market",
      body: "The clearest calls start with your target region, launch timeline, and questions about machines, locations, or startup capital.",
    },
  ],
  webinar: [
    {
      title: "You Saw How It Works. Now Let's Build Your Route.",
      body: "The next step is translating the webinar into your market, your first machines, and a practical execution plan.",
    },
    {
      title: "From Interest To Route Plan",
      body: "Vendingpreneurs helps you move past research and into the operating decisions that determine whether a route can work.",
    },
  ],
  eligibility: [
    {
      title: "Location Eligibility",
      body: "Share the city or region you are considering so the team can review the opportunity and direct you to the right next step.",
    },
    {
      title: "What Happens Next",
      body: "If the area is a fit, the team can help you think through machine placement, route economics, and a clean launch sequence.",
    },
  ],
  watch: [
    {
      title: "Smart Machines. Real Support. A Proven System.",
      body: "The old blueprint pages were built around the same idea: use vending as a practical business model, not a guessing game.",
    },
    {
      title: "Real People. Real Results.",
      body: "The program is designed for operators who want help choosing the right machines, products, locations, and route-building sequence.",
    },
    {
      title: "Ready To Build The Right Way?",
      body: "Apply when you are ready to turn the blueprint into a concrete route plan for your market.",
    },
  ],
  cashflow: [
    {
      title: "See What Our Community Has to Say",
      body: "The training path emphasizes real operator feedback, practical support, and fewer expensive mistakes at the start.",
    },
    {
      title: "This Is For You If...",
      body: "You want a real income stream, you are willing to work the process, and you want guidance before committing capital.",
    },
    {
      title: "Why People Choose Vendingpreneurs.",
      body: "Members get a route-building framework, support from experienced operators, and a clearer path through machines, locations, and products.",
    },
    {
      title: "Here's What You'll Discover",
      body: "The call helps clarify the market, the capital requirements, the launch timeline, and the decisions that should happen before buying equipment.",
    },
  ],
  quiz: [
    {
      title: "How Long Have You Been Seriously Considering Vending?",
      body: "The original qualification flow checked location, timeline, capital, and intent before sending people to an advisor.",
    },
    {
      title: "You're Ready To Speak With A Vendingpreneurs Advisor.",
      body: "The form now captures the same lead intent while preserving the original test route attribution.",
    },
  ],
  journey: [
    {
      title: "500+",
      body: "Entrepreneurs have used the Vendingpreneurs framework to get from idea to route-building action.",
    },
    {
      title: "$3M+",
      body: "Snack and drink sales have run through Vendingpreneur machines using practical route-building systems.",
    },
    {
      title: "3,000+",
      body: "Vending locations have been supported through the process, from first placement to route expansion.",
    },
    {
      title: "All It Takes Is 90 Days",
      body: "The blueprint breaks the journey into foundation, location, machine, product, and operating phases.",
    },
  ],
  join: [
    {
      title: "Hear From Our Community",
      body: "Vendingpreneurs is built for people who want a real operating path, not another passive-income theory.",
    },
    {
      title: "Meet Your Ambassadors",
      body: "The program gives applicants a clearer way to understand machines, locations, financing, and support before they launch.",
    },
    {
      title:
        "While You're Thinking About It, Someone In Your Market Is Already Placing Machines.",
      body: "The old join page made the urgency explicit: regions have limits, and the right time to check yours is before you buy equipment.",
    },
  ],
};

export function LegacyLeadPageContent({
  action,
  attribution,
  idempotencyKey,
  route,
}: LegacyLeadPageContentProps) {
  const sections = variantSections[route.variant];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32 lg:pb-24">
        <div className="mx-auto grid max-w-[1250px] gap-12 lg:grid-cols-[minmax(0,0.92fr)_minmax(500px,0.9fr)] lg:items-start">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
              Vendingpreneurs
            </p>
            <h1 className="mt-8 max-w-[760px] text-[clamp(2.2rem,3.8vw,4.1rem)] leading-[0.98] font-black break-words text-[#111111] uppercase">
              {route.pageTitle}
            </h1>
            <p className="mt-7 max-w-xl text-xl leading-8 font-semibold text-slate-700">
              {route.description}
            </p>
          </div>

          <PublicLeadForm
            action={action}
            attribution={attribution}
            idempotencyKey={idempotencyKey}
            intent="apply"
            submitLabel="Submit application"
          />
        </div>
      </section>

      <section className="border-y-2 border-[#111111] bg-white px-5 py-16 lg:px-10">
        <div className="mx-auto grid max-w-[1250px] gap-5 md:grid-cols-2">
          {sections.map((section) => (
            <article
              className="rounded-[10px] border-2 border-[#111111] bg-[#f5fbff] p-6 shadow-[6px_6px_0_#55b8e8]"
              key={section.title}
            >
              <h2 className="text-2xl leading-tight font-black text-[#111111] uppercase">
                {section.title}
              </h2>
              <p className="mt-4 text-base leading-7 font-semibold text-slate-700">
                {section.body}
              </p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
