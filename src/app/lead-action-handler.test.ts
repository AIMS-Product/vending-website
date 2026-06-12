import { describe, expect, it, vi } from "vitest";
import { submitPublicLeadAction } from "@/app/lead-action-handler";

// The handler reads request headers for referrer/user-agent.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
}));

// A valid payload gets past validation and reaches the Supabase admin client,
// so the boundary must be mocked or the test makes a real network call (which
// hangs in offline runs). The stub fails the first query deterministically:
// validation has already passed by then, which is all these tests assert.
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: null,
            error: { message: "stubbed: no database in unit tests" },
          }),
        }),
      }),
    }),
  }),
}));

function applyFormData(overrides: Record<string, string> = {}): FormData {
  const data = new FormData();
  data.set("idempotency_key", "handler-test-key");
  for (const [key, value] of Object.entries(overrides)) {
    data.set(key, value);
  }
  return data;
}

describe("submitPublicLeadAction", () => {
  it("returns per-field errors for every required apply field on an empty payload", async () => {
    const state = await submitPublicLeadAction("apply", applyFormData());

    expect(state.status).toBe("error");
    if (state.status !== "error") throw new Error("expected error state");

    const fieldErrors = state.fieldErrors ?? {};
    expect(fieldErrors.fullName?.[0]).toMatch(/required/i);
    expect(fieldErrors.email?.length).toBeGreaterThan(0);
    expect(fieldErrors.stateRegion?.[0]).toMatch(/required/i);
    expect(fieldErrors.businessStage?.[0]).toMatch(/required/i);
    expect(fieldErrors.budget?.[0]).toMatch(/required/i);
    expect(fieldErrors.timeline?.[0]).toMatch(/required/i);
  });

  it("accepts the apply qualification selects' 'Not sure yet' choice through validation", async () => {
    // "Not sure yet" must clear the apply qualification requirement: the
    // server treats these as non-empty free-text, so validation should not
    // report stage/budget/timeline as missing when that option is chosen.
    // The stubbed DB then fails the idempotency check, so the action returns
    // the generic submission error — with no validation field errors.
    const state = await submitPublicLeadAction(
      "apply",
      applyFormData({
        full_name: "Jane Applicant",
        email: "jane@example.com",
        state_region: "Texas",
        business_stage: "Not sure yet",
        budget: "Not sure yet",
        timeline: "Not sure yet",
      }),
    );

    expect(state.status).toBe("error");
    if (state.status !== "error") throw new Error("expected error state");
    expect(state.message).toMatch(/couldn't submit/i);
    expect(state.fieldErrors).toBeUndefined();
  });
});
