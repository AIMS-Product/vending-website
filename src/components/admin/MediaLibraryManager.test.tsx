import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  MediaLibraryManager,
  type MediaAssetListItem,
} from "./MediaLibraryManager";

// MediaLibraryManager calls useRouter() for router.refresh() after mutations;
// SSR has no app-router context, so provide a minimal mock.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
}));

vi.mock("@/app/admin/media/actions", () => ({
  bulkAddMediaTags: vi.fn(),
  bulkCreateMediaAssets: vi.fn(),
  bulkDeleteMediaAssets: vi.fn(),
  createMediaAsset: vi.fn(),
  deleteMediaAsset: vi.fn(),
  fetchMediaAssetUsage: vi.fn(),
  updateMediaAsset: vi.fn(),
}));

function buildAsset(
  overrides: Partial<MediaAssetListItem> = {},
): MediaAssetListItem {
  return {
    id: "asset_1",
    assetType: "image",
    title: "Hero banner",
    alt_text: "Vending machine in a busy lobby",
    caption: null,
    source_rights_notes: null,
    storage_bucket: "media",
    storage_path: "hero-banner.jpg",
    external_url: null,
    duration_seconds: null,
    tags: [],
    created_at: "2026-06-01T00:00:00.000Z",
    publicUrl: "",
    usageCount: 0,
    ...overrides,
  };
}

describe("MediaLibraryManager badge contrast", () => {
  it("renders the in-use badge with a darkened blue pair (grid view)", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryManager
        assets={[buildAsset({ usageCount: 1 })]}
        view="grid"
      />,
    );

    expect(html).toContain("1 in use");
    expect(html).toContain("bg-blue-100 text-blue-900");
    expect(html).not.toContain("bg-[#e9f1ff]");
    expect(html).not.toContain("text-[#0b63f6]");
  });

  it("renders the unused badge with a darkened slate pair", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryManager
        assets={[buildAsset({ usageCount: 0 })]}
        view="grid"
      />,
    );

    expect(html).toContain("Unused");
    expect(html).toContain("bg-slate-100 text-slate-700");
  });

  it("renders the Stored badge with a darkened emerald pair", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryManager
        assets={[
          buildAsset({ storage_path: "hero-banner.jpg", external_url: null }),
        ]}
        view="grid"
      />,
    );

    expect(html).toContain("Stored");
    expect(html).toContain(
      'bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">Stored',
    );
  });

  it("renders the External badge with a darkened slate pair", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryManager
        assets={[
          buildAsset({
            storage_path: null,
            external_url: "https://cdn.example.com/hero.jpg",
          }),
        ]}
        view="grid"
      />,
    );

    expect(html).toContain("External");
    expect(html).toContain(
      'bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">External',
    );
  });

  it("renders the Needs metadata badge with a darkened amber pair when alt text is missing", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryManager
        assets={[buildAsset({ alt_text: "" })]}
        view="grid"
      />,
    );

    expect(html).toContain("Needs metadata");
    expect(html).toContain(
      'bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-900">',
    );
    expect(html).not.toContain("Missing alt");
  });

  it("does not show the Needs metadata badge when alt text is present", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryManager
        assets={[buildAsset({ alt_text: "Descriptive alt text" })]}
        view="grid"
      />,
    );

    expect(html).not.toContain("Needs metadata");
  });

  it("renders the same badge classes in the list/table view", () => {
    const html = renderToStaticMarkup(
      <MediaLibraryManager
        assets={[buildAsset({ usageCount: 3 })]}
        view="list"
      />,
    );

    expect(html).toContain("3 in use");
    expect(html).toContain("bg-blue-100 text-blue-900");
  });
});
