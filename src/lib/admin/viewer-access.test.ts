import { readFileSync } from "node:fs";
import { readdirSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { isViewerReadableHref } from "./viewer-access";

const ADMIN_APP_DIR = path.resolve(process.cwd(), "src/app/admin");

/**
 * The four pages a read-only viewer may open. Anything else must deny them.
 * Written out by hand rather than derived from the module under test, so a
 * change to the allowlist has to be made twice and thought about once.
 */
const READ_ONLY_PAGES = [
  "page.tsx",
  "analytics/page.tsx",
  "bookings/page.tsx",
  "attribution/page.tsx",
];

/** Sign-in surfaces are reachable before there is a session at all. */
const UNGATED_PAGES = [
  "login/page.tsx",
  "forgot-password/page.tsx",
  // A bare redirect into a gated page; it renders nothing itself.
  "settings/page.tsx",
];

function adminPageFiles(dir = ADMIN_APP_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return adminPageFiles(full);
    return entry.name === "page.tsx" ? [full] : [];
  });
}

describe("isViewerReadableHref", () => {
  it("admits exactly the four reporting pages", () => {
    expect(isViewerReadableHref("/admin")).toBe(true);
    expect(isViewerReadableHref("/admin/analytics")).toBe(true);
    expect(isViewerReadableHref("/admin/bookings")).toBe(true);
    expect(isViewerReadableHref("/admin/attribution")).toBe(true);
  });

  it("refuses the surfaces holding lead PII, transcripts and edit access", () => {
    expect(isViewerReadableHref("/admin/leads")).toBe(false);
    expect(isViewerReadableHref("/admin/chatbot")).toBe(false);
    expect(isViewerReadableHref("/admin/chatbot/conversations/abc")).toBe(
      false,
    );
    expect(isViewerReadableHref("/admin/pages")).toBe(false);
    expect(isViewerReadableHref("/admin/news")).toBe(false);
    expect(isViewerReadableHref("/admin/media")).toBe(false);
    expect(isViewerReadableHref("/admin/settings/users")).toBe(false);
    expect(isViewerReadableHref("/admin/settings/routes")).toBe(false);
  });

  it("reads through a query string and a trailing slash", () => {
    expect(isViewerReadableHref("/admin/analytics?range=30&tab=kpi")).toBe(
      true,
    );
    expect(isViewerReadableHref("/admin/bookings/")).toBe(true);
    expect(isViewerReadableHref("/admin?range=7")).toBe(true);
  });

  it("does not let a child route inherit its parent's access", () => {
    // A future /admin/bookings/<id> detail page would show that lead's
    // record. It stays denied until someone lists it deliberately.
    expect(isViewerReadableHref("/admin/bookings/lead_1")).toBe(false);
    expect(isViewerReadableHref("/admin/analytics/export")).toBe(false);
  });

  it("is not fooled by a path that merely starts with an allowed one", () => {
    expect(isViewerReadableHref("/admin-secret")).toBe(false);
    expect(isViewerReadableHref("/admin/bookings-export")).toBe(false);
  });
});

describe("every admin page picks a gate deliberately", () => {
  // This is the real protection. requireAdmin() denies viewers, so any page
  // that calls it is closed to them for free — including pages written after
  // this slice, by someone who never heard of the viewer role. The failure
  // this prevents is the opposite one: a new page shipped with NO gate, or a
  // page quietly switched to requireReadAccess and handed a viewer the lead
  // table.
  const files = adminPageFiles();

  it("finds the admin pages at all", () => {
    expect(files.length).toBeGreaterThan(30);
  });

  it.each(files.map((file) => [path.relative(ADMIN_APP_DIR, file), file]))(
    "%s",
    (relative, file) => {
      const source = readFileSync(file, "utf8");
      const usesReadAccess = source.includes("requireReadAccess()");
      const usesAdmin = source.includes("requireAdmin()");

      if (UNGATED_PAGES.includes(relative)) {
        expect(usesReadAccess || usesAdmin).toBe(false);
        return;
      }

      if (READ_ONLY_PAGES.includes(relative)) {
        expect(usesReadAccess).toBe(true);
        expect(usesAdmin).toBe(false);
        return;
      }

      expect(usesAdmin).toBe(true);
      expect(usesReadAccess).toBe(false);
    },
  );
});
