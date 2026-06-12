import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { AdminPaginationLink } from "./AdminPaginationLink";

describe("AdminPaginationLink", () => {
  it("renders an enabled control as a link with an accessible label", () => {
    const html = renderToStaticMarkup(
      <AdminPaginationLink href="/admin/news?page=2" label="Next page" next />,
    );

    expect(html).toContain('href="/admin/news?page=2"');
    expect(html).toContain('aria-label="Next page"');
    expect(html).toContain("<a");
  });

  it("renders a disabled control as a disabled button, never a span with aria-label", () => {
    const html = renderToStaticMarkup(
      <AdminPaginationLink
        href="/admin/news?page=1"
        label="Previous page"
        disabled
      />,
    );

    // aria-prohibited-attr: aria-label is not allowed on a <span> without a role.
    // The disabled control must be a <button disabled>, which permits aria-label.
    expect(html).toContain("<button");
    expect(html).toContain("disabled");
    expect(html).toContain('aria-label="Previous page"');
    expect(html).not.toContain('<span aria-disabled="true" aria-label');
  });
});
