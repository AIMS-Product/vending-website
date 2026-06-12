import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { NewsEditorForm } from "./NewsEditorForm";
import { adminPrimaryButtonClass, adminSecondaryButtonClass } from "./AdminUi";

vi.mock("@/app/admin/news/actions", () => ({
  savePost: vi.fn(),
  createSignedImageUpload: vi.fn(),
}));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(),
}));

function buttonClass(html: string, intent: string): string {
  const marker = `value="${intent}"`;
  const index = html.indexOf(marker);
  if (index === -1) throw new Error(`No button with intent ${intent}`);
  const open = html.lastIndexOf("<button", index);
  return html.slice(open, index);
}

describe("NewsEditorForm publish actions", () => {
  it("renders Publish as the solid primary and Save draft as the outline secondary", () => {
    const html = renderToStaticMarkup(<NewsEditorForm />);

    const publishClass = buttonClass(html, "publish");
    const saveClass = buttonClass(html, "save");

    // Publish is the single solid primary (consequential, public action).
    expect(publishClass).toContain(adminPrimaryButtonClass);
    // Save draft is the safe secondary, visually distinct from Publish.
    expect(saveClass).toContain(adminSecondaryButtonClass);
    expect(saveClass).not.toContain(adminPrimaryButtonClass);
  });
});
