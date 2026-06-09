#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const envPath = path.join(repoRoot, ".env.local");

async function loadEnvFile(filePath) {
  try {
    const contents = await fs.readFile(filePath, "utf8");
    for (const line of contents.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const separator = trimmed.indexOf("=");
      if (separator === -1) continue;
      const key = trimmed.slice(0, separator).trim();
      let value = trimmed.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) {
        process.env[key] = value;
      }
    }
  } catch {
    // Optional local env file.
  }
}

const PURGE_CONFIRMATION_PHRASE = "PURGE ALL SEO PAGES PERMANENTLY";
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "kong"]);

function projectRefForUrl(url) {
  const host = new URL(url).hostname;
  if (LOCAL_HOSTS.has(host)) return "local";
  return host.split(".")[0];
}

function assertPurgeAllowed(url) {
  const projectRef = projectRefForUrl(url);
  const confirmIndex = process.argv.indexOf("--confirm");
  const confirmValue =
    confirmIndex === -1 ? null : (process.argv[confirmIndex + 1] ?? null);

  console.log(`Target Supabase project: ${url} (ref: ${projectRef})`);

  if (confirmValue !== projectRef) {
    throw new Error(
      `Refusing to purge. This deletes ALL SEO pages, redirects, and the revision history. ` +
        `Re-run with: node scripts/purge-seo-pages.mjs --confirm ${projectRef}`,
    );
  }

  if (projectRef !== "local" && process.env.ALLOW_REMOTE_PURGE !== "1") {
    throw new Error(
      `Refusing to purge remote project "${projectRef}". ` +
        `Set ALLOW_REMOTE_PURGE=1 in the environment if you really mean to purge a live database.`,
    );
  }
}

function createAdminSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.",
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function main() {
  await loadEnvFile(envPath);
  assertPurgeAllowed(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const supabase = createAdminSupabaseClient();

  const { count: beforeCount, error: countError } = await supabase
    .from("seo_pages")
    .select("id", { count: "exact", head: true });
  if (countError) {
    throw new Error(`Could not count seo_pages: ${countError.message}`);
  }

  console.log(`Found ${beforeCount ?? 0} SEO page(s) before purge.`);

  if (!beforeCount) {
    console.log("Nothing to delete.");
    return;
  }

  const { data, error } = await supabase.rpc("purge_all_seo_pages_for_testing", {
    p_confirm: PURGE_CONFIRMATION_PHRASE,
  });
  if (error) {
    throw new Error(
      `Purge failed: ${error.message}. Apply migration 20260610090000_guard_purge_seo_pages_fn.sql first.`,
    );
  }

  const { count: afterCount, error: afterError } = await supabase
    .from("seo_pages")
    .select("id", { count: "exact", head: true });
  if (afterError) {
    throw new Error(`Could not verify purge: ${afterError.message}`);
  }

  console.log("Purge complete:");
  console.log(JSON.stringify(data, null, 2));
  console.log(`Remaining SEO pages: ${afterCount ?? 0}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
