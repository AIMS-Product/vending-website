import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LibrariesWorkspace } from "./LibrariesWorkspace";
import type { PageBuilderLibraries } from "@/lib/services/page-builder-libraries";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";

// P1-7 / I10: /admin/libraries used to render five always-open forms stacked
// on one page with a hidden source-document -> excerpt -> claim dependency and
// no starting point. The default view must now be five compact summary cards
// with a dependency cue and zero always-open forms; each library's add form
// and item list only render inside its drawer once opened.

const emptyLibraries: PageBuilderLibraries = {
  proofItems: [],
  ctaPresets: [],
  sourceDocuments: [],
  sourceExcerpts: [],
  approvedClaims: [],
};

const noMediaAssets: EditorMediaAsset[] = [];

describe("LibrariesWorkspace default view", () => {
  it("renders five library summary cards with plain-language names", () => {
    const html = renderToStaticMarkup(
      <LibrariesWorkspace
        libraries={emptyLibraries}
        editorMediaAssets={noMediaAssets}
      />,
    );

    expect(html).toContain("CTA presets");
    expect(html).toContain("Proof items");
    expect(html).toContain("Source documents");
    expect(html).toContain("Source excerpts");
    expect(html).toContain("Approved claims");
  });

  it("renders zero always-open library forms in the default HTML", () => {
    const html = renderToStaticMarkup(
      <LibrariesWorkspace
        libraries={emptyLibraries}
        editorMediaAssets={noMediaAssets}
      />,
    );

    // The add-form fields (by name attribute) must not be present until a
    // drawer is opened — the SSR/default markup must contain no <form>
    // elements carrying these library field names.
    expect(html).not.toContain('name="label"');
    expect(html).not.toContain('name="stylePreset"');
    expect(html).not.toContain('name="sourceDocumentId"');
    expect(html).not.toContain('name="claimType"');
    expect(html).not.toMatch(/<form\b/);
  });

  it("shows a primary Add action per card", () => {
    const html = renderToStaticMarkup(
      <LibrariesWorkspace
        libraries={emptyLibraries}
        editorMediaAssets={noMediaAssets}
      />,
    );

    expect(html).toMatch(/Add(\s+a| an)?\s+CTA preset/i);
    expect(html).toMatch(/Add(\s+a| an)?\s+proof item/i);
    expect(html).toMatch(/Add(\s+a| an)?\s+source document/i);
    expect(html).toMatch(/Add(\s+a| an)?\s+source excerpt/i);
    expect(html).toMatch(/Add(\s+a| an)?\s+approved claim/i);
  });

  it("renders a plain-English dependency cue explaining library order", () => {
    const html = renderToStaticMarkup(
      <LibrariesWorkspace
        libraries={emptyLibraries}
        editorMediaAssets={noMediaAssets}
      />,
    );

    expect(html).toMatch(/source documents/i);
    expect(html).toMatch(/excerpts/i);
    expect(html).toMatch(/approved claims/i);
    // Should not use raw schema/jargon terms.
    expect(html).not.toContain("governed copy");
  });

  it("shows current item counts on each card", () => {
    const libraries: PageBuilderLibraries = {
      proofItems: [
        {
          id: "1",
          approved: true,
        } as PageBuilderLibraries["proofItems"][number],
      ],
      ctaPresets: [],
      sourceDocuments: [],
      sourceExcerpts: [],
      approvedClaims: [],
    };

    const html = renderToStaticMarkup(
      <LibrariesWorkspace
        libraries={libraries}
        editorMediaAssets={noMediaAssets}
      />,
    );

    expect(html).toMatch(/\b1\b/);
  });
});
