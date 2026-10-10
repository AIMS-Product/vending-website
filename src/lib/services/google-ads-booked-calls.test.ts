import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));

import { toConversions } from "./google-ads-booked-calls";

const NOW = new Date("2026-10-10T05:00:00Z");
const G = "Cj0KCQjwm8bTBhDWARIsAC9Hi8n";

describe("toConversions", () => {
  it("uses noon Pacific on the booked date", () => {
    expect(
      toConversions(
        [
          {
            created_at: "2026-10-01T15:00:00Z",
            call_booked_at: "2026-10-03",
            gclid: G,
          },
        ],
        NOW,
      ),
    ).toEqual([{ gclid: G, conversionTime: "2026-10-03T19:00:00.000Z" }]);
  });

  it("never puts the conversion before the lead came in", () => {
    const [c] = toConversions(
      [
        {
          created_at: "2026-10-03T22:30:00Z",
          call_booked_at: "2026-10-03",
          gclid: G,
        },
      ],
      NOW,
    );
    expect(c.conversionTime).toBe("2026-10-03T22:35:00.000Z");
  });

  it("drops a booking made before the ad click", () => {
    expect(
      toConversions(
        [
          {
            created_at: "2026-10-09T21:39:26Z",
            call_booked_at: "2026-02-24",
            gclid: G,
          },
        ],
        NOW,
      ),
    ).toEqual([]);
  });

  it("keeps the evening Pacific lead on its Pacific day", () => {
    // 2026-10-04 03:00 UTC is Oct 3, 8pm Pacific: an Oct 3 booking counts.
    expect(
      toConversions(
        [
          {
            created_at: "2026-10-04T03:00:00Z",
            call_booked_at: "2026-10-03",
            gclid: G,
          },
        ],
        NOW,
      ),
    ).toHaveLength(1);
  });

  it("never sends a future time, one row per gclid, and skips junk ids", () => {
    const out = toConversions(
      [
        {
          created_at: "2026-10-09T20:00:00Z",
          call_booked_at: "2026-10-10",
          gclid: G,
        },
        {
          created_at: "2026-10-01T15:00:00Z",
          call_booked_at: "2026-10-02",
          gclid: G,
        },
        {
          created_at: "2026-10-01T15:00:00Z",
          call_booked_at: "2026-10-02",
          gclid: "<x>",
        },
        {
          created_at: "2026-10-01T15:00:00Z",
          call_booked_at: "2026-10-02",
          gclid: null,
        },
      ],
      NOW,
    );
    expect(out).toEqual([
      { gclid: G, conversionTime: "2026-10-02T19:00:00.000Z" },
    ]);
    const future = toConversions(
      [
        {
          created_at: "2026-10-09T20:00:00Z",
          call_booked_at: "2026-10-10",
          gclid: G,
        },
      ],
      NOW,
    );
    expect(Date.parse(future[0].conversionTime)).toBeLessThan(NOW.getTime());
  });
});
