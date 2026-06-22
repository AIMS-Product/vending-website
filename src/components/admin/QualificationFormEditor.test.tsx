import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { QualificationFormEditor } from "./QualificationFormEditor";
import type { AdminQualificationForm } from "@/lib/services/qualification-forms";

vi.mock("@/app/admin/forms/actions", () => ({
  saveQualificationForm: vi.fn(),
  setDefaultQualificationForm: vi.fn(),
}));

const form: AdminQualificationForm = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "Investor qualification",
  slug: null,
  status: "published",
  isDefault: false,
  draftSchema: {
    version: 1,
    questions: [
      {
        id: "state",
        type: "state_region",
        label: "Which state or market are you focused on?",
        helpText: "Choose the first market you want to work in.",
        placeholder: "",
        required: true,
        normalizedRole: "state_market",
        options: [
          { id: "sa", label: "South Australia", value: "SA" },
          { id: "vic", label: "Victoria", value: "VIC" },
        ],
      },
      {
        id: "budget",
        type: "budget_range",
        label: "How much capital can you access?",
        helpText: "",
        placeholder: "",
        required: true,
        normalizedRole: "available_capital",
        options: [{ id: "25-50", label: "$25k-$50k" }],
      },
    ],
  },
  currentPublishedVersionId: "22222222-2222-4222-8222-222222222222",
  draftQuestionCount: 2,
  createdAt: "2026-06-17T00:00:00.000Z",
  updatedAt: "2026-06-17T00:00:00.000Z",
};

describe("QualificationFormEditor", () => {
  it("renders content-only question controls and publish actions", () => {
    const html = renderToStaticMarkup(<QualificationFormEditor form={form} />);

    expect(html).toContain("Form name");
    expect(html).toContain("Question label");
    expect(html).toContain("Help text");
    expect(html).toContain("Placeholder");
    expect(html).toContain("Required");
    expect(html).toContain("Lead profile field");
    expect(html).toContain("Lead routing");
    expect(html).toContain("State or market");
    expect(html).toContain("Option label");
    expect(html).toContain("Internal value");
    expect(html).toContain("Move up");
    expect(html).toContain("Move down");
    expect(html).toContain("Delete question");
    expect(html).toContain("Save draft");
    expect(html).toContain("Publish version");
  });

  it("renders a prospect preview without public submission controls or out-of-scope fields", () => {
    const html = renderToStaticMarkup(<QualificationFormEditor form={form} />);

    expect(html).toContain("Prospect preview");
    expect(html).toContain("Prospect view");
    expect(html).toContain("Which state or market are you focused on?");
    expect(html).toContain("How much capital can you access?");
    expect(html).not.toContain('type="file"');
    expect(html).not.toContain("Payment");
    expect(html).not.toContain("Branching");
    expect(html).not.toContain("Script");
    expect(html).not.toContain("Raw JSON");
    expect(html).not.toContain("draft_schema");
    expect(html).not.toContain("Normalized role");
  });
});
