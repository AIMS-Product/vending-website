import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { QualificationFormsManager } from "./QualificationFormsManager";
import type { QualificationFormActionState } from "@/app/admin/forms/actions";
import type { AdminQualificationForm } from "@/lib/services/qualification-forms";

vi.mock("@/app/admin/forms/actions", () => ({
  createQualificationForm: vi.fn(),
  setDefaultQualificationForm: vi.fn(),
}));

const actionStateOverride = vi.hoisted(() => ({
  current: null as QualificationFormActionState | null,
}));

vi.mock("react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("react")>();
  return {
    ...actual,
    useActionState: (_action: unknown, initialState: unknown) => [
      actionStateOverride.current ?? initialState,
      vi.fn(),
    ],
  };
});

afterEach(() => {
  actionStateOverride.current = null;
});

const forms: AdminQualificationForm[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    name: "Investor qualification",
    slug: null,
    status: "published",
    isDefault: true,
    draftSchema: {
      version: 1,
      questions: [
        {
          id: "state",
          type: "state_region",
          label: "Which state or market are you focused on?",
          helpText: "",
          placeholder: "",
          required: true,
          options: [{ id: "sa", label: "South Australia" }],
        },
      ],
    },
    currentPublishedVersionId: "22222222-2222-4222-8222-222222222222",
    draftQuestionCount: 1,
    createdAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:00:00.000Z",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Draft follow-up",
    slug: null,
    status: "draft",
    isDefault: false,
    draftSchema: {
      version: 1,
      questions: [
        {
          id: "goal",
          type: "short_text",
          label: "What is your main goal?",
          helpText: "",
          placeholder: "",
          required: true,
        },
      ],
    },
    currentPublishedVersionId: null,
    draftQuestionCount: 1,
    createdAt: "2026-06-17T00:00:00.000Z",
    updatedAt: "2026-06-17T00:00:00.000Z",
  },
];

describe("QualificationFormsManager", () => {
  it("renders draft, published, and default state with editor links", () => {
    const html = renderToStaticMarkup(
      <QualificationFormsManager forms={forms} />,
    );

    expect(html).toContain("Investor qualification");
    expect(html).toContain("Published");
    expect(html).toContain("Default");
    expect(html).toContain(
      'href="/admin/forms/11111111-1111-4111-8111-111111111111"',
    );
    expect(html).toContain("Draft follow-up");
    expect(html).toContain("Draft");
    expect(html).toContain("Set default");
  });

  it("shows a create action and an empty state without technical schema copy", () => {
    const html = renderToStaticMarkup(<QualificationFormsManager forms={[]} />);

    expect(html).toContain("Create form");
    expect(html).toContain("No qualification forms yet");
    expect(html).not.toContain("draft_schema");
    expect(html).not.toContain("current_published_version_id");
  });

  it("re-fills the typed name and shows the reason after a failed create", () => {
    actionStateOverride.current = {
      status: "error",
      message: "Form name must be 120 characters or fewer.",
      values: { name: "My typed form name" },
    };

    const html = renderToStaticMarkup(<QualificationFormsManager forms={[]} />);

    expect(html).toContain('value="My typed form name"');
    expect(html).toContain("Form name must be 120 characters or fewer.");
    expect(html).toContain('role="alert"');
  });
});
