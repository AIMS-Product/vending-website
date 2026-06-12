import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ImageFallback, ImageWithFallback } from "./ImageWithFallback";

describe("ImageFallback", () => {
  it("renders a branded placeholder, not a broken-image element", () => {
    const html = renderToStaticMarkup(<ImageFallback label="Cover image" />);

    expect(html).toContain('data-image-fallback="true"');
    expect(html).toContain('role="img"');
    expect(html).toContain('aria-label="Cover image"');
    // Branded block, not an <img> that could show a broken glyph.
    expect(html).not.toContain("<img");
  });
});

describe("ImageWithFallback", () => {
  it("renders the next/image element in the happy path", () => {
    const html = renderToStaticMarkup(
      <ImageWithFallback
        src="https://cdn.example.com/cover.jpg"
        alt="Cover image"
        fill
        sizes="100vw"
      />,
    );

    expect(html).toContain("<img");
    expect(html).not.toContain('data-image-fallback="true"');
  });

  it("renders the branded fallback when the image errors", () => {
    const html = renderToStaticMarkup(
      <ImageWithFallback
        src="https://cdn.example.com/cover.jpg"
        alt="Cover image"
        fill
        sizes="100vw"
        forceFallback
      />,
    );

    expect(html).toContain('data-image-fallback="true"');
    expect(html).toContain('aria-label="Cover image"');
    expect(html).not.toContain("<img");
  });
});
