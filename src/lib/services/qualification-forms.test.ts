import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  adminCreateQualificationForm,
  adminGetQualificationForm,
  adminListQualificationForms,
  adminSetDefaultQualificationForm,
  adminUpdateQualificationFormDraft,
  buildQuestionSnapshots,
  getQualificationFormVersion,
  publishQualificationForm,
  qualificationFormSchema,
  resolveDefaultQualificationFormVersion,
  resolvePublishedQualificationFormVersion,
} from "./qualification-forms";
import type { Database, Json } from "@/types/database";

type QualificationFormRow =
  Database["public"]["Tables"]["qualification_forms"]["Row"];
type QualificationFormVersionRow =
  Database["public"]["Tables"]["qualification_form_versions"]["Row"];
type QualificationFormClient = Pick<SupabaseClient<Database>, "from">;

type FakeState = {
  forms: QualificationFormRow[];
  versions: QualificationFormVersionRow[];
  versionUpdates: Array<{
    table: string;
    patch: Record<string, unknown>;
  }>;
};

const baseFormSchema = {
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
      options: [
        { id: "10-25", label: "$10k-$25k", value: "10000-25000" },
        { id: "25-50", label: "$25k-$50k", value: "25000-50000" },
      ],
    },
    {
      id: "consent",
      type: "consent",
      label: "I agree to be contacted about my vending enquiry.",
      required: true,
      normalizedRole: "consent",
    },
  ],
} as const;

function makeForm(
  overrides: Partial<QualificationFormRow> = {},
): QualificationFormRow {
  return {
    id: "form_1",
    name: "Default qualification",
    slug: "default-qualification",
    status: "draft",
    is_default: false,
    draft_schema: baseFormSchema as unknown as Json,
    current_published_version_id: null,
    created_by: null,
    updated_by: null,
    created_at: "2026-06-17T00:00:00.000Z",
    updated_at: "2026-06-17T00:00:00.000Z",
    ...overrides,
  };
}

function buildClient(initial: Partial<FakeState> = {}) {
  const state: FakeState = {
    forms: [makeForm()],
    versions: [],
    versionUpdates: [],
    ...initial,
  };

  return {
    state,
    client: {
      from(table: string) {
        return new FakeQuery(table, state);
      },
    } as unknown as QualificationFormClient,
  };
}

class FakeQuery {
  private filters: Array<{ key: string; value: unknown; op: "eq" | "neq" }> =
    [];
  private orderKey: string | null = null;
  private orderAscending = true;
  private limitCount: number | null = null;
  private selectedFields = "";

  constructor(
    private table: string,
    private state: FakeState,
  ) {}

  select(fields = "*") {
    this.selectedFields = fields;
    return this;
  }

  eq(key: string, value: unknown) {
    this.filters.push({ key, value, op: "eq" });
    return this;
  }

  neq(key: string, value: unknown) {
    this.filters.push({ key, value, op: "neq" });
    return this;
  }

  order(key: string, opts: { ascending?: boolean } = {}) {
    this.orderKey = key;
    this.orderAscending = opts.ascending ?? true;
    return this;
  }

  limit(count: number) {
    this.limitCount = count;
    return this;
  }

  async maybeSingle() {
    const rows = this.rows();
    return { data: rows[0] ?? null, error: null };
  }

  async single() {
    const rows = this.rows();
    return {
      data: rows[0] ?? null,
      error: rows[0] ? null : { message: "Not found" },
    };
  }

  update(patch: Record<string, unknown>) {
    if (this.table === "qualification_form_versions") {
      this.state.versionUpdates.push({ table: this.table, patch });
    }
    const apply = async () => {
      if (this.table === "qualification_forms") {
        this.state.forms = this.state.forms.map((row) =>
          this.matches(row)
            ? ({ ...row, ...patch } as QualificationFormRow)
            : row,
        );
      }
      return { data: null, error: null };
    };
    return {
      eq: (key: string, value: unknown) => {
        this.eq(key, value);
        return apply();
      },
      neq: (key: string, value: unknown) => {
        this.neq(key, value);
        return apply();
      },
    };
  }

  insert(value: Record<string, unknown>) {
    if (this.table === "qualification_forms") {
      const row = makeForm({
        id: `form_${this.state.forms.length + 1}`,
        name: value.name as string,
        slug: (value.slug as string | null | undefined) ?? null,
        status: (value.status as string | undefined) ?? "draft",
        is_default: (value.is_default as boolean | undefined) ?? false,
        draft_schema:
          (value.draft_schema as Json | undefined) ??
          (baseFormSchema as unknown as Json),
        created_by: (value.created_by as string | null | undefined) ?? null,
        updated_by: (value.updated_by as string | null | undefined) ?? null,
      });
      this.state.forms.push(row);
      return {
        select: () => ({
          single: async () => ({ data: row, error: null }),
        }),
      };
    }

    if (this.table !== "qualification_form_versions") {
      throw new Error(`Unexpected insert into ${this.table}`);
    }
    const row: QualificationFormVersionRow = {
      id: `version_${this.state.versions.length + 1}`,
      form_id: value.form_id as string,
      version_number: value.version_number as number,
      schema_snapshot: value.schema_snapshot as Json,
      question_count: value.question_count as number,
      normalized_roles: value.normalized_roles as string[],
      published_by: (value.published_by as string | null | undefined) ?? null,
      published_at: "2026-06-17T00:00:00.000Z",
      created_at: "2026-06-17T00:00:00.000Z",
    };
    this.state.versions.push(row);
    return {
      select: () => ({
        single: async () => ({ data: row, error: null }),
      }),
    };
  }

  then(resolve: (value: { data: unknown[]; error: null }) => void) {
    resolve({ data: this.rows(), error: null });
  }

  private rows() {
    let rows: Array<QualificationFormRow | QualificationFormVersionRow> =
      this.table === "qualification_forms"
        ? [...this.state.forms]
        : [...this.state.versions];
    rows = rows.filter((row) => this.matches(row));
    if (this.orderKey) {
      rows.sort((a, b) => {
        const av = (a as Record<string, unknown>)[this.orderKey!];
        const bv = (b as Record<string, unknown>)[this.orderKey!];
        const compared = String(av ?? "").localeCompare(String(bv ?? ""));
        return this.orderAscending ? compared : -compared;
      });
    }
    if (this.limitCount != null) rows = rows.slice(0, this.limitCount);
    void this.selectedFields;
    return rows;
  }

  private matches(row: object) {
    return this.filters.every(({ key, value, op }) => {
      const actual = (row as Record<string, unknown>)[key];
      return op === "eq" ? actual === value : actual !== value;
    });
  }
}

describe("qualification form schema", () => {
  it("accepts the supported v1 content-only question types", () => {
    const parsed = qualificationFormSchema.parse({
      version: 1,
      questions: [
        { id: "short", type: "short_text", label: "Short answer" },
        { id: "long", type: "long_text", label: "Long answer" },
        { id: "email", type: "email", label: "Confirm email" },
        { id: "phone", type: "phone", label: "Confirm phone" },
        {
          id: "single",
          type: "single_choice",
          label: "Pick one",
          options: [{ id: "one", label: "One" }],
        },
        {
          id: "multi",
          type: "multiple_choice",
          label: "Pick many",
          options: [{ id: "many", label: "Many" }],
        },
        { id: "yesno", type: "yes_no", label: "Yes or no" },
        { id: "number", type: "number", label: "How many?" },
        { id: "currency", type: "currency", label: "How much?" },
        {
          id: "budget",
          type: "budget_range",
          label: "Budget range",
          options: [{ id: "10-25", label: "$10k-$25k" }],
        },
        {
          id: "state",
          type: "state_region",
          label: "State",
          options: [{ id: "sa", label: "South Australia" }],
        },
        { id: "date", type: "date", label: "Target date" },
        {
          id: "timeframe",
          type: "timeframe",
          label: "Timeframe",
          options: [{ id: "soon", label: "As soon as possible" }],
        },
        { id: "consent", type: "consent", label: "I agree" },
      ],
    });

    expect(parsed.questions.map((question) => question.type)).toEqual([
      "short_text",
      "long_text",
      "email",
      "phone",
      "single_choice",
      "multiple_choice",
      "yes_no",
      "number",
      "currency",
      "budget_range",
      "state_region",
      "date",
      "timeframe",
      "consent",
    ]);
  });

  it("rejects unsupported question types, scripts, and branching controls", () => {
    expect(
      qualificationFormSchema.safeParse({
        version: 1,
        questions: [
          {
            id: "upload",
            type: "file_upload",
            label: "Upload your business plan",
          },
        ],
      }).success,
    ).toBe(false);

    expect(
      qualificationFormSchema.safeParse({
        version: 1,
        questions: [
          {
            id: "budget",
            type: "short_text",
            label: "Budget",
            script: "alert(1)",
            branching: [{ if: "budget", then: "skip" }],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("serializes question and option snapshots for immutable answers", () => {
    const snapshots = buildQuestionSnapshots(
      qualificationFormSchema.parse(baseFormSchema),
    );

    expect(snapshots).toEqual([
      expect.objectContaining({
        id: "state",
        type: "state_region",
        label: "Which state or market are you focused on?",
        normalizedRole: "state_market",
        options: [
          { id: "sa", label: "South Australia", value: "SA" },
          { id: "vic", label: "Victoria", value: "VIC" },
        ],
      }),
      expect.objectContaining({ id: "budget" }),
      expect.objectContaining({ id: "consent", type: "consent" }),
    ]);
  });
});

describe("qualification form services", () => {
  it("publishes draft schemas as immutable incrementing versions", async () => {
    const fake = buildClient();

    const first = await publishQualificationForm(
      { formId: "form_1", publishedBy: "admin_1" },
      { client: fake.client },
    );

    await adminUpdateQualificationFormDraft(
      {
        formId: "form_1",
        name: "Default qualification",
        schema: {
          ...baseFormSchema,
          questions: [
            {
              ...baseFormSchema.questions[0],
              label: "Which market should we focus on first?",
            },
            ...baseFormSchema.questions.slice(1),
          ],
        },
      },
      { client: fake.client },
    );

    const second = await publishQualificationForm(
      { formId: "form_1", publishedBy: "admin_1" },
      { client: fake.client },
    );

    expect(first.versionNumber).toBe(1);
    expect(second.versionNumber).toBe(2);
    expect(fake.state.versionUpdates).toEqual([]);
    expect(
      (
        fake.state.versions[0]
          ?.schema_snapshot as unknown as typeof baseFormSchema
      ).questions[0]?.label,
    ).toBe("Which state or market are you focused on?");
    expect(
      (
        fake.state.versions[1]
          ?.schema_snapshot as unknown as typeof baseFormSchema
      ).questions[0]?.label,
    ).toBe("Which market should we focus on first?");
  });

  it("lists qualification forms newest first with draft and published state", async () => {
    const fake = buildClient({
      forms: [
        makeForm({
          id: "form_old",
          name: "Old intake",
          status: "draft",
          created_at: "2026-06-16T00:00:00.000Z",
        }),
        makeForm({
          id: "form_new",
          name: "Published intake",
          status: "published",
          is_default: true,
          current_published_version_id: "version_1",
          created_at: "2026-06-17T00:00:00.000Z",
        }),
      ],
    });

    await expect(
      adminListQualificationForms({ client: fake.client }),
    ).resolves.toEqual([
      expect.objectContaining({
        id: "form_new",
        name: "Published intake",
        status: "published",
        isDefault: true,
        currentPublishedVersionId: "version_1",
        draftQuestionCount: 3,
      }),
      expect.objectContaining({
        id: "form_old",
        name: "Old intake",
        status: "draft",
        isDefault: false,
      }),
    ]);
  });

  it("creates a draft qualification form with local admin ownership", async () => {
    const fake = buildClient({ forms: [] });

    const created = await adminCreateQualificationForm(
      {
        name: "Investor intake",
        createdBy: "admin_1",
      },
      { client: fake.client },
    );

    expect(created).toMatchObject({
      name: "Investor intake",
      status: "draft",
      isDefault: false,
      draftQuestionCount: 1,
    });
    expect(fake.state.forms[0]).toMatchObject({
      name: "Investor intake",
      status: "draft",
      created_by: "admin_1",
      updated_by: "admin_1",
    });
  });

  it("loads one editable qualification form draft for the admin editor", async () => {
    const fake = buildClient({
      forms: [
        makeForm({
          id: "form_2",
          name: "Growth intake",
          is_default: true,
        }),
      ],
    });

    await expect(
      adminGetQualificationForm({ formId: "form_2" }, { client: fake.client }),
    ).resolves.toMatchObject({
      id: "form_2",
      name: "Growth intake",
      isDefault: true,
      draftQuestionCount: 3,
    });
  });

  it("sets the default only after a form has a published version", async () => {
    const fake = buildClient({
      forms: [
        makeForm({
          id: "form_1",
          status: "published",
          is_default: true,
          current_published_version_id: "version_1",
        }),
        makeForm({
          id: "form_2",
          name: "Growth intake",
          status: "published",
          current_published_version_id: "version_2",
        }),
      ],
    });

    await adminSetDefaultQualificationForm(
      { formId: "form_2", updatedBy: "admin_2" },
      { client: fake.client },
    );

    expect(fake.state.forms).toEqual([
      expect.objectContaining({ id: "form_1", is_default: false }),
      expect.objectContaining({
        id: "form_2",
        is_default: true,
        updated_by: "admin_2",
      }),
    ]);
  });

  it("blocks default selection for unpublished forms", async () => {
    const fake = buildClient({
      forms: [makeForm({ id: "form_2", status: "draft" })],
    });

    await expect(
      adminSetDefaultQualificationForm(
        { formId: "form_2" },
        { client: fake.client },
      ),
    ).rejects.toThrow("Publish this form before setting it as the default.");

    expect(fake.state.forms[0]?.is_default).toBe(false);
  });

  it("blocks publishing invalid required question drafts", async () => {
    const fake = buildClient({
      forms: [
        makeForm({
          draft_schema: {
            version: 1,
            questions: [{ id: "empty", type: "short_text", label: "" }],
          } as unknown as Json,
        }),
      ],
    });

    await expect(
      publishQualificationForm({ formId: "form_1" }, { client: fake.client }),
    ).rejects.toThrow("Question label is required.");

    expect(fake.state.versions).toEqual([]);
  });

  it("resolves the default form to its current published version", async () => {
    const fake = buildClient({
      forms: [
        makeForm({
          status: "published",
          is_default: true,
          current_published_version_id: "version_1",
        }),
      ],
      versions: [
        {
          id: "version_1",
          form_id: "form_1",
          version_number: 1,
          schema_snapshot: baseFormSchema as unknown as Json,
          question_count: 3,
          normalized_roles: ["state_market", "available_capital", "consent"],
          published_by: "admin_1",
          published_at: "2026-06-17T00:00:00.000Z",
          created_at: "2026-06-17T00:00:00.000Z",
        },
      ],
    });

    await expect(
      resolveDefaultQualificationFormVersion({ client: fake.client }),
    ).resolves.toMatchObject({
      formId: "form_1",
      versionId: "version_1",
      versionNumber: 1,
      questionCount: 3,
    });
  });

  it("resolves a selected published form to its current version", async () => {
    const fake = buildClient({
      forms: [
        makeForm({
          id: "form_default",
          status: "published",
          is_default: true,
          current_published_version_id: "version_1",
        }),
        makeForm({
          id: "form_block",
          name: "Block qualification",
          status: "published",
          current_published_version_id: "version_2",
        }),
      ],
      versions: [
        {
          id: "version_1",
          form_id: "form_default",
          version_number: 1,
          schema_snapshot: baseFormSchema as unknown as Json,
          question_count: 3,
          normalized_roles: ["state_market", "available_capital", "consent"],
          published_by: "admin_1",
          published_at: "2026-06-17T00:00:00.000Z",
          created_at: "2026-06-17T00:00:00.000Z",
        },
        {
          id: "version_2",
          form_id: "form_block",
          version_number: 4,
          schema_snapshot: baseFormSchema as unknown as Json,
          question_count: 3,
          normalized_roles: ["state_market", "available_capital", "consent"],
          published_by: "admin_2",
          published_at: "2026-06-17T01:00:00.000Z",
          created_at: "2026-06-17T01:00:00.000Z",
        },
      ],
    });

    await expect(
      resolvePublishedQualificationFormVersion(
        { formId: "form_block" },
        { client: fake.client },
      ),
    ).resolves.toMatchObject({
      formId: "form_block",
      versionId: "version_2",
      versionNumber: 4,
    });
  });

  it("loads existing sessions by immutable version id instead of latest draft", async () => {
    const fake = buildClient();
    const first = await publishQualificationForm(
      { formId: "form_1" },
      { client: fake.client },
    );
    await adminUpdateQualificationFormDraft(
      {
        formId: "form_1",
        schema: {
          ...baseFormSchema,
          questions: [
            { ...baseFormSchema.questions[0], label: "Changed later" },
            ...baseFormSchema.questions.slice(1),
          ],
        },
      },
      { client: fake.client },
    );
    await publishQualificationForm(
      { formId: "form_1" },
      { client: fake.client },
    );

    await expect(
      getQualificationFormVersion(
        { versionId: first.versionId },
        { client: fake.client },
      ),
    ).resolves.toMatchObject({
      versionId: first.versionId,
      schema: expect.objectContaining({
        questions: [
          expect.objectContaining({
            label: "Which state or market are you focused on?",
          }),
          expect.any(Object),
          expect.any(Object),
        ],
      }),
    });
  });
});
