import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { NewsPublishButton } from "./NewsPublishButton";
import { adminPrimaryButtonClass } from "./AdminUi";

// I12: Publish takes the post live and previously sat beside "Save draft" with
// no warning. The button must still drive the editor's publish path
// (name="intent" value="publish") while gating the first click behind an
// accessible confirm dialog.

describe("NewsPublishButton", () => {
  it("renders a submit button wired to the publish intent", () => {
    const html = renderToStaticMarkup(
      <NewsPublishButton className={adminPrimaryButtonClass} />,
    );
    expect(html).toMatch(/<button\b[^>]*type="submit"/);
    expect(html).toContain('name="intent"');
    expect(html).toContain('value="publish"');
    expect(html).toContain(adminPrimaryButtonClass);
  });

  it("associates with a specific form when a formId is provided (mobile bar)", () => {
    const html = renderToStaticMarkup(
      <NewsPublishButton
        className="mobile-publish"
        formId="news-editor-form"
      />,
    );
    expect(html).toContain('form="news-editor-form"');
    expect(html).toContain('value="publish"');
  });

  it("does not render the confirm dialog until the button is clicked", () => {
    // SSR render: isConfirmOpen starts false, so the modal is absent. The dialog
    // is created on interaction, keeping the default markup a plain button.
    const html = renderToStaticMarkup(
      <NewsPublishButton className={adminPrimaryButtonClass} />,
    );
    expect(html).not.toContain("<dialog");
    expect(html).not.toContain("Publish this post?");
  });
});
