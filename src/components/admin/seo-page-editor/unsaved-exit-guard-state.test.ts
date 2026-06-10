import { describe, expect, it } from "vitest";
import {
  discardableDraftId,
  isAutoCreatedNeverSavedDraft,
  rowIsDeletableAsNeverSavedDraft,
} from "./unsaved-exit-guard-state";

const AUTO_ID = "11111111-1111-4111-8111-111111111111";
const LOADED_ID = "22222222-2222-4222-8222-222222222222";

describe("isAutoCreatedNeverSavedDraft", () => {
  it("is true when an auto-created row exists but no server page was loaded", () => {
    expect(
      isAutoCreatedNeverSavedDraft({
        loadedPageId: undefined,
        effectivePageId: AUTO_ID,
      }),
    ).toBe(true);
  });

  it("is false before any row exists (brand-new page, nothing typed yet)", () => {
    expect(
      isAutoCreatedNeverSavedDraft({
        loadedPageId: undefined,
        effectivePageId: null,
      }),
    ).toBe(false);
  });

  it("is false for a loaded/explicitly-saved page even if effective id matches", () => {
    expect(
      isAutoCreatedNeverSavedDraft({
        loadedPageId: LOADED_ID,
        effectivePageId: LOADED_ID,
      }),
    ).toBe(false);
  });

  it("is false after an explicit save with no remount (page prop still undefined)", () => {
    expect(
      isAutoCreatedNeverSavedDraft({
        loadedPageId: undefined,
        effectivePageId: AUTO_ID,
        explicitlySavedThisSession: true,
      }),
    ).toBe(false);
  });
});

describe("discardableDraftId", () => {
  it("returns the auto-created id when discard is allowed", () => {
    expect(
      discardableDraftId({
        loadedPageId: null,
        effectivePageId: AUTO_ID,
      }),
    ).toBe(AUTO_ID);
  });

  it("returns null for an explicitly-saved/loaded page (never offer Discard)", () => {
    expect(
      discardableDraftId({
        loadedPageId: LOADED_ID,
        effectivePageId: LOADED_ID,
      }),
    ).toBeNull();
  });

  it("returns null after an explicit save with no remount (never offer Discard)", () => {
    expect(
      discardableDraftId({
        loadedPageId: undefined,
        effectivePageId: AUTO_ID,
        explicitlySavedThisSession: true,
      }),
    ).toBeNull();
  });

  it("returns null when there is no row to discard", () => {
    expect(
      discardableDraftId({
        loadedPageId: undefined,
        effectivePageId: undefined,
      }),
    ).toBeNull();
  });
});

describe("rowIsDeletableAsNeverSavedDraft", () => {
  it("allows deleting a never-published draft with no revisions", () => {
    expect(
      rowIsDeletableAsNeverSavedDraft({
        status: "draft",
        published_at: null,
        published_revision_id: null,
        revisionCount: 0,
      }),
    ).toBe(true);
  });

  it("rejects a published page (data-loss floor)", () => {
    expect(
      rowIsDeletableAsNeverSavedDraft({
        status: "published",
        published_at: "2026-06-01T00:00:00.000Z",
        published_revision_id: "rev_1",
        revisionCount: 1,
      }),
    ).toBe(false);
  });

  it("rejects a draft that was previously published (published_at present)", () => {
    expect(
      rowIsDeletableAsNeverSavedDraft({
        status: "draft",
        published_at: "2026-06-01T00:00:00.000Z",
        published_revision_id: null,
        revisionCount: 0,
      }),
    ).toBe(false);
  });

  it("rejects any draft that has accumulated revisions", () => {
    expect(
      rowIsDeletableAsNeverSavedDraft({
        status: "draft",
        published_at: null,
        published_revision_id: null,
        revisionCount: 2,
      }),
    ).toBe(false);
  });

  it("rejects an archived row", () => {
    expect(
      rowIsDeletableAsNeverSavedDraft({
        status: "archived",
        published_at: null,
        published_revision_id: null,
        revisionCount: 0,
      }),
    ).toBe(false);
  });
});
