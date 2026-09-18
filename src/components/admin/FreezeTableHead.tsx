"use client";

import { useEffect, useRef } from "react";

/**
 * Keeps a wide table's header row pinned to the top of the window while the
 * page scrolls past the table. Render it as the first child of the table's
 * horizontal scroll box.
 *
 * CSS `position: sticky` cannot do this: a box that scrolls sideways is also a
 * vertical scroll container, so a sticky <thead> sticks to the box, not the
 * page, and scrolls away with it. This moves the header cells down by exactly
 * how far the box's top has gone above the window instead.
 */
export function FreezeTableHead() {
  const marker = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const frame = marker.current?.parentElement;
    const head = frame?.querySelector("thead");
    if (!frame || !head) return;
    const cells = Array.from(head.querySelectorAll<HTMLElement>("th"));
    for (const cell of cells) {
      const position = getComputedStyle(cell).position;
      if (position === "static") cell.style.position = "relative";
      // The frozen first column's header sits above the cells scrolling
      // sideways under it, and every header cell above the body rows.
      cell.style.zIndex = position === "sticky" ? "40" : "30";
    }

    let frameRequest = 0;
    const place = () => {
      frameRequest = 0;
      const box = frame.getBoundingClientRect();
      const room = Math.max(0, box.height - head.offsetHeight);
      const offset = Math.min(Math.max(0, -box.top), room);
      const transform = offset ? `translateY(${offset}px)` : "";
      for (const cell of cells) cell.style.transform = transform;
    };
    const schedule = () => {
      if (!frameRequest) frameRequest = requestAnimationFrame(place);
    };

    document.addEventListener("scroll", schedule, {
      passive: true,
      capture: true,
    });
    window.addEventListener("resize", schedule);
    place();
    return () => {
      document.removeEventListener("scroll", schedule, { capture: true });
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frameRequest);
    };
  }, []);

  return <span ref={marker} hidden />;
}
