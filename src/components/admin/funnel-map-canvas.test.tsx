import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CONVERSION_PINS } from "@/components/admin/funnel-map-graph";
import {
  FunnelMapCanvas,
  type Conversion,
} from "@/components/admin/FunnelMapCanvas";

/**
 * DOM-level guards for the map.
 *
 * `funnel-map-graph.test.ts` measures the geometry module, which is the right
 * check for "do these boxes overlap". It cannot see what the component actually
 * renders, and that blind spot shipped a real bug: `CONVERSION_PINS` was mapped
 * twice, so every conversion rate drew two pills. One copy sat inside `<svg>`,
 * where an absolutely positioned `<div>` has no meaning without a
 * `<foreignObject>`, so it escaped to the nearest positioned ancestor and
 * floated loose to the left of the spine. The suite stayed green throughout.
 */

function render() {
  const conversions: Record<string, Conversion> = Object.fromEntries(
    CONVERSION_PINS.map((pin, index) => [
      pin.id,
      { pct: 10 + index, lost: 100, tone: "neutral" as const },
    ]),
  );
  return renderToStaticMarkup(
    <FunnelMapCanvas
      metrics={{}}
      conversions={conversions}
      runs={[]}
      hrefs={{}}
    />,
  );
}

describe("FunnelMapCanvas", () => {
  it("draws each conversion pill exactly once", () => {
    const html = render();
    for (const [index, pin] of CONVERSION_PINS.entries()) {
      const pct = `${10 + index}%`;
      const drawn = html.split(pct).length - 1;
      expect(drawn, `${pin.id} drew ${drawn} pills showing ${pct}`).toBe(1);
    }
  });

  it("puts no positioned div inside the svg, where it cannot be laid out", () => {
    const html = render();
    const open = html.indexOf("<svg");
    const close = html.indexOf("</svg>");
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    const insideSvg = html.slice(open, close);
    // A div is only legal inside svg when wrapped in foreignObject.
    const divs = insideSvg.split("<div").length - 1;
    const wrappers = insideSvg.split("<foreignObject").length - 1;
    expect(
      divs === 0 || wrappers >= divs,
      `${divs} <div> inside <svg> with ${wrappers} <foreignObject>`,
    ).toBe(true);
  });
});
