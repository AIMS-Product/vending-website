import { describe, it, expect } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders headers, paragraphs, and lists", async () => {
    const html = await renderMarkdown(
      "# Hello\n\nA paragraph.\n\n- One\n- Two",
    );
    expect(html).toContain("<h1>Hello</h1>");
    expect(html).toContain("<p>A paragraph.</p>");
    expect(html).toContain("<ul>");
    expect(html).toContain("<li>One</li>");
  });

  it("renders bold and italics", async () => {
    const html = await renderMarkdown("**bold** and *italic*");
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain("<em>italic</em>");
  });

  it("renders external links with safe attributes", async () => {
    const html = await renderMarkdown("[example](https://example.com)");
    expect(html).toContain('href="https://example.com"');
  });

  it("renders relative image paths", async () => {
    const html = await renderMarkdown("![alt text](/images/news/cover.jpg)");
    expect(html).toContain('src="/images/news/cover.jpg"');
    expect(html).toContain('alt="alt text"');
  });

  it("strips <script> tags", async () => {
    const html = await renderMarkdown(
      "Before\n\n<script>alert(1)</script>\n\nAfter",
    );
    expect(html).not.toContain("<script");
    expect(html).not.toContain("alert(1)");
  });

  it("strips event handlers from injected HTML", async () => {
    const html = await renderMarkdown(
      '<img src="/x.png" onerror="alert(1)" alt="x">',
    );
    expect(html).not.toContain("onerror");
    expect(html).not.toContain("alert(1)");
  });

  it("blocks javascript: URLs in links", async () => {
    const html = await renderMarkdown("[click](javascript:alert(1))");
    expect(html).not.toMatch(/href=["']javascript:/i);
    expect(html).not.toContain("alert(1)");
  });

  it("blocks data: URLs in image src", async () => {
    const html = await renderMarkdown(
      "![bad](data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=)",
    );
    expect(html).not.toMatch(/src=["']data:/i);
  });

  it("strips <iframe> tags", async () => {
    const html = await renderMarkdown(
      '<iframe src="https://evil.example"></iframe>',
    );
    expect(html).not.toContain("<iframe");
  });

  it("preserves code blocks", async () => {
    const html = await renderMarkdown("```\nconst x = 1;\n```");
    expect(html).toContain("<pre>");
    expect(html).toContain("<code>");
    expect(html).toContain("const x = 1;");
  });
});

describe("renderMarkdown image optimization", () => {
  it("routes allowed-host images through the Next image optimizer, lazily", async () => {
    const html = await renderMarkdown(
      "![restock](https://aacisvhkmsaabqdvdmmf.supabase.co/storage/v1/object/public/news/restock.jpg)",
    );
    expect(html).toContain(
      'src="/_next/image?url=https%3A%2F%2Faacisvhkmsaabqdvdmmf.supabase.co%2Fstorage%2Fv1%2Fobject%2Fpublic%2Fnews%2Frestock.jpg&#x26;w=1200&#x26;q=75"',
    );
    expect(html).toContain('loading="lazy"');
    expect(html).toContain('decoding="async"');
    expect(html).toContain('alt="restock"');
  });

  it("leaves images on unlisted hosts unrewritten (optimizer would 400)", async () => {
    const html = await renderMarkdown("![x](https://example.com/photo.jpg)");
    expect(html).toContain('src="https://example.com/photo.jpg"');
    expect(html).toContain('loading="lazy"');
  });

  it("leaves root-relative images unrewritten but still lazy", async () => {
    const html = await renderMarkdown("![alt](/images/news/cover.jpg)");
    expect(html).toContain('src="/images/news/cover.jpg"');
    expect(html).toContain('loading="lazy"');
  });
});
