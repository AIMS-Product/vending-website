import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Always-on half of the replay eval (the live half is replay.live.test.ts):
 *
 * 1. The harness itself works end to end against a fake model: real prompt,
 *    real turn stream, real tools, side effects stubbed, scored.
 * 2. The server-side policy over the 40 frozen fixtures: which turns force
 *    the calendar or the cost video, which hold the calendar, and which
 *    member story the matcher picks. None of that needs a model.
 */

vi.mock("@/lib/chatbot/availability", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/chatbot/availability")>();
  const { CHATBOT_CALENDARS } = await import("@/lib/chatbot/booking");
  return {
    ...actual,
    resolveBookingCalendar: async () => ({
      calendar: CHATBOT_CALENDARS[0],
      slots: [],
    }),
  };
});

type Replay = typeof import("./replay");
type ValueFirst = typeof import("@/lib/chatbot/value-first");
type Tools = typeof import("@/lib/chatbot/tools");
let replay: Replay;
let valueFirst: ValueFirst;
let tools: Tools;

const FIXTURES_PATH = path.resolve(
  __dirname,
  "../../../../evals/chatbot/opening-exchanges.jsonl",
);

beforeAll(async () => {
  // config.ts reads the key at import; the fake model never checks it.
  process.env.OPENAI_API_KEY ||= "replay-smoke-test";
  replay = await import("./replay");
  valueFirst = await import("@/lib/chatbot/value-first");
  tools = await import("@/lib/chatbot/tools");
});

function sse(deltas: object[]): Response {
  const body = [
    ...deltas.map(
      (delta) => `data: ${JSON.stringify({ choices: [{ delta }] })}`,
    ),
    "data: [DONE]",
    "",
  ].join("\n\n");
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
}

describe("replay harness (fake model)", () => {
  it("runs a turn through the real stream, calls the story tool, and scores it", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as {
        tools?: Array<{ function: { name: string } }>;
      };
      const offersStory = body.tools?.some(
        (t) => t.function.name === "share_case_study",
      );
      return offersStory
        ? sse([
            {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: {
                    name: "share_case_study",
                    arguments: JSON.stringify({
                      situation: "nurse, 12 hour shifts",
                    }),
                  },
                },
              ],
            },
          ])
        : sse([
            { content: "She built hers around long shifts, so yours fits." },
          ]);
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const fixture = replay
        .parseFixtures(readFileSync(FIXTURES_PATH, "utf8"))
        .find((f) => f.id === "how-02");
      expect(fixture).toBeDefined();

      const turn = await replay.replayTurn(fixture!, "value_first", {
        model: "fake",
      });
      expect(turn.toolCalls).toEqual(["share_case_study"]);
      expect(turn.cards[0]?.kind).toBe("case_study_card");
      expect(turn.cards[0]?.data?.slug).toBe("mallerie-rouch");
      expect(turn.texts).toEqual([
        "She built hers around long shifts, so yours fits.",
      ]);

      const score = replay.scoreTurn(fixture!, turn, replay.knownSitePaths());
      expect(score.story_after_disclosure).toBe(true);
      expect(score.no_price).toBe(true);
      expect(score.no_early_calendar).toBe(true);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("stubs every tool with an effect outside the chat", async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const body = JSON.parse(String(init.body)) as { tools?: unknown[] };
      return body.tools
        ? sse([
            {
              tool_calls: [
                {
                  index: 0,
                  id: "call_1",
                  function: {
                    name: "flag_for_team",
                    arguments: JSON.stringify({
                      reason: "support",
                      summary: "login",
                    }),
                  },
                },
              ],
            },
          ])
        : sse([{ content: "A teammate from support will email you." }]);
    });
    vi.stubGlobal("fetch", fetchMock);
    try {
      const fixture = replay
        .parseFixtures(readFileSync(FIXTURES_PATH, "utf8"))
        .find((f) => f.id === "support-01");
      const turn = await replay.replayTurn(fixture!, "current", {
        model: "fake",
      });
      expect(turn.toolCalls).toEqual(["flag_for_team"]);
      // Only the two model calls went out: no Close, no email, no Slack.
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("policy replay over the frozen fixtures", () => {
  it("has about forty labelled fixtures with no contact details in them", () => {
    const raw = readFileSync(FIXTURES_PATH, "utf8");
    const fixtures = replay.parseFixtures(raw);
    expect(fixtures.length).toBeGreaterThanOrEqual(38);
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(fixtures.length);
    expect(raw).not.toMatch(/[^\s@]+@[^\s@]+\.[^\s@]+/);
    expect(raw).not.toMatch(/\+?\d[\d\s().-]{8,}\d/);
  });

  it("value-first never forces or allows a calendar on an early, non-booking message; booking asks still get it", () => {
    const fixtures = replay.parseFixtures(readFileSync(FIXTURES_PATH, "utf8"));
    for (const fixture of fixtures) {
      const visitor = fixture.messages
        .filter((m) => m.role === "user")
        .map((m) => m.content);
      const message = visitor.at(-1) as string;
      const decide = (on: boolean) => ({
        forced: valueFirst.chooseForcedTool({
          valueFirst: on,
          hasSeenCalendar: false,
          priorMessages: [],
          message,
        }),
        held: valueFirst.shouldHoldCalendar({
          valueFirst: on,
          visitorMessages: visitor,
        }),
      });
      const current = decide(false);
      const next = decide(true);

      expect(current.held).toBe(false);
      if (tools.hasExplicitBookingIntent(message)) {
        expect(next.forced).toBe("show_booking_calendar");
        expect(next.held).toBe(false);
      }
      if (
        visitor.length <= 2 &&
        !visitor.some(tools.hasExplicitBookingIntent) &&
        !visitor.slice(0, -1).some(tools.hasCostIntent)
      ) {
        expect(next.held).toBe(true);
        expect(next.forced).not.toBe("show_booking_calendar");
      }
    }
  });
});
