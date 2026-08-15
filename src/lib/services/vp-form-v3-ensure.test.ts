import { beforeEach, describe, expect, it } from "vitest";
import { parseQualificationFormSchema } from "@/lib/qualification/forms";
import {
  ensureVpFormV3Published,
  resetVpFormV3EnsureMemoForTests,
  vpFormV3Schema,
} from "./vp-form-v3-ensure";

const FORM_ID = "a1b2c3d4-0000-4000-8000-000000000001";
const V2_VERSION_ID = "a1b2c3d4-0000-4000-8000-000000000003";
const V3_VERSION_ID = "a1b2c3d4-0000-4000-8000-000000000004";

type FakeState = {
  form: {
    id: string;
    current_published_version_id: string | null;
    draft_schema?: unknown;
    updated_at?: string;
  } | null;
  versions: Array<
    { id: string; published_by?: string | null } & Record<string, unknown>
  >;
  insertErrorCode?: string;
  failSelects?: boolean;
};

// Minimal builder fake covering exactly the calls the ensure step makes:
// select().eq().maybeSingle(), update().eq(), insert().
function fakeClient(state: FakeState) {
  return {
    from(table: string) {
      return {
        select() {
          return {
            eq(_key: string, value: unknown) {
              return {
                async maybeSingle() {
                  if (state.failSelects) {
                    return { data: null, error: { message: "boom" } };
                  }
                  if (table === "qualification_forms") {
                    return { data: state.form, error: null };
                  }
                  if (table === "qualification_form_versions") {
                    return {
                      data:
                        state.versions.find((row) => row.id === value) ?? null,
                      error: null,
                    };
                  }
                  return { data: null, error: null };
                },
              };
            },
          };
        },
        update(patch: Record<string, unknown>) {
          return {
            async eq() {
              if (table === "qualification_forms" && state.form) {
                Object.assign(state.form, patch);
              }
              return { data: null, error: null };
            },
          };
        },
        async insert(row: Record<string, unknown>) {
          if (state.insertErrorCode) {
            return { error: { code: state.insertErrorCode } };
          }
          state.versions.push(row as FakeState["versions"][number]);
          return { error: null };
        },
      };
    },
  } as never;
}

function v2State(): FakeState {
  return {
    form: { id: FORM_ID, current_published_version_id: V2_VERSION_ID },
    versions: [{ id: V2_VERSION_ID, published_by: "user_kody" }],
  };
}

describe("vpFormV3Schema", () => {
  it("is a valid qualification schema with the Form V2 shape", () => {
    const parsed = parseQualificationFormSchema(vpFormV3Schema());
    expect(parsed.questions).toHaveLength(8);
    expect(parsed.questions.filter((q) => q.required).map((q) => q.id)).toEqual(
      ["consent_updates", "consent_contact", "invest"],
    );
    const operator = parsed.questions.find((q) => q.id === "operator");
    expect(operator?.normalizedRole).toBe("operator_status");
    expect(operator?.options?.map((o) => o.value)).toEqual(["yes", "no"]);
  });
});

describe("ensureVpFormV3Published", () => {
  beforeEach(() => {
    resetVpFormV3EnsureMemoForTests();
  });

  it("publishes version 3 against a v2 database", async () => {
    const state = v2State();

    const result = await ensureVpFormV3Published({
      client: fakeClient(state),
      now: () => new Date("2026-08-15T00:00:00.000Z"),
    });

    expect(result).toEqual({ status: "published" });
    expect(state.form?.current_published_version_id).toBe(V3_VERSION_ID);
    expect(state.form?.draft_schema).toEqual(vpFormV3Schema());
    const v3 = state.versions.find((row) => row.id === V3_VERSION_ID);
    expect(v3).toMatchObject({
      form_id: FORM_ID,
      version_number: 3,
      question_count: 8,
      // published_by carries over from the v2 publication, like the SQL
      // migration.
      published_by: "user_kody",
    });
    expect(v3?.schema_snapshot).toEqual(vpFormV3Schema());
  });

  it("no-ops when version 3 is already published", async () => {
    const state: FakeState = {
      form: { id: FORM_ID, current_published_version_id: V3_VERSION_ID },
      versions: [{ id: V2_VERSION_ID }, { id: V3_VERSION_ID }],
    };

    const result = await ensureVpFormV3Published({
      client: fakeClient(state),
    });

    expect(result).toEqual({ status: "already" });
    expect(state.versions).toHaveLength(2);
  });

  it("memoizes per process once ensured", async () => {
    const state = v2State();
    await ensureVpFormV3Published({ client: fakeClient(state) });

    // A client that would explode proves the second call never touches it.
    const result = await ensureVpFormV3Published({
      client: {
        from: () => {
          throw new Error("touched");
        },
      } as never,
    });
    expect(result).toEqual({ status: "already" });
  });

  it("repairs a half-applied state (version row exists, pointer stale)", async () => {
    const state: FakeState = {
      form: { id: FORM_ID, current_published_version_id: V2_VERSION_ID },
      versions: [{ id: V2_VERSION_ID }, { id: V3_VERSION_ID }],
    };

    const result = await ensureVpFormV3Published({
      client: fakeClient(state),
    });

    expect(result).toEqual({ status: "published" });
    expect(state.form?.current_published_version_id).toBe(V3_VERSION_ID);
    // The existing version row is left alone.
    expect(
      state.versions.filter((row) => row.id === V3_VERSION_ID),
    ).toHaveLength(1);
  });

  it("treats losing the insert race as success", async () => {
    const state = v2State();
    state.insertErrorCode = "23505";

    const result = await ensureVpFormV3Published({
      client: fakeClient(state),
    });

    expect(result).toEqual({ status: "published" });
    expect(state.form?.current_published_version_id).toBe(V3_VERSION_ID);
  });

  it("skips cleanly when the seeded form does not exist", async () => {
    const result = await ensureVpFormV3Published({
      client: fakeClient({ form: null, versions: [] }),
    });
    expect(result).toEqual({ status: "skipped", reason: "form not found" });
  });

  it("returns an error status instead of throwing on database failures", async () => {
    const state = v2State();
    state.failSelects = true;

    const result = await ensureVpFormV3Published({
      client: fakeClient(state),
    });
    expect(result.status).toBe("error");
  });

  it("returns an error status instead of throwing when the client itself throws", async () => {
    const result = await ensureVpFormV3Published({
      client: {
        from: () => {
          throw new Error("connection refused");
        },
      } as never,
    });
    expect(result).toEqual({ status: "error", message: "connection refused" });
  });
});
