import {
  adminCardClass,
  adminInputClass,
  adminPrimaryButtonClass,
} from "@/components/admin/AdminUi";
import { ROADMAP_PHASES } from "@/lib/services/seo-plan-data";
import { type Tables } from "@/types/database";
import { saveMonthlyReview, updateTaskStatus } from "@/app/admin/seo/actions";

const REVIEW_QUESTIONS: Array<[string, string]> = [
  [
    "worked",
    "What worked: top pages by clicks gained, and what we did to them",
  ],
  [
    "didnt",
    "What didn't: pages refreshed with no movement after 28 days, and why",
  ],
  ["backlog", "Trigger backlog: open triggers by type"],
  [
    "competitive",
    "Competitive landscape: new entrants in a hub's top 5, AI Overview gained or lost",
  ],
  [
    "decisions",
    "Decisions, each with an owner: sequence moves, retargets, merges, new pieces, outreach, tooling, Google Ads support",
  ],
  ["priorities", "Next month's top 5 priorities"],
];

export function SeoRoadmapTab({
  items,
  reviews,
  canEdit,
  month,
}: {
  items: Tables<"seo_tasks">[];
  reviews: Tables<"seo_monthly_reviews">[];
  canEdit: boolean;
  month: string;
}) {
  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-2">
        {ROADMAP_PHASES.map((phase) => {
          const list = items.filter((i) => i.phase === phase);
          if (list.length === 0) return null;
          return (
            <section key={phase} className={adminCardClass}>
              <h2 className="text-ui-text text-sm font-semibold">
                {phase}{" "}
                <span className="text-ui-text-subtle font-normal">
                  {list.filter((i) => i.status === "done").length}/{list.length}
                </span>
              </h2>
              <ul className="mt-3 space-y-3">
                {list.map((item) => (
                  <li key={item.id} className="flex items-start gap-3">
                    {canEdit ? (
                      <form action={updateTaskStatus}>
                        <input type="hidden" name="id" value={item.id} />
                        <input
                          type="hidden"
                          name="status"
                          value={item.status === "done" ? "open" : "done"}
                        />
                        <button
                          type="submit"
                          aria-label={`${item.status === "done" ? "Reopen" : "Complete"}: ${item.title}`}
                          className={`rounded-ui mt-0.5 h-4 w-4 border ${item.status === "done" ? "bg-ui-ok border-ui-ok" : "border-ui-line-strong"}`}
                        />
                      </form>
                    ) : (
                      <span
                        className={`rounded-ui mt-0.5 h-4 w-4 border ${item.status === "done" ? "bg-ui-ok border-ui-ok" : "border-ui-line-strong"}`}
                      />
                    )}
                    <div>
                      <p
                        className={`text-sm ${item.status === "done" ? "text-ui-text-subtle line-through" : "text-ui-text"}`}
                      >
                        {item.title}
                      </p>
                      {item.detail ? (
                        <p className="text-ui-text-muted mt-0.5 text-xs">
                          {item.detail}
                        </p>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <section className={adminCardClass}>
        <h2 className="text-ui-text text-sm font-semibold">
          Monthly SEO review
        </h2>
        <p className="text-ui-text-subtle mt-1 text-xs">
          First Monday of each month. Saving stores this month&apos;s Search
          Console, rank and AI Overview numbers with the answers.
        </p>
        {canEdit ? (
          <form action={saveMonthlyReview} className="mt-3 space-y-3">
            <label className="block text-sm">
              Month
              <input
                type="month"
                name="month"
                defaultValue={month}
                required
                className={adminInputClass}
              />
            </label>
            {REVIEW_QUESTIONS.map(([key, q]) => (
              <label key={key} className="block text-sm">
                {q}
                <textarea
                  name={`q_${key}`}
                  rows={2}
                  maxLength={4000}
                  className={adminInputClass}
                />
              </label>
            ))}
            <button type="submit" className={adminPrimaryButtonClass}>
              Save review
            </button>
          </form>
        ) : null}
        {reviews.length ? (
          <ul className="divide-ui-line mt-4 divide-y text-sm">
            {reviews.map((r) => (
              <li key={r.month} className="py-2">
                <p className="text-ui-text font-medium">
                  {r.month.slice(0, 7)}{" "}
                  <span className="text-ui-text-subtle text-xs font-normal">
                    {r.reviewed_by}
                  </span>
                </p>
                {Object.entries((r.answers ?? {}) as Record<string, string>)
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <p key={k} className="text-ui-text-muted mt-1 text-xs">
                      <span className="text-ui-text-subtle">{k}:</span> {v}
                    </p>
                  ))}
              </li>
            ))}
          </ul>
        ) : null}
      </section>
      <section className={`${adminCardClass} text-ui-text-muted text-xs`}>
        <p className="text-ui-text text-sm font-semibold">
          Tool stack and paid rules (Kody, 2026-09-23)
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>
            DataForSEO now for ranks and AI Overviews. Ahrefs and Profound after
            20+ pages are live.
          </li>
          <li>
            Google Ads: core conversion queries, direct competitor terms and a
            brand campaign. No broad match, no AI expansion. UTM the triggering
            search term.
          </li>
          <li>
            Don&apos;t touch a page in its first 6 weeks; the trigger job
            already skips them.
          </li>
        </ul>
      </section>
    </div>
  );
}
