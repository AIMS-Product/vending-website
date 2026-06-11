import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  DEFAULT_ROUTE_PREFIXES,
  RESERVED_ROUTE_SEGMENTS,
  ROUTE_PREFIX_PATTERN,
} from "@/lib/page-builder/route-prefix-defaults";
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

// Shared, client-safe constants live in route-prefix-defaults so the
// page-paths helpers (used by client components) can rely on the same
// defaults, reservations, and shape pattern. Re-exported to preserve this
// service's public API.
export { DEFAULT_ROUTE_PREFIXES, RESERVED_ROUTE_SEGMENTS };

const ROUTE_PREFIX_FIELDS =
  "id, prefix, label, is_default, created_at" as const;

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
