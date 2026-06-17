import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  normalizedRolesForForm,
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

export type CreateQualificationFormInput = {
  name: string;
  createdBy?: string | null;
  schema?: unknown;
};

export type GetQualificationFormInput = {
  formId: string;
};

export type SetDefaultQualificationFormInput = {
  formId: string;
  updatedBy?: string | null;
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

export type ResolvePublishedQualificationFormVersionInput = {
  formId: string;
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

export type AdminQualificationForm = {
  id: string;
  name: string;
  slug: string | null;
  status: string;
  isDefault: boolean;
  draftSchema: QualificationFormDefinition;
  currentPublishedVersionId: string | null;
  draftQuestionCount: number;
  createdAt: string;
  updatedAt: string;
};

export class QualificationFormServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QualificationFormServiceError";
  }
}

const FORM_FIELDS =
  "id, name, slug, status, is_default, draft_schema, current_published_version_id, created_at, updated_at" as const;
const VERSION_FIELDS =
  "id, form_id, version_number, schema_snapshot, question_count, normalized_roles, published_at" as const;

const DEFAULT_DRAFT_SCHEMA: QualificationFormDefinition = {
  version: 1,
  questions: [
    {
      id: "first_question",
      type: "short_text",
      label: "What should we qualify first?",
      helpText: "",
      placeholder: "",
      required: true,
    },
  ],
};

export async function adminListQualificationForms(
  deps: ServiceDeps = {},
): Promise<AdminQualificationForm[]> {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("qualification_forms")
    .select(FORM_FIELDS)
    .order("created_at", { ascending: false });

  if (error) {
    throw new QualificationFormServiceError(
      "Could not list qualification forms.",
    );
  }

  return ((data ?? []) as QualificationFormRow[]).map(mapForm);
}

export async function adminGetQualificationForm(
  input: GetQualificationFormInput,
  deps: ServiceDeps = {},
): Promise<AdminQualificationForm | null> {
  const client = serviceClient(deps);
  const { data, error } = await client
    .from("qualification_forms")
    .select(FORM_FIELDS)
    .eq("id", input.formId)
    .maybeSingle();

  if (error) {
    throw new QualificationFormServiceError(
      "Could not load qualification form.",
    );
  }

  return data ? mapForm(data as QualificationFormRow) : null;
}

export async function adminCreateQualificationForm(
  input: CreateQualificationFormInput,
  deps: ServiceDeps = {},
): Promise<AdminQualificationForm> {
  const name = parseFormName(input.name);
  const schema = parseEditableSchema(input.schema ?? DEFAULT_DRAFT_SCHEMA);
  const insert: Database["public"]["Tables"]["qualification_forms"]["Insert"] =
    {
      name,
      status: "draft",
      is_default: false,
      draft_schema: schema as Json,
      created_by: input.createdBy ?? null,
      updated_by: input.createdBy ?? null,
    };

  const client = serviceClient(deps);
  const { data, error } = await client
    .from("qualification_forms")
    .insert(insert)
    .select(FORM_FIELDS)
    .single();

  if (error || !data) {
    throw new QualificationFormServiceError(
      "Could not create qualification form.",
    );
  }

  return mapForm(data as QualificationFormRow);
}

export async function adminUpdateQualificationFormDraft(
  input: UpdateQualificationFormDraftInput,
  deps: ServiceDeps = {},
): Promise<void> {
  const patch: Database["public"]["Tables"]["qualification_forms"]["Update"] =
    {};

  if (input.name != null) {
    patch.name = parseFormName(input.name);
  }

  if (input.schema !== undefined) {
    patch.draft_schema = parseEditableSchema(input.schema) as Json;
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

export async function adminSetDefaultQualificationForm(
  input: SetDefaultQualificationFormInput,
  deps: ServiceDeps = {},
): Promise<void> {
  const client = serviceClient(deps);
  const form = await getForm(client, input.formId);

  if (form.status !== "published" || !form.current_published_version_id) {
    throw new QualificationFormServiceError(
      "Publish this form before setting it as the default.",
    );
  }

  const { error: unsetError } = await client
    .from("qualification_forms")
    .update({ is_default: false })
    .neq("id", form.id);

  if (unsetError) {
    throw new QualificationFormServiceError(
      "Could not clear the previous default qualification form.",
    );
  }

  const { error: setError } = await client
    .from("qualification_forms")
    .update({
      is_default: true,
      updated_by: input.updatedBy ?? null,
    })
    .eq("id", form.id);

  if (setError) {
    throw new QualificationFormServiceError(
      "Could not set default qualification form.",
    );
  }
}

export async function publishQualificationForm(
  input: PublishQualificationFormInput,
  deps: ServiceDeps = {},
): Promise<QualificationPublishedVersion> {
  const client = serviceClient(deps);
  const form = await getForm(client, input.formId);
  const schema = parseEditableSchema(form.draft_schema);
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

export async function resolvePublishedQualificationFormVersion(
  input: ResolvePublishedQualificationFormVersionInput,
  deps: ServiceDeps = {},
): Promise<QualificationPublishedVersion | null> {
  const client = serviceClient(deps);
  const form = await getForm(client, input.formId);

  if (form.status !== "published" || !form.current_published_version_id) {
    return null;
  }

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

function parseFormName(value: string): string {
  const name = value.trim();
  if (!name) {
    throw new QualificationFormServiceError("Form name is required.");
  }
  if (name.length > 120) {
    throw new QualificationFormServiceError(
      "Form name must be 120 characters or fewer.",
    );
  }
  return name;
}

function parseEditableSchema(input: unknown): QualificationFormDefinition {
  const parsed = qualificationFormSchema.safeParse(input);
  if (!parsed.success) {
    throw new QualificationFormServiceError(
      parsed.error.issues[0]?.message ?? "Invalid qualification form.",
    );
  }
  return parsed.data;
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
  const schema = parseEditableSchema(row.schema_snapshot);
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

function mapForm(row: QualificationFormRow): AdminQualificationForm {
  const draftSchema = parseEditableSchema(row.draft_schema);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    isDefault: row.is_default,
    draftSchema,
    currentPublishedVersionId: row.current_published_version_id,
    draftQuestionCount: draftSchema.questions.length,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
