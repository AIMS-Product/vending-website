import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BlockToolbar } from "@/components/admin/seo-page-editor/BuilderEditorUi";

/**
 * Guards issue I8 (axe SERIOUS: aria-prohibited-attr). The block chrome icon
 * and status dot are generic <span>s; `aria-label` is prohibited on the
 * implicit `generic` role. They must carry a role that permits naming
 * (role="img") while still announcing the block name and status.
 */
function renderToolbar(overrides?: { status?: string }) {
  const noop = () => undefined;
  return renderToStaticMarkup(
    <BlockToolbar
      label="Hero"
      typeLabel="Hero"
      variantLabel="Hero — centered"
      description="Top of page"
      status={overrides?.status ?? "Ready"}
      icon="hero"
      blockIndex={0}
      blockCount={1}
      onMove={noop}
      onMoveToIndex={noop}
      onDuplicate={noop}
      onRemove={noop}
      onEditSettings={noop}
    />,
  );
}

/** Returns every opening `<span ...>` tag that carries an aria-label. */
function ariaLabelledSpanTags(html: string): string[] {
  return (html.match(/<span\b[^>]*\baria-label="[^"]*"[^>]*>/g) ?? []).map(
    (tag) => tag,
  );
}

describe("BlockToolbar aria naming (issue I8)", () => {
  it("never puts aria-label on a span without a permitting role", () => {
    const html = renderToolbar({ status: "Needs attention" });
    const offenders = ariaLabelledSpanTags(html).filter(
      (tag) => !/\brole="[^"]+"/.test(tag),
    );
    expect(offenders).toEqual([]);
  });

  it("still announces the block type name", () => {
    const html = renderToolbar();
    expect(html).toContain('aria-label="Hero block"');
  });

  it("still announces the block status when not Ready", () => {
    const html = renderToolbar({ status: "Needs attention" });
    expect(html).toContain('aria-label="Needs attention"');
  });
});
