import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createQualificationForm,
  saveQualificationForm,
  setDefaultQualificationForm,
} from "./actions";

const mocks = vi.hoisted(() => {
  class QualificationFormServiceError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "QualificationFormServiceError";
    }
  }

  return {
    QualificationFormServiceError,
    requireAdmin: vi.fn(),
    revalidatePath: vi.fn(),
    redirect: vi.fn((location: string) => {
      const error = new Error(`NEXT_REDIRECT:${location}`) as Error & {
        location: string;
      };
      error.location = location;
      throw error;
    }),
    adminCreateQualificationForm: vi.fn(),
    adminUpdateQualificationFormDraft: vi.fn(),
    adminSetDefaultQualificationForm: vi.fn(),
    publishQualificationForm: vi.fn(),
  };
});

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/services/qualification-forms", () => ({
  QualificationFormServiceError: mocks.QualificationFormServiceError,
  adminCreateQualificationForm: mocks.adminCreateQualificationForm,
  adminUpdateQualificationFormDraft: mocks.adminUpdateQualificationFormDraft,
  adminSetDefaultQualificationForm: mocks.adminSetDefaultQualificationForm,
  publishQualificationForm: mocks.publishQualificationForm,
}));

const FORM_ID = "11111111-1111-4111-8111-111111111111";

const draftSchema = {
  version: 1,
  questions: [
    {
      id: "state",
      type: "state_region",
      label: "Which state or market are you focused on?",
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
      required: true,
      normalizedRole: "available_capital",
      options: [{ id: "25-50", label: "$25k-$50k" }],
    },
  ],
};

function formData(values: Record<string, string>) {
  const data = new FormData();
  Object.entries(values).forEach(([key, value]) => data.set(key, value));
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    user: { id: "admin-1", email: "admin@example.com" },
    role: "admin",
  });
  mocks.adminCreateQualificationForm.mockResolvedValue({ id: FORM_ID });
  mocks.adminUpdateQualificationFormDraft.mockResolvedValue(undefined);
  mocks.adminSetDefaultQualificationForm.mockResolvedValue(undefined);
  mocks.publishQualificationForm.mockResolvedValue({
    versionNumber: 2,
    versionId: "22222222-2222-4222-8222-222222222222",
  });
});

describe("qualification form admin actions", () => {
  it("creates a draft form as the current admin and redirects to the editor", async () => {
    await expect(
      createQualificationForm(
        { status: "idle" },
        formData({ name: "Investor qualification" }),
      ),
    ).rejects.toMatchObject({ location: `/admin/forms/${FORM_ID}` });

    expect(mocks.requireAdmin).toHaveBeenCalled();
    expect(mocks.adminCreateQualificationForm).toHaveBeenCalledWith({
      name: "Investor qualification",
      createdBy: "admin-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/forms");
  });

  it("returns validation feedback when creating a form without a name", async () => {
    const result = await createQualificationForm(
      { status: "idle" },
      formData({ name: "   " }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Form name is required.",
    });
    expect(mocks.adminCreateQualificationForm).not.toHaveBeenCalled();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("returns the create fallback when the form cannot be created", async () => {
    const unexpectedError = new Error("database password leaked");
    mocks.adminCreateQualificationForm.mockRejectedValue(unexpectedError);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await createQualificationForm(
        { status: "idle" },
        formData({ name: "Investor qualification" }),
      );

      expect(result).toEqual({
        status: "error",
        message: "Could not create qualification form.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification form admin action failed",
        unexpectedError,
      );
      expect(mocks.redirect).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  it("saves reordered draft questions without publishing", async () => {
    const result = await saveQualificationForm(
      { status: "idle" },
      formData({
        id: FORM_ID,
        name: "Investor qualification",
        schema: JSON.stringify({
          ...draftSchema,
          questions: [draftSchema.questions[1], draftSchema.questions[0]],
        }),
        intent: "save",
      }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "Qualification form draft saved.",
    });
    expect(mocks.adminUpdateQualificationFormDraft).toHaveBeenCalledWith({
      formId: FORM_ID,
      name: "Investor qualification",
      schema: {
        ...draftSchema,
        questions: [draftSchema.questions[1], draftSchema.questions[0]],
      },
      updatedBy: "admin-1",
    });
    expect(mocks.publishQualificationForm).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).toHaveBeenCalledWith(
      `/admin/forms/${FORM_ID}`,
    );
  });

  it("defaults missing editor intent to saving the draft", async () => {
    const result = await saveQualificationForm(
      { status: "idle" },
      formData({
        id: FORM_ID,
        name: "Investor qualification",
        schema: JSON.stringify(draftSchema),
      }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "Qualification form draft saved.",
    });
    expect(mocks.adminUpdateQualificationFormDraft).toHaveBeenCalledWith({
      formId: FORM_ID,
      name: "Investor qualification",
      schema: draftSchema,
      updatedBy: "admin-1",
    });
    expect(mocks.publishQualificationForm).not.toHaveBeenCalled();
  });

  it("saves the current draft before publishing an immutable version", async () => {
    const result = await saveQualificationForm(
      { status: "idle" },
      formData({
        id: FORM_ID,
        name: "Investor qualification",
        schema: JSON.stringify(draftSchema),
        intent: "publish",
      }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "Published version 2.",
    });
    expect(mocks.adminUpdateQualificationFormDraft).toHaveBeenCalled();
    expect(mocks.publishQualificationForm).toHaveBeenCalledWith({
      formId: FORM_ID,
      publishedBy: "admin-1",
    });
  });

  it("returns validation feedback for malformed editor submissions", async () => {
    const result = await saveQualificationForm(
      { status: "idle" },
      formData({
        id: "not-a-uuid",
        name: "Investor qualification",
        schema: JSON.stringify(draftSchema),
        intent: "save",
      }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Invalid qualification form id.",
    });
    expect(mocks.adminUpdateQualificationFormDraft).not.toHaveBeenCalled();
  });

  it("returns a safe error when the draft schema payload is not readable JSON", async () => {
    const result = await saveQualificationForm(
      { status: "idle" },
      formData({
        id: FORM_ID,
        name: "Investor qualification",
        schema: "{not-json",
        intent: "save",
      }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Could not read the question draft. Refresh and try again.",
    });
    expect(mocks.adminUpdateQualificationFormDraft).not.toHaveBeenCalled();
  });

  it("returns user-facing validation errors without updating draft data", async () => {
    mocks.adminUpdateQualificationFormDraft.mockRejectedValue(
      new mocks.QualificationFormServiceError("Question label is required."),
    );

    const result = await saveQualificationForm(
      { status: "idle" },
      formData({
        id: FORM_ID,
        name: "Investor qualification",
        schema: JSON.stringify({
          version: 1,
          questions: [{ id: "empty", type: "short_text", label: "" }],
        }),
        intent: "publish",
      }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Question label is required.",
    });
    expect(mocks.publishQualificationForm).not.toHaveBeenCalled();
  });

  it("returns the fallback save error without leaking unexpected failures", async () => {
    const unexpectedError = new Error("database password leaked");
    mocks.adminUpdateQualificationFormDraft.mockRejectedValue(unexpectedError);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await saveQualificationForm(
        { status: "idle" },
        formData({
          id: FORM_ID,
          name: "Investor qualification",
          schema: JSON.stringify(draftSchema),
          intent: "save",
        }),
      );

      expect(result).toEqual({
        status: "error",
        message: "Could not save qualification form.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification form admin action failed",
        unexpectedError,
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it("sets the default form through an admin-gated action", async () => {
    const result = await setDefaultQualificationForm(
      { status: "idle" },
      formData({ id: FORM_ID }),
    );

    expect(result).toEqual({
      status: "saved",
      message: "Default qualification form updated.",
    });
    expect(mocks.requireAdmin).toHaveBeenCalled();
    expect(mocks.adminSetDefaultQualificationForm).toHaveBeenCalledWith({
      formId: FORM_ID,
      updatedBy: "admin-1",
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/forms");
  });

  it("returns validation feedback for invalid default form submissions", async () => {
    const result = await setDefaultQualificationForm(
      { status: "idle" },
      formData({ id: "invalid-id" }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Invalid qualification form id.",
    });
    expect(mocks.adminSetDefaultQualificationForm).not.toHaveBeenCalled();
  });

  it("returns the service error when default form selection fails validation", async () => {
    mocks.adminSetDefaultQualificationForm.mockRejectedValue(
      new mocks.QualificationFormServiceError(
        "Only published forms can become default.",
      ),
    );

    const result = await setDefaultQualificationForm(
      { status: "idle" },
      formData({ id: FORM_ID }),
    );

    expect(result).toEqual({
      status: "error",
      message: "Only published forms can become default.",
    });
  });

  it("returns the default-form fallback without leaking unexpected failures", async () => {
    const unexpectedError = new Error("service role key leaked");
    mocks.adminSetDefaultQualificationForm.mockRejectedValue(unexpectedError);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    try {
      const result = await setDefaultQualificationForm(
        { status: "idle" },
        formData({ id: FORM_ID }),
      );

      expect(result).toEqual({
        status: "error",
        message: "Could not update default qualification form.",
      });
      expect(consoleError).toHaveBeenCalledWith(
        "qualification form admin action failed",
        unexpectedError,
      );
    } finally {
      consoleError.mockRestore();
    }
  });
});
