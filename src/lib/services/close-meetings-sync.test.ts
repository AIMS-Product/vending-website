import { describe, expect, it, vi } from "vitest";
import {
  mapLeadFacts,
  mapMeeting,
  monthWindows,
} from "@/lib/booked-calls-v2/close-mapping";
import { syncCloseMeetings } from "./close-meetings-sync";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/config", () => ({ config: { CLOSE_API_KEY: undefined } }));

describe("monthWindows", () => {
  it("uses whole-second fences and ends one second past now", () => {
    const windows = monthWindows(new Date("2026-10-13T21:54:08.731Z"));
    const [, lastEnd] = windows.at(-1)!;
    expect(lastEnd).toBe("2026-10-13T21:54:09Z");
    for (const [gte, lt] of windows) {
      expect(gte).not.toMatch(/\.\d+Z$/);
      expect(lt).not.toMatch(/\.\d+Z$/);
    }
    // Contiguous: each window starts where the last ended.
    for (let i = 1; i < windows.length; i += 1) {
      expect(windows[i]![0]).toBe(windows[i - 1]![1]);
    }
  });
});

describe("mapMeeting", () => {
  it("names the outcome and flags a reschedule note without storing it", () => {
    const row = mapMeeting(
      {
        id: "acti_1",
        lead_id: "lead_a",
        title: "Vending Strategy Call",
        status: "completed",
        outcome_id: "outcome_ns",
        starts_at: "2026-10-08T18:00:00Z",
        date_created: "2026-10-05T18:00:00Z",
        user_note_html:
          "Reschedule Reason: Rescheduled from connected calendar event",
      },
      new Map([["outcome_ns", "No Show"]]),
      "2026-10-13T00:00:00Z",
    );
    expect(row).toMatchObject({ outcome: "No Show", reschedule_note: true });
    expect(JSON.stringify(row)).not.toContain("Reason");
  });

  it("drops a meeting with no lead or creation time", () => {
    expect(mapMeeting({ id: "acti_1" }, new Map(), "x")).toBeNull();
  });
});

describe("mapLeadFacts", () => {
  it("collects each contact's UTM source and medium", () => {
    const row = mapLeadFacts(
      {
        id: "lead_a",
        "custom.cf_funnel": "Reactivation Scrapers",
        contacts: [
          { custom: { cf_src: "youtube", cf_med: "video" } },
          { "custom.cf_src": null },
        ],
      },
      {
        lead: { funnel: "cf_funnel" },
        utmSource: "cf_src",
        utmMedium: "cf_med",
      },
      "t",
    );
    expect(row).toMatchObject({
      funnel: "Reactivation Scrapers",
      contact_utms: [{ source: "youtube", medium: "video" }],
    });
  });
});

describe("syncCloseMeetings", () => {
  it("splits a window that pages past the cap and keeps one row per meeting", async () => {
    const upserts: Record<string, unknown[]> = {};
    const client = {
      from(table: string) {
        return {
          upsert: async (rows: unknown[]) => {
            (upserts[table] ??= []).push(...rows);
            return { error: null };
          },
          delete: () => ({ lt: async () => ({ error: null }) }),
          insert: async () => ({ error: null }),
        };
      },
    };
    const now = new Date("2022-01-20T00:00:00Z");
    const seen: string[] = [];
    const close = {
      listOutcomes: async () => ({ data: [] }),
      listCustomFields: async () => ({
        data: [{ id: "cf_funnel", name: "Funnel Name DEAL (Opp)" }],
      }),
      searchLeads: async () => ({
        data: [{ id: "lead_a", "custom.cf_funnel": "YouTube" }],
      }),
      listMeetings: async (gte: string, lt: string, skip: number) => {
        seen.push(`${gte}|${lt}|${skip}`);
        const whole =
          gte === "2022-01-01T00:00:00Z" && lt.startsWith("2022-01-20");
        // The whole window always says "more", forcing a split at the cap.
        return {
          data: [
            {
              id: whole ? `acti_${skip}` : `acti_half_${gte}`,
              lead_id: "lead_a",
              date_created: "2022-01-10T00:00:00Z",
              starts_at: "2022-01-12T00:00:00Z",
            },
          ],
          has_more: whole,
        };
      },
    };
    const outcome = await syncCloseMeetings({
      client: client as never,
      close: close as never,
      now,
    });
    expect(outcome.error ?? null).toBeNull();
    expect(seen.some((s) => s.endsWith("|1900"))).toBe(true);
    expect(seen.filter((s) => s.endsWith("|0")).length).toBe(3);
    const ids = (upserts.close_meetings ?? []).map(
      (r) => (r as { id: string }).id,
    );
    expect(new Set(ids).size).toBe(ids.length);
    expect(upserts.close_meeting_leads).toHaveLength(1);
  });
});
