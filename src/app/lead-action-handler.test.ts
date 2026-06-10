import { describe, expect, it, vi } from "vitest";
import { submitPublicLeadAction } from "@/app/lead-action-handler";

// The handler reads request headers for referrer/user-agent. Validation runs
// before any Supabase client is constructed (submitLead parses the input first
// and throws LeadValidationError before createAdminClient is reached), so an
// invalid payload never touches the database — no Supabase mock is required.
vi.mock("next/headers", () => ({
  headers: async () => new Headers(),
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

    if (state.status === "error") {
      const fieldErrors = state.fieldErrors ?? {};
      expect(fieldErrors.businessStage).toBeUndefined();
      expect(fieldErrors.budget).toBeUndefined();
      expect(fieldErrors.timeline).toBeUndefined();
    }
  });
});
