import { LEAD_DEFINITION } from "@/lib/analytics/lead-definition";
import { MATURE_AFTER_DAYS } from "@/lib/services/close-monthly-funnel";

/**
 * The words every analytics tab shares, defined once on screen. Tooltips never
 * show on a phone, and a marketer asking what "(3 direct)" meant is how this
 * came to exist (2026-09-22). Each entry restates the rule the code applies;
 * change them together.
 */
export const GLOSSARY: ReadonlyArray<{ term: string; meaning: string }> = [
  { term: "Lead", meaning: LEAD_DEFINITION.body },
  {
    term: "Registrations & contacts",
    meaning:
      "People who signed up somewhere other than a form on our site: webinar registrations, off-site GHL forms (Instagram lead magnets, VSL) and ManyChat contacts. They are not counted as leads.",
  },
  {
    term: "Booked",
    meaning:
      "A person who booked a first sales call. One person counts once, however many times they reschedule. The sales team's spreadsheet counts every meeting instead, so its totals run about 1.7x ours; both are right, they count different things.",
  },
  {
    term: "Skipped form",
    meaning:
      "Booked straight from a calendar link (Instagram bio, a DM, an email) without filling in a form on the site first. Counted as booked, never as a lead.",
  },
  {
    term: "Showed",
    meaning:
      "The rep marked First Call Show Up = Yes in Close. A call nobody marked is not counted as a show.",
  },
  {
    term: "Qualified",
    meaning:
      "Means two things depending on the tab. On the Sales and Executive tabs, the rep marked the person Qualified = Yes in Close after the call. On Overview, Lead quality and YouTube, the lead finished the qualifying questions on our site.",
  },
  {
    term: "Closed-won (CW) and revenue",
    meaning:
      "The person became a paying customer, and revenue is the deal value in Close. On Month over month a sale counts in the month the call was booked, not the month it closed.",
  },
  {
    term: "Show %, Qual %, CW %",
    meaning:
      "On Month over month and Close view, each is out of everyone who booked, never out of the step before it, so Show % is a minimum while logging is incomplete. On Executive and Funnels by month, Show % is out of calls with a show or no-show logged, so calls nobody logged are left out.",
  },
  {
    term: "Lead % and Book %",
    meaning:
      "Lead % is leads out of site visits. On Channels, Book % is calls booked out of leads plus registrations & contacts. On Executive and Funnels by month, it is out of site leads only.",
  },
  {
    term: "Still filling in",
    meaning: `Sales keep arriving for about ${MATURE_AFTER_DAYS} days after a month ends, so the newest months read low until then.`,
  },
  {
    term: "— (a dash)",
    meaning:
      "Nothing to count: we have no data for it, or too few calls to work out a rate. A 0 is a real zero.",
  },
];

export function AnalyticsGlossary() {
  return (
    <details className="group mt-2">
      <summary className="text-ui-accent cursor-pointer text-xs font-medium underline-offset-2 hover:underline">
        What the numbers mean
      </summary>
      <dl className="mt-3 grid gap-x-6 gap-y-2.5 text-xs sm:grid-cols-2">
        {GLOSSARY.map((entry) => (
          <div key={entry.term}>
            <dt className="text-ui-text font-semibold">{entry.term}</dt>
            <dd className="text-ui-text-muted mt-0.5 leading-5">
              {entry.meaning}
            </dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
