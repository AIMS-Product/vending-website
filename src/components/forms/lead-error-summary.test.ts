import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { deriveLeadErrorSummary } from "./lead-error-summary";
import { PublicLeadForm, type PublicLeadFormAction } from "./PublicLeadForm";
import { initialLeadActionState } from "@/app/lead-action-state";
import type { LeadAttribution } from "@/lib/lead-attribution";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

const attribution: LeadAttribution = {
  source_path: "/apply",
  landing_path: "/apply",
  referrer: "",
  source_page_id: "page_1",
  source_page_slug: "apply",
  target_keyword: "",
  source_block_id: "",
  source_cta_tracking_name: "",
  utm_source: "",
  utm_medium: "",
  utm_campaign: "",
  utm_term: "",
  utm_content: "",
};

const action: PublicLeadFormAction = async () => initialLeadActionState;

describe("deriveLeadErrorSummary", () => {
  it("returns nothing for idle and success states", () => {
    expect(deriveLeadErrorSummary({ status: "idle" })).toEqual([]);
    expect(
      deriveLeadErrorSummary({
        status: "success",
        message: "ok",
        leadId: "lead_1",
      }),
    ).toEqual([]);
  });

  it("returns nothing for an error state with no field errors", () => {
    expect(
      deriveLeadErrorSummary({
        status: "error",
        message: "We couldn't submit the form. Try again in a moment.",
      }),
    ).toEqual([]);
  });

  it("lists failed fields with their label and input id, in field order", () => {
    const items = deriveLeadErrorSummary({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: {
        email: ["Enter a valid email."],
        fullName: ["Name is required."],
        stateRegion: ["State is required."],
      },
    });

    // Ordered top-to-bottom by field position, not by fieldErrors key order.
    expect(items).toEqual([
      { errorKey: "fullName", label: "Name", inputId: "lead-full_name" },
      { errorKey: "email", label: "Email", inputId: "lead-email" },
      {
        errorKey: "stateRegion",
        label: "State",
        inputId: "lead-state_region",
      },
    ]);
  });

  it("ignores empty error arrays", () => {
    const items = deriveLeadErrorSummary({
      status: "error",
      message: "Check the highlighted fields and try again.",
      fieldErrors: { phone: [] },
    });
    expect(items).toEqual([]);
  });
});

describe("PublicLeadForm error summary", () => {
  function renderWithErrors() {
    return renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-apply-summary",
        intent: "apply",
        submitLabel: "Apply now",
        initialState: {
          status: "error",
          message: "Check the highlighted fields and try again.",
          fieldErrors: {
            fullName: ["Name is required."],
            email: ["Enter a valid email."],
          },
        },
      }),
    );
  }

  it("renders a focusable alert summary with a count and anchors per failed field", () => {
    const html = renderWithErrors();

    expect(html).toContain('role="alert"');
    expect(html).toContain('tabindex="-1"');
    // Plain-language count.
    expect(html).toMatch(/2 problems with your application/);
    // Anchors point at the matching inputs.
    expect(html).toContain('href="#lead-full_name"');
    expect(html).toContain('href="#lead-email"');
    expect(html).toContain("Name");
    expect(html).toContain("Enter a valid email.");
  });

  it("does not render the summary when there are no field errors", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-apply-nosummary",
        intent: "apply",
        submitLabel: "Apply now",
      }),
    );
    expect(html).not.toContain('role="alert"');
  });

  it("uses singular copy for a single failed field", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLeadForm, {
        action,
        attribution,
        idempotencyKey: "lead-apply-one",
        intent: "apply",
        submitLabel: "Apply now",
        initialState: {
          status: "error",
          message: "Check the highlighted fields and try again.",
          fieldErrors: { fullName: ["Name is required."] },
        },
      }),
    );
    expect(html).toMatch(/1 problem with your application/);
  });
});
