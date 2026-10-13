import { describe, expect, it } from "vitest";
import { getLinkCoverage } from "./link-coverage-data";

describe("getLinkCoverage", () => {
  it("counts only builder-made links, never imported ones, as registered", async () => {
    const notCalls: Array<[string, unknown[]]> = [];
    const client = {
      from: (table: string) => {
        const builder: Record<string, unknown> = {};
        for (const method of ["select", "gte", "lte", "order"]) {
          builder[method] = () => builder;
        }
        builder.not = (...args: unknown[]) => {
          notCalls.push([table, args]);
          return builder;
        };
        builder.range = async () => ({ data: [], error: null });
        return builder;
      },
    };
    await getLinkCoverage({
      range: "30d",
      client: client as never,
      now: new Date("2026-10-13T12:00:00Z"),
    });
    expect(notCalls).toContainEqual([
      "marketing_links",
      ["created_by", "like", "backfill:%"],
    ]);
  });
});
