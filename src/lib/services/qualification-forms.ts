import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildQuestionSnapshots,
  normalizedRolesForForm,
  parseQualificationFormSchema,
  qualificationFormSchema,
  type QualificationFormDefinition,
} from "@/lib/qualification/forms";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json, Tables } from "@/types/database";

export {
  buildQuestionSnapshots,
  qualificationFormSchema,
  type QualificationFormDefinition,
} from "@/lib/qualification/forms";

type QualificationFormRow = Tables<"qualification_forms">;
type QualificationFormVersionRow = Tables<"qualification_form_versions">;
type QualificationFormsClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: QualificationFormsClient;
};

export type PublishQualificationFormInput = {
  formId: string;
  publishedBy?: string | null;
};

export type UpdateQualificationFormDraftInput = {
  formId: string;
  name?: string;
  schema?: unknown;
  updatedBy?: string | null;
};

export type GetQualificationFormVersionInput = {
  versionId: string;
};

export type QualificationPublishedVersion = {
  formId: string;
  versionId: string;
  versionNumber: number;
  schema: QualificationFormDefinition;
  questionCount: number;
  normalizedRoles: string[];
  publishedAt: string;
};

export class QualificationFormServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualificationFormServiceError";
  }
}

const FORM_FIELDS =
  "id, name, status, is_default, draft_schema, current_published_version_id" as const;
const VERSION_FIELDS =
  "id, form_id, version_number, schema_snapshot, question_count, normalized_roles, published_at" as const;

export async function adminUpdateQualificationFormDraft(
  input: UpdateQualificationFormDraftInput,
  deps: ServiceDeps = {},
): Promise<void> {
  const patch: Database["public"]["Tables"]["qualification_forms"]["Update"] =
    {};

  if (input.name != null) {
    const name = input.name.trim();
    if (!name) {
      throw new QualificationFormServiceError("Form name is required.");
    }
    patch.name = name;
  }

  if (input.schema !== undefined) {
    patch.draft_schema = parseQualificationFormSchema(input.schema) as Json;
  }

  if (input.updatedBy !== undefined) {
    patch.updated_by = input.updatedBy;
  }

  if (!Object.keys(patch).length) return;

  const client = serviceClient(deps);
  const { error } = await client
    .from("qualification_forms")
    .update(patch)
    .eq("id", input.formId);

  if (error) {
    throw new QualificationFormServiceError(
      "Could not update qualification form draft.",
    );
  }
}

export async function publishQualificationForm(
  input: PublishQualificationFormInput,
  deps: ServiceDeps = {},
): Promise<QualificationPublishedVersion> {
  const client = serviceClient(deps);
  const form = await getForm(client, input.formId);
  const schema = parseQualificationFormSchema(form.draft_schema);
  const latest = await getLatestVersion(client, input.formId);
  const versionNumber = (latest?.version_number ?? 0) + 1;

  const insert: Database["public"]["Tables"]["qualification_form_versions"]["Insert"] =
    {
      form_id: form.id,
      version_number: versionNumber,
      schema_snapshot: schema as Json,
      question_count: schema.questions.length,
      normalized_roles: normalizedRolesForForm(schema),
      published_by: input.publishedBy ?? null,
    };

  const { data: version, error: insertError } = await client
    .from("qualification_form_versions")
    .insert(insert)
    .select(VERSION_FIELDS)
    .single();

  if (insertError || !version) {
    throw new QualificationFormServiceError(
      "Could not publish qualification form version.",
    );
  }

  const { error: updateError } = await client
    .from("qualification_forms")
    .update({
      status: "published",
      current_published_version_id: version.id,
    })
    .eq("id", form.id);

  if (updateError) {
    throw new QualificationFormServiceError(
      "Published version was created but form status was not updated.",
    );
  }

  return mapVersion(version as QualificationFormVersionRow);
}

export async function resolveDefaultQualificationFormVersion(
  deps: ServiceDeps = {},
): Promise<QualificationPublishedVersion | null> {
  const client = serviceClient(deps);
  const { data: form, error } = await client
    .from("qualification_forms")
    .select(FORM_FIELDS)
    .eq("is_default", true)
    .eq("status", "published")
    .maybeSingle();

  if (error) {
    throw new QualificationFormServiceError(
      "Could not resolve default qualification form.",
    );
  }
  if (!form?.current_published_version_id) return null;

  return getQualificationFormVersion(
    { versionId: form.current_published_version_id },
    { client },
  );
}

export async function getQualificationFormVersion(
  input: GetQualificationFormVersionInput,
  deps: ServiceDeps = {},
): Promise<QualificationPublishedVersion> {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("qualification_form_versions")
    .select(VERSION_FIELDS)
    .eq("id", input.versionId)
    .single();

  if (error || !data) {
    throw new QualificationFormServiceError(
      "Qualification form version was not found.",
    );
  }

  return mapVersion(data as QualificationFormVersionRow);
}

function serviceClient(deps: ServiceDeps): QualificationFormsClient {
  return deps.client ?? createAdminClient();
}

async function getForm(
  client: QualificationFormsClient,
  formId: string,
): Promise<QualificationFormRow> {
  const { data, error } = await client
    .from("qualification_forms")
    .select(FORM_FIELDS)
    .eq("id", formId)
    .single();

  if (error || !data) {
    throw new QualificationFormServiceError(
      "Qualification form was not found.",
    );
  }

  return data as QualificationFormRow;
}

async function getLatestVersion(
  client: QualificationFormsClient,
  formId: string,
): Promise<Pick<QualificationFormVersionRow, "version_number"> | null> {
  const { data, error } = await client
    .from("qualification_form_versions")
    .select("version_number")
    .eq("form_id", formId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new QualificationFormServiceError(
      "Could not inspect qualification form versions.",
    );
  }

  return data as Pick<QualificationFormVersionRow, "version_number"> | null;
}

function mapVersion(
  row: QualificationFormVersionRow,
): QualificationPublishedVersion {
  const schema = parseQualificationFormSchema(row.schema_snapshot);
  return {
    formId: row.form_id,
    versionId: row.id,
    versionNumber: row.version_number,
    schema,
    questionCount: row.question_count,
    normalizedRoles: row.normalized_roles,
    publishedAt: row.published_at,
  };
}
