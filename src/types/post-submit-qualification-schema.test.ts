import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";

import type { Database } from "@/types/database";

type PublicTables = Database["public"]["Tables"];
type LeadSubmissionUpdate = PublicTables["lead_submissions"]["Update"];
type QualificationFormInsert = PublicTables["qualification_forms"]["Insert"];
type QualificationFormVersionInsert =
  PublicTables["qualification_form_versions"]["Insert"];
type QualificationSessionInsert =
  PublicTables["qualification_sessions"]["Insert"];
type QualificationAnswerInsert =
  PublicTables["qualification_answers"]["Insert"];
type CloseSyncEventInsert = PublicTables["close_sync_events"]["Insert"];

const repoRoot = process.cwd();

function readPostSubmitQualificationMigration() {
  const migrationsDir = path.join(repoRoot, "supabase", "migrations");
  const migrationFile = readdirSync(migrationsDir)
    .filter((filename) => filename.endsWith("_post_submit_qualification.sql"))
    .sort()
    .at(-1);

  expect(migrationFile).toBeDefined();

  const fullPath = path.join(migrationsDir, migrationFile ?? "");
  expect(existsSync(fullPath)).toBe(true);

  return readFileSync(fullPath, "utf8");
}

describe("post-submit qualification schema contract", () => {
  it("keeps generated database types in sync with the S1 tables and lead fields", () => {
    const leadUpdate: LeadSubmissionUpdate = {
      lifecycle_status: "qualification_pending",
      qualification_summary: {
        status: "qualification_pending",
        state_market: "SA",
      },
      latest_qualification_session_id: "00000000-0000-0000-0000-000000000001",
      latest_qualification_started_at: "2026-06-17T00:00:00.000Z",
      latest_qualification_completed_at: "2026-06-17T00:10:00.000Z",
      close_lead_id: "lead_123",
      close_contact_id: "cont_123",
      close_sync_status: "pending",
      close_sync_attempt_count: 0,
      close_sync_next_retry_at: "2026-06-17T00:15:00.000Z",
      close_sync_last_error: null,
    };

    const form: QualificationFormInsert = {
      name: "Default qualification",
      draft_schema: { questions: [] },
      status: "draft",
    };

    const version: QualificationFormVersionInsert = {
      form_id: "00000000-0000-0000-0000-000000000002",
      version_number: 1,
      schema_snapshot: { questions: [] },
      question_count: 0,
    };

    const session: QualificationSessionInsert = {
      lead_submission_id: "00000000-0000-0000-0000-000000000003",
      form_id: "00000000-0000-0000-0000-000000000002",
      form_version_id: "00000000-0000-0000-0000-000000000004",
      session_token_hash: "sha256:token-hash",
      expires_at: "2026-07-17T00:00:00.000Z",
      stale_at: "2026-06-24T00:00:00.000Z",
    };

    const answer: QualificationAnswerInsert = {
      session_id: "00000000-0000-0000-0000-000000000005",
      lead_submission_id: "00000000-0000-0000-0000-000000000003",
      form_version_id: "00000000-0000-0000-0000-000000000004",
      question_id: "budget",
      question_type: "budget_range",
      question_snapshot: { id: "budget", label: "Budget" },
      answer_value: { selected: "$10k-$25k" },
    };

    const syncEvent: CloseSyncEventInsert = {
      event_type: "lead_create_or_update",
      status: "pending",
      lead_submission_id: "00000000-0000-0000-0000-000000000003",
      payload: { email: "lead@example.com" },
    };

    expect([
      leadUpdate,
      form,
      version,
      session,
      answer,
      syncEvent,
    ]).toHaveLength(6);
  });

  it("ships an additive migration with hashed public tokens, admin-only RLS, and useful indexes", () => {
    const sql = readPostSubmitQualificationMigration();

    expect(sql).toContain("create table public.qualification_forms");
    expect(sql).toContain("create table public.qualification_form_versions");
    expect(sql).toContain("create table public.qualification_sessions");
    expect(sql).toContain("create table public.qualification_answers");
    expect(sql).toContain("create table public.close_sync_events");

    expect(sql).toContain("alter table public.lead_submissions");
    expect(sql).toContain("add column if not exists lifecycle_status");
    expect(sql).toContain("add column if not exists qualification_summary");
    expect(sql).toContain("add column if not exists close_lead_id");
    expect(sql).toContain("add column if not exists close_contact_id");

    expect(sql).toContain("session_token_hash");
    expect(sql).not.toMatch(/\bsession_token\s+text\b/i);
    expect(sql).not.toMatch(/\bemail_token\b/i);

    for (const tableName of [
      "qualification_forms",
      "qualification_form_versions",
      "qualification_sessions",
      "qualification_answers",
      "close_sync_events",
    ]) {
      expect(sql).toContain(
        `alter table public.${tableName} enable row level security`,
      );
    }

    expect(sql).not.toMatch(/to\s+anon/i);
    expect(sql).toMatch(
      /create policy qualification_answers_admin_all[\s\S]+public\.is_app_admin\(\)/,
    );
    expect(sql).toMatch(
      /create policy close_sync_events_admin_all[\s\S]+public\.is_app_admin\(\)/,
    );

    for (const indexName of [
      "qualification_sessions_token_hash_idx",
      "qualification_sessions_lead_idx",
      "qualification_sessions_status_idx",
      "qualification_sessions_source_variant_idx",
      "qualification_answers_session_idx",
      "close_sync_events_status_next_retry_idx",
      "close_sync_events_lead_idx",
      "close_sync_events_close_ids_idx",
      "lead_submissions_close_contact_id_idx",
      "lead_submissions_close_lead_id_idx",
      "lead_submissions_lifecycle_status_idx",
    ]) {
      expect(sql).toContain(indexName);
    }
  });
});
