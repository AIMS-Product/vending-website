import { describe, expect, it } from "vitest";
import { CANVAS, CONVERSION_PINS, EDGES, NODES } from "./funnel-map-graph";

/**
 * The pills are placed by hand on canvas coordinates, so nothing stops a later
 * edit from dropping one behind a box. These assertions are the thing that
 * does: a pill that overlaps a node, an edge label, or another pill is a pill
 * nobody can read, and the map is only worth anything if its numbers are
 * legible.
 */

/** Matches the ConversionPill box: 84 wide, centred on x, about 48 tall. */
const PILL_W = 84;
const PILL_H = 48;

type Rect = { x: number; y: number; w: number; h: number; id: string };

function pillRect(pin: (typeof CONVERSION_PINS)[number]): Rect {
  return {
    id: `pill:${pin.id}`,
    x: pin.x - PILL_W / 2,
    y: pin.y,
    w: PILL_W,
    h: PILL_H,
  };
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

describe("conversion pins", () => {
  it("places one pill on every spine step, in funnel order", () => {
    expect(CONVERSION_PINS.map((pin) => pin.id)).toEqual([
      "visits-leads",
      "leads-booked",
      "booked-showed",
    ]);
    // Each pill divides the stage the one before it arrived at.
    for (let i = 1; i < CONVERSION_PINS.length; i += 1) {
      expect(CONVERSION_PINS[i]!.from).toBe(CONVERSION_PINS[i - 1]!.to);
    }
  });

  it("keeps every pill inside the canvas", () => {
    for (const pin of CONVERSION_PINS) {
      const rect = pillRect(pin);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(CANVAS.width);
      expect(rect.y + rect.h).toBeLessThanOrEqual(CANVAS.height);
    }
  });

  it("never lets a pill sit on top of a box", () => {
    const boxes: Rect[] = NODES.map((node) => ({
      id: node.id,
      x: node.x,
      y: node.y,
      w: node.w,
      h: node.h,
    }));
    for (const pin of CONVERSION_PINS) {
      const rect = pillRect(pin);
      const hit = boxes.find((box) => overlaps(rect, box));
      expect(hit?.id ?? null).toBeNull();
    }
  });

  it("never lets two pills collide", () => {
    const rects = CONVERSION_PINS.map(pillRect);
    for (let i = 0; i < rects.length; i += 1) {
      for (let j = i + 1; j < rects.length; j += 1) {
        expect(overlaps(rects[i]!, rects[j]!)).toBe(false);
      }
    }
  });

  it("never lets a pill cover an edge label", () => {
    const labels = EDGES.filter((edge) => edge.label && edge.labelAt).map(
      (edge) => ({
        id: `label:${edge.from}-${edge.to}`,
        // The label is centred text, roughly this size at 10px.
        x: edge.labelAt!.x - 40,
        y: edge.labelAt!.y - 10,
        w: 80,
        h: 14,
      }),
    );
    for (const pin of CONVERSION_PINS) {
      const rect = pillRect(pin);
      const hit = labels.find((label) => overlaps(rect, label));
      expect(hit?.id ?? null).toBeNull();
    }
  });
});
