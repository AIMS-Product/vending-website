import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Tables, TablesInsert } from "@/types/database";

type RoutePrefixRow = Tables<"page_builder_route_prefixes">;

type RoutePrefixClient = Pick<SupabaseClient<Database>, "from">;

type ServiceDeps = {
  client?: RoutePrefixClient;
};

export type RoutePrefix = {
  id: string | null;
  prefix: string;
  label: string;
  isDefault: boolean;
  createdAt: string | null;
};

export type CreateRoutePrefixInput = {
  prefix: string;
  label?: string;
};

export class RoutePrefixServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoutePrefixServiceError";
  }
}

/**
 * The five built-in builder prefixes. `listRoutePrefixes` falls back to this
 * list whenever the `page_builder_route_prefixes` table is missing or the
 * query errors, so app behavior never depends on the migration having run.
 */
export const DEFAULT_ROUTE_PREFIXES = [
  { prefix: "/resources", label: "Resources" },
  { prefix: "/blog", label: "Blog" },
  { prefix: "/landing", label: "Landing" },
  { prefix: "/videos", label: "Videos" },
  { prefix: "/solutions", label: "Solutions" },
] as const;

/**
 * Segments that can never become builder route prefixes: every existing
 * top-level route folder in `src/app` plus framework/infrastructure paths.
 * The five default builder prefixes are included — they exist as seeded,
 * non-deletable rows and must not be re-created as custom prefixes.
 */
export const RESERVED_ROUTE_SEGMENTS = new Set([
  // Existing top-level src/app route folders.
  "about",
  "admin",
  "api",
  "apply",
  "auth",
  "authors",
  "blog",
  "case-studies",
  "contact",
  "home-v2",
  "landing",
  "news",
  "pre-call-resources",
  "privacy",
  "resources",
  "solutions",
  "terms",
  "thank-you-for-applying",
  "videos",
  // Framework and infrastructure paths.
  "_next",
  "images",
  "robots",
  "sitemap",
]);

const ROUTE_PREFIX_FIELDS =
  "id, prefix, label, is_default, created_at" as const;

const ROUTE_PREFIX_PATTERN = /^\/[a-z0-9]+(-[a-z0-9]+)*$/;

const createRoutePrefixSchema = z.object({
  prefix: z.preprocess(
    (value) => normalizePrefix(value),
    z
      .string()
      .max(40, "Route prefix must be 40 characters or fewer.")
      .regex(
        ROUTE_PREFIX_PATTERN,
        "Route prefix must be a single lowercase segment like /guides.",
      )
      .refine(
        (prefix) => !RESERVED_ROUTE_SEGMENTS.has(prefix.slice(1)),
        "That route prefix is reserved and cannot be used.",
      ),
  ),
  label: z.preprocess(
    (value) => String(value ?? "").trim(),
    z.string().max(80, "Label must be 80 characters or fewer."),
  ),
});

export async function listRoutePrefixes(
  deps: ServiceDeps = {},
): Promise<RoutePrefix[]> {
  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("page_builder_route_prefixes")
    .select(ROUTE_PREFIX_FIELDS)
    .order("created_at", { ascending: true });

  if (error) {
    // Missing table (migration not applied) or any query failure: the
    // builder must keep working on the built-in defaults.
    return fallbackRoutePrefixes();
  }

  return ((data ?? []) as RoutePrefixRow[]).map(mapRow);
}

export async function adminCreateRoutePrefix(
  input: CreateRoutePrefixInput,
  deps: ServiceDeps = {},
): Promise<RoutePrefix> {
  const parsed = createRoutePrefixSchema.safeParse(input);
  if (!parsed.success) {
    throw new RoutePrefixServiceError(
      parsed.error.issues[0]?.message ?? "Invalid route prefix.",
    );
  }

  const row: TablesInsert<"page_builder_route_prefixes"> = {
    prefix: parsed.data.prefix,
    label: parsed.data.label,
    is_default: false,
  };

  const client = deps.client ?? createAdminClient();
  const { data, error } = await client
    .from("page_builder_route_prefixes")
    .insert(row)
    .select(ROUTE_PREFIX_FIELDS)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new RoutePrefixServiceError("That route prefix already exists.");
    }
    throw new RoutePrefixServiceError("Could not create route prefix.");
  }

  return mapRow(data as RoutePrefixRow);
}

export async function adminDeleteRoutePrefix(
  input: { prefix: string },
  deps: ServiceDeps = {},
): Promise<void> {
  const prefix = normalizePrefix(input.prefix);
  const client = deps.client ?? createAdminClient();

  const { data, error } = await client
    .from("page_builder_route_prefixes")
    .select("id, is_default")
    .eq("prefix", prefix)
    .maybeSingle();

  if (error) {
    throw new RoutePrefixServiceError("Could not delete route prefix.");
  }
  if (!data) {
    throw new RoutePrefixServiceError("Route prefix not found.");
  }
  if (data.is_default) {
    throw new RoutePrefixServiceError(
      "Default route prefixes cannot be deleted.",
    );
  }

  const { error: deleteError } = await client
    .from("page_builder_route_prefixes")
    .delete()
    .eq("id", data.id);

  if (deleteError) {
    throw new RoutePrefixServiceError("Could not delete route prefix.");
  }
}

function fallbackRoutePrefixes(): RoutePrefix[] {
  return DEFAULT_ROUTE_PREFIXES.map((entry) => ({
    id: null,
    prefix: entry.prefix,
    label: entry.label,
    isDefault: true,
    createdAt: null,
  }));
}

function mapRow(row: RoutePrefixRow): RoutePrefix {
  return {
    id: row.id,
    prefix: row.prefix,
    label: row.label,
    isDefault: row.is_default,
    createdAt: row.created_at,
  };
}

function normalizePrefix(value: unknown): string {
  const text = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!text) return text;
  return text.startsWith("/") ? text : `/${text}`;
}
