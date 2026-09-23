import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

/**
 * The replay eval, run on demand. Skipped in the normal suite.
 *
 *   CHATBOT_REPLAY=policy npx vitest run src/lib/chatbot/replay/replay.live.test.ts
 *     Server-side decisions only (forced tool, calendar hold, story picked),
 *     current vs value-first. No model, no key.
 *
 *   CHATBOT_REPLAY=live OPENAI_API_KEY=... [CHATBOT_REPLAY_MODEL=gpt-4.1] \
 *     npx vitest run src/lib/chatbot/replay/replay.live.test.ts
 *     Replays every fixture through the model twice (current prompt, then
 *     value-first) and scores each reply. ~160 model calls, run sequentially
 *     because the org's gpt-4.1 cap was 30K tokens a minute on 2026-09-11.
 *
 * Results go to CHATBOT_REPLAY_OUT (default: the OS temp dir) as JSON plus a
 * markdown table for the PR. Ship value-first only if its score beats current.
 */

const MODE = process.env.CHATBOT_REPLAY;
const OUT_DIR = process.env.CHATBOT_REPLAY_OUT ?? process.env.TMPDIR ?? "/tmp";
const FIXTURES_PATH = path.resolve(
  __dirname,
  "../../../../evals/chatbot/opening-exchanges.jsonl",
);

// Synthetic open slots, so neither the tools nor the availability guard call
// Calendly: weekdays over the next two weeks at 10:00, 10:30, 14:00, 18:15
// America/Chicago (15:00, 15:30, 19:00, 23:15 UTC in CDT).
vi.mock("@/lib/chatbot/availability", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/chatbot/availability")>();
  const { CHATBOT_CALENDARS } = await import("@/lib/chatbot/booking");
  const slots: string[] = [];
  const now = Date.now();
  for (let day = 1; day <= 14; day += 1) {
    const date = new Date(now + day * 86_400_000);
    if (date.getUTCDay() === 0 || date.getUTCDay() === 6) continue;
    const ymd = date.toISOString().slice(0, 10);
    for (const time of ["15:00", "15:30", "19:00", "23:15"]) {
      slots.push(`${ymd}T${time}:00Z`);
    }
  }
  return {
    ...actual,
    resolveBookingCalendar: async () => ({
      calendar: CHATBOT_CALENDARS[0],
      slots,
    }),
  };
});

describe.skipIf(!MODE)("chatbot replay eval", () => {
  it(
    "replays the frozen fixtures, current prompt vs value-first",
    async () => {
      if (MODE === "live" && !process.env.OPENAI_API_KEY) {
        throw new Error("CHATBOT_REPLAY=live needs OPENAI_API_KEY");
      }
      process.env.OPENAI_API_KEY ||= "policy-only";
      const replay = await import("./replay");
      const { chooseForcedTool, shouldHoldCalendar } =
        await import("@/lib/chatbot/value-first");
      const { matchCaseStudy } = await import("@/lib/chatbot/case-study-match");

      const fixtures = replay.parseFixtures(
        readFileSync(FIXTURES_PATH, "utf8"),
      );
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");

      // --- policy: no model -------------------------------------------------
      const policy = fixtures.map((fixture) => {
        const visitor = fixture.messages
          .filter((m) => m.role === "user")
          .map((m) => m.content);
        const message = visitor.at(-1) as string;
        const decide = (on: boolean) =>
          chooseForcedTool({
            valueFirst: on,
            hasSeenCalendar: false,
            priorMessages: [],
            message,
          }) ?? "-";
        return {
          id: fixture.id,
          category: fixture.category,
          visitorMessages: visitor.length,
          currentForced: decide(false),
          valueFirstForced: decide(true),
          valueFirstHoldsCalendar: shouldHoldCalendar({
            valueFirst: true,
            visitorMessages: visitor,
          }),
          storyIfShared: fixture.labels.disclosed
            ? (matchCaseStudy({ situation: visitor.join(". ") })?.slug ??
              "(none fits)")
            : "-",
        };
      });
      const policyTable = [
        "| Fixture | Msgs | Current forces | Value-first forces | VF holds calendar | Story matcher picks |",
        "|---|---|---|---|---|---|",
        ...policy.map(
          (p) =>
            `| ${p.id} | ${p.visitorMessages} | ${p.currentForced} | ${p.valueFirstForced} | ${p.valueFirstHoldsCalendar ? "yes" : "no"} | ${p.storyIfShared} |`,
        ),
      ].join("\n");
      writeFileSync(
        path.join(OUT_DIR, `replay-policy-${stamp}.md`),
        policyTable,
      );
      console.log(policyTable);

      if (MODE !== "live") return;

      // --- live: the model ------------------------------------------------
      const model = process.env.CHATBOT_REPLAY_MODEL ?? "gpt-4.1";
      const known = replay.knownSitePaths();
      const results: Record<
        string,
        Array<{
          turn: Awaited<ReturnType<typeof replay.replayTurn>>;
          score: ReturnType<typeof replay.scoreTurn>;
        }>
      > = {
        current: [],
        value_first: [],
      };
      for (const variant of ["current", "value_first"] as const) {
        for (const fixture of fixtures) {
          let turn = await replay.replayTurn(fixture, variant, { model });
          // A glitch is a rate limit or a timeout, not the prompt. Wait it out.
          for (
            let attempt = 0;
            attempt < 3 && turn.texts.includes(replay.GLITCH_LINE);
            attempt += 1
          ) {
            await new Promise((resolve) => setTimeout(resolve, 20_000));
            turn = await replay.replayTurn(fixture, variant, { model });
          }
          results[variant]?.push({
            turn,
            score: replay.scoreTurn(fixture, turn, known),
          });
        }
      }

      const summaries = (["current", "value_first"] as const).map((variant) =>
        replay.summarize(variant, results[variant] ?? []),
      );
      const [current, next] = summaries;
      const table = [
        `Model ${model}, ${fixtures.length} fixtures.`,
        "",
        "| Check | Current | Value-first |",
        "|---|---|---|",
        ...replay.CHECKS.map((name) => {
          const cell = (s: typeof current) =>
            `${s?.checks[name].passed}/${s?.checks[name].applicable}`;
          return `| ${name} | ${cell(current)} | ${cell(next)} |`;
        }),
        `| **Score** | **${current?.score}%** | **${next?.score}%** |`,
        `| Glitched turns (excluded from nothing) | ${current?.glitches} | ${next?.glitches} |`,
      ].join("\n");
      writeFileSync(
        path.join(OUT_DIR, `replay-live-${stamp}.json`),
        JSON.stringify({ model, summaries, results }, null, 2),
      );
      writeFileSync(path.join(OUT_DIR, `replay-live-${stamp}.md`), table);
      console.log(table);
      expect(summaries).toHaveLength(2);
    },
    60 * 60 * 1000,
  );
});
