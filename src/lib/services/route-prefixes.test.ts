import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEFAULT_ROUTE_PREFIXES,
  adminCreateRoutePrefix,
  adminDeleteRoutePrefix,
  listRoutePrefixes,
} from "./route-prefixes";
import type { Database } from "@/types/database";

type RoutePrefixClient = Pick<SupabaseClient<Database>, "from">;

function listSelect(data: unknown, error: unknown = null) {
  const order = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ order });
  return { table: { select }, mocks: { select, order } };
}

function insertSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { table: { insert }, mocks: { insert, select, single } };
}

function lookupByPrefix(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq, maybeSingle } };
}

function deleteById(error: unknown = null) {
  const eq = vi.fn().mockResolvedValue({ error });
  const del = vi.fn().mockReturnValue({ eq });
  return { table: { delete: del }, mocks: { delete: del, eq } };
}

function buildClient(...tables: unknown[]) {
  return {
    from: vi.fn().mockImplementation(() => {
      const next = tables.shift();
      if (!next) throw new Error("Unexpected Supabase table call");
      return next;
    }),
  } as unknown as RoutePrefixClient & { from: ReturnType<typeof vi.fn> };
}

const storedRow = {
  id: "prefix_1",
  prefix: "/guides",
  label: "Guides",
  is_default: false,
  created_at: "2026-06-11T00:00:00.000Z",
};

describe("route prefix service", () => {
  it("lists route prefixes in created order", async () => {
    const list = listSelect([storedRow]);
    const client = buildClient(list.table);

    await expect(listRoutePrefixes({ client })).resolves.toEqual([
      {
        id: "prefix_1",
        prefix: "/guides",
        label: "Guides",
        isDefault: false,
        createdAt: "2026-06-11T00:00:00.000Z",
      },
    ]);

    expect(client.from).toHaveBeenCalledWith("page_builder_route_prefixes");
    expect(list.mocks.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
  });

  it("falls back to the built-in defaults when the table is missing or errors", async () => {
    const list = listSelect(null, {
      message:
        'relation "public.page_builder_route_prefixes" does not exist in the schema cache',
    });
    const client = buildClient(list.table);

    await expect(listRoutePrefixes({ client })).resolves.toEqual(
      DEFAULT_ROUTE_PREFIXES.map((entry) => ({
        id: null,
        prefix: entry.prefix,
        label: entry.label,
        isDefault: true,
        createdAt: null,
      })),
    );
  });

  it("keeps the five built-in prefixes as the hardcoded fallback", () => {
    expect(DEFAULT_ROUTE_PREFIXES.map((entry) => entry.prefix)).toEqual([
      "/resources",
      "/blog",
      "/landing",
      "/videos",
      "/solutions",
    ]);
  });

  it("creates a custom prefix after normalizing the input", async () => {
    const insert = insertSingle(storedRow);
    const client = buildClient(insert.table);

    await expect(
      adminCreateRoutePrefix(
        { prefix: " Guides ", label: "Guides" },
        { client },
      ),
    ).resolves.toEqual({
      id: "prefix_1",
      prefix: "/guides",
      label: "Guides",
      isDefault: false,
      createdAt: "2026-06-11T00:00:00.000Z",
    });

    expect(insert.mocks.insert).toHaveBeenCalledWith({
      prefix: "/guides",
      label: "Guides",
      is_default: false,
    });
  });

  it("rejects reserved prefixes before reaching the database", async () => {
    const client = buildClient();

    for (const reserved of ["/admin", "/api", "/news", "/authors", "/apply"]) {
      await expect(
        adminCreateRoutePrefix({ prefix: reserved, label: "" }, { client }),
      ).rejects.toThrow("reserved");
    }
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects prefixes that do not match the single-segment shape", async () => {
    const client = buildClient();

    for (const invalid of [
      "",
      "/",
      "/two/segments",
      "/bad path",
      "/-leading-dash",
      "/trailing-dash-",
      "/under_score",
    ]) {
      await expect(
        adminCreateRoutePrefix({ prefix: invalid, label: "" }, { client }),
      ).rejects.toThrow("single lowercase segment");
    }
    expect(client.from).not.toHaveBeenCalled();
  });

  it("rejects prefixes longer than 40 characters", async () => {
    const client = buildClient();

    await expect(
      adminCreateRoutePrefix(
        { prefix: `/${"a".repeat(41)}`, label: "" },
        { client },
      ),
    ).rejects.toThrow("40 characters");
    expect(client.from).not.toHaveBeenCalled();
  });

  it("reports duplicate prefixes with a friendly message", async () => {
    const insert = insertSingle(null, {
      code: "23505",
      message:
        'duplicate key value violates unique constraint "page_builder_route_prefixes_prefix_key"',
    });
    const client = buildClient(insert.table);

    await expect(
      adminCreateRoutePrefix({ prefix: "/guides", label: "" }, { client }),
    ).rejects.toThrow("already exists");
  });

  it("deletes a custom prefix by id", async () => {
    const lookup = lookupByPrefix({
      id: "prefix_1",
      is_default: false,
    });
    const remove = deleteById();
    const client = buildClient(lookup.table, remove.table);

    await expect(
      adminDeleteRoutePrefix({ prefix: "/guides" }, { client }),
    ).resolves.toBeUndefined();

    expect(lookup.mocks.eq).toHaveBeenCalledWith("prefix", "/guides");
    expect(remove.mocks.eq).toHaveBeenCalledWith("id", "prefix_1");
  });

  it("refuses to delete default prefixes", async () => {
    const lookup = lookupByPrefix({
      id: "prefix_default",
      is_default: true,
    });
    const client = buildClient(lookup.table);

    await expect(
      adminDeleteRoutePrefix({ prefix: "/blog" }, { client }),
    ).rejects.toThrow("Default route prefixes cannot be deleted.");
  });

  it("reports missing prefixes on delete", async () => {
    const lookup = lookupByPrefix(null);
    const client = buildClient(lookup.table);

    await expect(
      adminDeleteRoutePrefix({ prefix: "/missing" }, { client }),
    ).rejects.toThrow("Route prefix not found.");
  });
});
