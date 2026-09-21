import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getDataTrust, trustTone, trustVerdict } from "./data-trust";

type Reply = { data: unknown; error: { message: string } | null };

/** A client whose two reads (newest run_at, then that run's rows) are scripted. */
function client(replies: Reply[]) {
  let call = 0;
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "order", "limit"]) {
    builder[method] = () => builder;
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(replies[Math.min(call++, replies.length - 1)]).then(
      resolve,
    );
  return { from: () => builder } as never;
}

async function glossaryFile(body: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "glossary-"));
  const file = path.join(dir, "REPORTING.md");
  await writeFile(file, body, "utf8");
  return file;
}

const ROW = {
  check_id: "close-booked",
  label: "Booked calls",
  window_label: "yesterday (2026-09-20)",
  source_name: "Close",
  ours: 163,
  source: 166,
  diff_pct: 1.8,
  status: "pass",
  detail: "Within tolerance.",
};

describe("getDataTrust", () => {
  it("returns the newest run's checks and the rendered glossary", async () => {
    const trust = await getDataTrust({
      client: client([
        { data: [{ run_at: "2026-09-21T12:30:00.000Z" }], error: null },
        { data: [ROW], error: null },
      ]),
      glossaryPath: await glossaryFile("# Reporting glossary\n\nOne rule.\n"),
    });

    expect(trust.run?.runAt).toBe("2026-09-21T12:30:00.000Z");
    expect(trust.run?.checks).toEqual([
      {
        checkId: "close-booked",
        label: "Booked calls",
        window: "yesterday (2026-09-20)",
        sourceName: "Close",
        ours: 163,
        source: 166,
        diffPct: 1.8,
        status: "pass",
        detail: "Within tolerance.",
      },
    ]);
    expect(trust.glossaryHtml).toContain("Reporting glossary");
    expect(trust.checksError).toBeNull();
    expect(trust.glossaryError).toBeNull();
  });

  it("still renders the glossary when the checks cannot be read", async () => {
    // Each half fails on its own. A page that rendered nothing because one
    // read failed would hide the other, which is what this screen exists to
    // prevent.
    const trust = await getDataTrust({
      client: client([{ data: null, error: { message: "permission denied" } }]),
      glossaryPath: await glossaryFile("# Reporting glossary\n"),
    });

    expect(trust.run).toBeNull();
    expect(trust.checksError).toBe("permission denied");
    expect(trust.glossaryHtml).toContain("Reporting glossary");
  });

  it("still renders the checks when the glossary is missing", async () => {
    const trust = await getDataTrust({
      client: client([
        { data: [{ run_at: "2026-09-21T12:30:00.000Z" }], error: null },
        { data: [ROW], error: null },
      ]),
      glossaryPath: "/nonexistent/REPORTING.md",
    });

    expect(trust.run?.checks).toHaveLength(1);
    expect(trust.glossaryHtml).toBeNull();
    expect(trust.glossaryError).toBeTruthy();
  });

  it("says nothing has been stored rather than reporting an error", async () => {
    const trust = await getDataTrust({
      client: client([{ data: [], error: null }]),
      glossaryPath: await glossaryFile("# Reporting glossary\n"),
    });

    expect(trust.run).toBeNull();
    expect(trust.checksError).toBeNull();
  });

  it("renders the glossary's tables, which are most of it", async () => {
    // Without GFM these come through as walls of pipe characters: measured
    // against the real REPORTING.md, 0 tables and 265 stray pipes.
    const trust = await getDataTrust({
      client: client([{ data: [], error: null }]),
      glossaryPath: await glossaryFile(
        "| Number | Source |\n| --- | --- |\n| Booked | Close |\n",
      ),
    });

    expect(trust.glossaryHtml).toContain("<table>");
    expect(trust.glossaryHtml).not.toContain("|");
  });

  it("strips script tags out of the glossary", async () => {
    const trust = await getDataTrust({
      client: client([{ data: [], error: null }]),
      glossaryPath: await glossaryFile(
        "# Title\n\n<script>alert(1)</script>\n",
      ),
    });

    expect(trust.glossaryHtml).not.toContain("<script");
  });
});

describe("verdicts", () => {
  it("maps a disagreement to the loud tone and an instruction", () => {
    expect(trustTone("fail")).toBe("bad");
    expect(trustVerdict("fail")).toBe("Disagrees — do not quote");
  });

  it("separates could-not-check from not-connected", () => {
    // An unreachable source must never read as agreement.
    expect(trustTone("error")).toBe("bad");
    expect(trustVerdict("error")).toBe("Could not be checked");
    expect(trustTone("skipped")).toBe("idle");
    expect(trustVerdict("skipped")).toBe("Not connected");
  });

  it("maps a pass to the quiet tone", () => {
    expect(trustTone("pass")).toBe("ok");
    expect(trustVerdict("pass")).toBe("Agrees with the source");
  });
});
