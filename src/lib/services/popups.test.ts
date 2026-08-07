import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { POPUP_TEMPLATES } from "@/lib/content/popups";
import type { Database } from "@/types/database";
import {
  adminCreatePopup,
  adminListPopups,
  adminPopupEventTotals,
  fetchActiveSitePopups,
  PopupServiceError,
  recordPopupEvent,
  sumPopupEventTotals,
} from "./popups";

type PopupRow = Database["public"]["Tables"]["popups"]["Row"];
type PopupsClient = Pick<SupabaseClient<Database>, "from">;

function makeRow(overrides: Partial<PopupRow> = {}): PopupRow {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    status: "active",
    trigger: "EXIT_INTENT",
    trigger_threshold: null,
    target_url_patterns: [],
    frequency: "once_per_day",
    eyebrow: "Before you go",
    headline: "Not sure where to start?",
    body: "See how members build monthly income.",
    primary_cta_label: "Watch the training",
    primary_cta_href: "/contact",
    secondary_cta_label: null,
    secondary_cta_href: null,
    featured_value_label: null,
    featured_value_value: null,
    featured_value_note: null,
    offer_code: null,
    dismiss_text: "No thanks",
    accent_color: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-08-07T00:00:00.000Z",
    updated_at: "2026-08-07T00:00:00.000Z",
    ...overrides,
  };
}

/** Chainable stub whose terminal calls resolve to `result`. */
function stubClient(result: { data: unknown; error: unknown }): PopupsClient {
  const terminal = () => Promise.resolve(result);
  const builder = {
    select: () => builder,
    insert: () => builder,
    update: () => builder,
    delete: () => builder,
    eq: () => builder,
    order: terminal,
    limit: terminal,
    single: terminal,
    maybeSingle: terminal,
    then: (onFulfilled: (value: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled),
  };
  return { from: () => builder } as unknown as PopupsClient;
}

describe("popups service", () => {
  it("maps rows to the renderer Popup shape with active derived from status", async () => {
    const client = stubClient({
      data: [
        makeRow(),
        makeRow({
          id: "22222222-2222-4222-8222-222222222222",
          secondary_cta_label: "Case studies",
          secondary_cta_href: "/case-studies",
          featured_value_label: "Member average",
          featured_value_value: "$1,200/mo",
        }),
      ],
      error: null,
    });

    const popups = await fetchActiveSitePopups({ client });

    expect(popups).toHaveLength(2);
    expect(popups[0]).toMatchObject({
      active: true,
      trigger: "EXIT_INTENT",
      primaryCta: { label: "Watch the training", href: "/contact" },
      secondaryCta: null,
      featuredValue: null,
    });
    expect(popups[1]?.secondaryCta).toEqual({
      label: "Case studies",
      href: "/case-studies",
    });
    expect(popups[1]?.featuredValue).toMatchObject({ value: "$1,200/mo" });
  });

  it("lists admin popups with a safe status fallback", async () => {
    const client = stubClient({
      data: [makeRow({ status: "draft" }), makeRow({ status: "weird" })],
      error: null,
    });

    const list = await adminListPopups({ client });

    expect(list[0]?.status).toBe("draft");
    expect(list[0]?.popup.active).toBe(false);
    expect(list[1]?.status).toBe("draft");
  });

  it("rejects a create whose CTA href fails the allowlist", async () => {
    const client = stubClient({ data: null, error: null });
    const template = POPUP_TEMPLATES[0]!;

    await expect(
      adminCreatePopup(
        {
          fields: {
            ...template.fields,
            primaryCta: { label: "Go", href: "javascript:alert(1)" },
          },
        },
        { client },
      ),
    ).rejects.toThrow(PopupServiceError);
  });

  it("aggregates event totals per popup and overall", async () => {
    const client = stubClient({
      data: [
        { popup_id: "a", event_type: "popup_shown" },
        { popup_id: "a", event_type: "popup_shown" },
        { popup_id: "a", event_type: "popup_cta_clicked" },
        { popup_id: "b", event_type: "popup_dismissed" },
      ],
      error: null,
    });

    const totals = await adminPopupEventTotals({ client });

    expect(totals.get("a")).toEqual({
      shown: 2,
      ctaClicked: 1,
      converted: 0,
      dismissed: 0,
    });
    expect(totals.get("b")?.dismissed).toBe(1);
    expect(sumPopupEventTotals(totals.values())).toEqual({
      shown: 2,
      ctaClicked: 1,
      converted: 0,
      dismissed: 1,
    });
  });

  it("records only popup event types and never throws on failure", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const okClient = stubClient({ data: null, error: null });

    await expect(
      recordPopupEvent(
        { eventType: "popup_shown", popupId: "exit-apply" },
        { client: okClient },
      ),
    ).resolves.toBe(true);

    await expect(
      recordPopupEvent(
        { eventType: "landing_viewed", popupId: "exit-apply" },
        { client: okClient },
      ),
    ).resolves.toBe(false);

    const failingClient = {
      from: () => {
        throw new Error("relation does not exist");
      },
    } as unknown as PopupsClient;
    await expect(
      recordPopupEvent(
        { eventType: "popup_shown", popupId: "exit-apply" },
        { client: failingClient },
      ),
    ).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
