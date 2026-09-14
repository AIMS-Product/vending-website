import { describe, expect, it } from "vitest";
import {
  CANVAS,
  CONVERSION_PINS,
  EDGES,
  GROUP_BOXES,
  NODES,
  PILL_H,
  PILL_W,
} from "./funnel-map-graph";

/**
 * The layout is hand-placed canvas coordinates, so nothing but this file stops
 * an edit from dropping a number behind a box.
 *
 * An earlier version of this test invented the pill's size instead of
 * importing it. The real pill was wider, its text wrapped to four lines, and
 * three of them sat on top of spine boxes on screen while the suite stayed
 * green. Every dimension here now comes from the module the component reads.
 */

/** Touching is not overlapping, but flush against a box still reads as stuck. */
const CLEAR = 8;

type Rect = { id: string; x: number; y: number; w: number; h: number };

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
  );
}

function grow(rect: Rect, by: number): Rect {
  return {
    ...rect,
    x: rect.x - by,
    y: rect.y - by,
    w: rect.w + by * 2,
    h: rect.h + by * 2,
  };
}

const boxes: Rect[] = NODES.map((node) => ({
  id: node.id,
  x: node.x,
  y: node.y,
  w: node.w,
  h: node.h,
}));

const pills: Rect[] = CONVERSION_PINS.map((pin) => ({
  id: `pill:${pin.id}`,
  x: pin.x - PILL_W / 2,
  y: pin.y,
  w: PILL_W,
  h: PILL_H,
}));

/** Centred 10px text, measured from its own length rather than guessed flat. */
const labels: Rect[] = EDGES.filter((edge) => edge.label && edge.labelAt).map(
  (edge) => {
    const width = Math.max(48, edge.label!.length * 5.6);
    return {
      id: `label:${edge.from}-${edge.to}`,
      x: edge.labelAt!.x - width / 2,
      y: edge.labelAt!.y - 8,
      w: width,
      h: 14,
    };
  },
);

function firstCollision(subject: Rect, others: Rect[], clear: number) {
  const grown = grow(subject, clear);
  return others.find(
    (other) => other.id !== subject.id && overlaps(grown, other),
  );
}

describe("map layout", () => {
  it("runs the funnel down the page, each step below the one before", () => {
    const order = ["page", "lead", "calendly", "outcome"];
    const tops = order.map((id) => boxes.find((box) => box.id === id)!.y);
    expect(tops).toEqual([...tops].sort((a, b) => a - b));
    // Every spine box shares one centre line, so the flow reads as one column.
    const centres = order.map((id) => {
      const box = boxes.find((candidate) => candidate.id === id)!;
      return box.x + box.w / 2;
    });
    expect(new Set(centres).size).toBe(1);
  });

  it("never lets one box sit on another", () => {
    for (const box of boxes) {
      expect(firstCollision(box, boxes, 0)?.id ?? null).toBeNull();
    }
  });

  it("keeps every box and pill inside the canvas", () => {
    for (const rect of [...boxes, ...pills]) {
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.w).toBeLessThanOrEqual(CANVAS.width);
      expect(rect.y + rect.h).toBeLessThanOrEqual(CANVAS.height);
    }
  });

  it("never lets a pill touch a box, a label, or another pill", () => {
    for (const pill of pills) {
      expect(
        firstCollision(pill, [...boxes, ...labels, ...pills], CLEAR)?.id ??
          null,
      ).toBeNull();
    }
  });

  it("never lets an edge label land on a box", () => {
    for (const label of labels) {
      expect(firstCollision(label, boxes, 0)?.id ?? null).toBeNull();
    }
  });

  it("keeps each dashed region around the boxes it claims", () => {
    const contains = (group: (typeof GROUP_BOXES)[number], box: Rect) =>
      box.x >= group.x &&
      box.y >= group.y &&
      box.x + box.w <= group.x + group.w &&
      box.y + box.h <= group.y + group.h;
    const site = GROUP_BOXES.find((group) => group.id === "site")!;
    for (const id of ["page", "chatbot", "form"]) {
      expect(
        contains(
          site,
          boxes.find((box) => box.id === id)!,
        ),
      ).toBe(true);
    }
    const out = GROUP_BOXES.find((group) => group.id === "going-out")!;
    for (const id of [
      "webinars",
      "youtube",
      "social",
      "ads",
      "email",
      "funnels",
      "dm",
    ]) {
      expect(
        contains(
          out,
          boxes.find((box) => box.id === id)!,
        ),
      ).toBe(true);
    }
  });
});

describe("conversion pins", () => {
  it("places one pill on every spine step, in funnel order", () => {
    expect(CONVERSION_PINS.map((pin) => pin.id)).toEqual([
      "visits-leads",
      "leads-booked",
      "booked-showed",
    ]);
    for (let i = 1; i < CONVERSION_PINS.length; i += 1) {
      expect(CONVERSION_PINS[i]!.from).toBe(CONVERSION_PINS[i - 1]!.to);
    }
  });

  it("puts each pill between the two boxes it divides", () => {
    const box = (id: string) => boxes.find((entry) => entry.id === id)!;
    const between = [
      ["visits-leads", "page", "lead"],
      ["leads-booked", "lead", "calendly"],
      ["booked-showed", "calendly", "outcome"],
    ] as const;
    for (const [pinId, above, below] of between) {
      const pill = pills.find((entry) => entry.id === `pill:${pinId}`)!;
      expect(pill.y).toBeGreaterThan(box(above).y + box(above).h);
      expect(pill.y + pill.h).toBeLessThan(box(below).y);
    }
  });
});
