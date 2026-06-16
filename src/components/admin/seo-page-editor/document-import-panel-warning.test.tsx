import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { DocumentImportPanel } from "@/components/admin/seo-page-editor/AiBuilderAssistant";
import { createDocumentImportProposal } from "@/lib/page-builder/document-import";

/**
 * Guards issue I7 (R3-7): when a pasted document parses to more sections than
 * the import cap, the truncation warning must be visible in the import review
 * panel as a live region (role="status") before any blocks are inserted.
 */
function documentWithSections(count: number) {
  return Array.from(
    { length: count },
    (_, index) => `# Section ${index + 1}\nBody for section ${index + 1}`,
  ).join("\n");
}

function renderPanel(sectionCount: number) {
  const text = documentWithSections(sectionCount);
  let blockIndex = 0;
  const proposal = createDocumentImportProposal({
    makeProposalId: () => "document_import_test",
    makeBlockId: () => `block_import_${++blockIndex}`,
    text,
  });
  const noop = () => undefined;
  return renderToStaticMarkup(
    <DocumentImportPanel
      message={null}
      proposal={proposal}
      text={text}
      onCreateProposal={noop}
      onInsertBlocks={noop}
      onTextChange={noop}
    />,
  );
}

describe("DocumentImportPanel truncation warning (issue I7)", () => {
  it("shows Markdown formatting guidance before import", () => {
    const html = renderPanel(1);

    expect(html).toContain("Formatting guidelines");
    expect(html).toContain("# Title");
    expect(html).toContain("## Section");
    expect(html).toContain("max 8");
    expect(html).toContain("[text](url)");
  });

  it("renders the dropped-section warning as a status live region", () => {
    const html = renderPanel(10);
    expect(html).toMatch(
      /<p[^>]*\brole="status"[^>]*>2 sections dropped — only the first 8 were imported\.<\/p>/,
    );
  });

  it("renders no truncation warning at or under the cap", () => {
    const html = renderPanel(8);
    expect(html).not.toContain('role="status"');
    expect(html).not.toContain("dropped");
  });
});
