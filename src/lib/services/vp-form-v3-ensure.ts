import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  VP_BOTTLENECK_FIELD_OPTIONS,
  VP_BOTTLENECK_LABEL,
  VP_CONFIDENCE_FIELD_OPTIONS,
  VP_CONFIDENCE_LABEL,
  VP_CONSENT_CONTACT_LABEL,
  VP_CONSENT_UPDATES_LABEL,
  VP_INVEST_FIELD_OPTIONS,
  VP_INVEST_LABEL,
  VP_OPERATOR_FIELD_OPTIONS,
  VP_OPERATOR_LABEL,
  VP_PERSONA_FIELD_OPTIONS,
  VP_PERSONA_LABEL,
  VP_QUALIFICATION_FORM_ID,
  VP_QUESTION_IDS,
  VP_TIMELINE_FIELD_OPTIONS,
  VP_TIMELINE_LABEL,
  type VpFieldOption,
} from "@/lib/qualification/vp-fields";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/types/database";

type EnsureClient = Pick<SupabaseClient<Database>, "from">;

type EnsureDeps = {
  client?: EnsureClient;
  now?: () => Date;
};

export type EnsureVpFormV3Result =
  | { status: "published" }
  | { status: "already" }
  | { status: "skipped"; reason: string }
  | { status: "error"; message: string };

// Fixed ids matching supabase/migrations/20260814210000_vp_form_v3_operator_paths.sql.
const V2_VERSION_ID = "a1b2c3d4-0000-4000-8000-000000000003";
const V3_VERSION_ID = "a1b2c3d4-0000-4000-8000-000000000004";
const V3_VERSION_NUMBER = 3;

const V3_NORMALIZED_ROLES = [
  "consent",
  "contact_preference",
  "operator_status",
  "persona",
  "confidence",
  "bottleneck",
  "timeline",
  "available_capital",
];

function options(catalog: readonly VpFieldOption[]) {
  return catalog.map((option) => ({
    id: option.value,
    label: option.label,
    value: option.value,
  }));
}

/**
 * The Form V2 (published version 3) schema, built from the vp-fields catalogs
 * so it cannot drift from the copy the UI renders. Identical to the JSON in
 * the 20260814210000 migration; the mirror test in
 * src/lib/qualification/vp-seed-form.test.ts covers both.
 */
export function vpFormV3Schema(): Json {
  return {
    version: 1,
    questions: [
      {
        id: VP_QUESTION_IDS.consentUpdates,
        type: "consent",
        label: VP_CONSENT_UPDATES_LABEL,
        required: true,
        normalizedRole: "consent",
      },
      {
        id: VP_QUESTION_IDS.consentContact,
        type: "consent",
        label: VP_CONSENT_CONTACT_LABEL,
        required: true,
        normalizedRole: "contact_preference",
      },
      {
        id: VP_QUESTION_IDS.operator,
        type: "single_choice",
        label: VP_OPERATOR_LABEL,
        required: false,
        normalizedRole: "operator_status",
        options: options(VP_OPERATOR_FIELD_OPTIONS),
      },
      {
        id: VP_QUESTION_IDS.persona,
        type: "single_choice",
        label: VP_PERSONA_LABEL,
        required: false,
        normalizedRole: "persona",
        options: options(VP_PERSONA_FIELD_OPTIONS),
      },
      {
        id: VP_QUESTION_IDS.confidence,
        type: "single_choice",
        label: VP_CONFIDENCE_LABEL,
        required: false,
        normalizedRole: "confidence",
        options: options(VP_CONFIDENCE_FIELD_OPTIONS),
      },
      {
        id: VP_QUESTION_IDS.bottleneck,
        type: "single_choice",
        label: VP_BOTTLENECK_LABEL,
        required: false,
        normalizedRole: "bottleneck",
        options: options(VP_BOTTLENECK_FIELD_OPTIONS),
      },
      {
        id: VP_QUESTION_IDS.timeline,
        type: "single_choice",
        label: VP_TIMELINE_LABEL,
        required: false,
        normalizedRole: "timeline",
        options: options(VP_TIMELINE_FIELD_OPTIONS),
      },
      {
        id: VP_QUESTION_IDS.invest,
        type: "single_choice",
        label: VP_INVEST_LABEL,
        required: true,
        normalizedRole: "available_capital",
        options: options(VP_INVEST_FIELD_OPTIONS),
      },
    ],
  } as unknown as Json;
}

// Once this process has confirmed the publication it never re-checks: the
// cron fires every two minutes and the answer cannot change back.
let ensuredInProcess = false;

/**
 * Applies the Form V2 publication (version 3 of the seeded VP Lead Capture
 * form) if the database has not received it yet — the same change as the
 * 20260814210000 SQL migration, expressed as plain DML through the service
 * client. Exists because this deployment path cannot reach Supabase to run
 * `supabase db push`; the deployed app, which does hold the service role,
 * applies its own data migration on the next cron tick.
 *
 * Idempotent and race-safe: a concurrent run loses the version-row insert to
 * the primary key and treats that as success. Running the SQL migration later
 * is also safe — its statements are no-ops against this applied state. Never
 * throws; callers ride on a cron whose real job must not fail because of this.
 */
export async function ensureVpFormV3Published(
  deps: EnsureDeps = {},
): Promise<EnsureVpFormV3Result> {
  if (ensuredInProcess) return { status: "already" };
  try {
    const client = deps.client ?? createAdminClient();
    const nowIso = (deps.now?.() ?? new Date()).toISOString();

    const { data: form, error: formError } = await client
      .from("qualification_forms")
      .select("id,current_published_version_id")
      .eq("id", VP_QUALIFICATION_FORM_ID)
      .maybeSingle();
    if (formError) {
      return { status: "error", message: "Could not load the VP form." };
    }
    // No seeded form (e.g. an empty preview database): nothing to migrate.
    if (!form) return { status: "skipped", reason: "form not found" };

    const { data: v3Row, error: v3Error } = await client
      .from("qualification_form_versions")
      .select("id")
      .eq("id", V3_VERSION_ID)
      .maybeSingle();
    if (v3Error) {
      return { status: "error", message: "Could not check version 3." };
    }
    if (v3Row && form.current_published_version_id === V3_VERSION_ID) {
      ensuredInProcess = true;
      return { status: "already" };
    }

    const schema = vpFormV3Schema();

    const { error: draftError } = await client
      .from("qualification_forms")
      .update({ draft_schema: schema, updated_at: nowIso })
      .eq("id", VP_QUALIFICATION_FORM_ID);
    if (draftError) {
      return { status: "error", message: "Could not write the V3 draft." };
    }

    if (!v3Row) {
      // published_by carries over from the previous publication, matching the
      // SQL migration. Missing v2 row (never expected) publishes as system.
      const { data: v2Row } = await client
        .from("qualification_form_versions")
        .select("published_by")
        .eq("id", V2_VERSION_ID)
        .maybeSingle();

      const { error: insertError } = await client
        .from("qualification_form_versions")
        .insert({
          id: V3_VERSION_ID,
          form_id: VP_QUALIFICATION_FORM_ID,
          version_number: V3_VERSION_NUMBER,
          schema_snapshot: schema,
          question_count: 8,
          normalized_roles: V3_NORMALIZED_ROLES,
          published_by: v2Row?.published_by ?? null,
          published_at: nowIso,
        });
      // 23505 = a concurrent run already inserted the row; that is success.
      if (insertError && (insertError as { code?: string }).code !== "23505") {
        return { status: "error", message: "Could not insert version 3." };
      }
    }

    const { error: pointerError } = await client
      .from("qualification_forms")
      .update({
        current_published_version_id: V3_VERSION_ID,
        updated_at: nowIso,
      })
      .eq("id", VP_QUALIFICATION_FORM_ID);
    if (pointerError) {
      return { status: "error", message: "Could not publish version 3." };
    }

    ensuredInProcess = true;
    console.info("vp form v3 published by ensure step");
    return { status: "published" };
  } catch (error) {
    return {
      status: "error",
      message: error instanceof Error ? error.message : "unknown error",
    };
  }
}

/** Test seam: clears the process memo so each test starts unensured. */
export function resetVpFormV3EnsureMemoForTests() {
  ensuredInProcess = false;
}
