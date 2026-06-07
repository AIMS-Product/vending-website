import { describe, expect, it } from "vitest";
import { pageBlockSchema } from "@/lib/page-builder/blocks";
import { createDocumentImportProposal } from "@/lib/page-builder/document-import";

describe("document import mapping", () => {
  it("maps pasted document text into validated rich text blocks with source context", () => {
    let blockIndex = 0;
    const proposal = createDocumentImportProposal({
      makeProposalId: () => "document_import_test",
      makeBlockId: () => `block_import_${++blockIndex}`,
      text: `# Vending route plan
Start with the [application guide](/apply) before outreach.
- Validate location traffic
- Estimate refill cadence

## Launch checklist
1. Confirm machine budget
2. Assign first outreach list`,
    });

    expect(proposal.sourceKind).toBe("pasted_text");
    expect(proposal.sourceTitle).toBe("Vending route plan");
    expect(proposal.sourceExcerpt).toContain("application guide");
    expect(proposal.blocks).toHaveLength(2);
    expect(proposal.blocks[0]?.sourceLines).toEqual([1, 4]);
    expect(proposal.blocks[0]?.sourceExcerpt).toContain(
      "Validate location traffic",
    );

    const firstBlock = proposal.blocks[0]?.block;
    expect(() => pageBlockSchema.parse(firstBlock)).not.toThrow();
    expect(firstBlock?.type).toBe("rich_text");
    if (firstBlock?.type !== "rich_text") throw new Error("Expected rich text");
    expect(firstBlock.props.body.nodes[0]).toMatchObject({
      type: "paragraph",
      spans: [
        { text: "Start with the " },
        { text: "application guide", href: "/apply" },
        { text: " before outreach." },
      ],
    });
    expect(firstBlock.props.body.nodes[1]).toMatchObject({
      type: "list",
      style: "bullet",
      items: ["Validate location traffic", "Estimate refill cadence"],
    });
  });

  it("does not preserve unsafe markdown links as href spans", () => {
    const proposal = createDocumentImportProposal({
      makeProposalId: () => "document_import_test",
      makeBlockId: () => "block_import_1",
      text: "# Unsafe\nRead [bad](javascript:alert(1)) now.",
    });
    const block = proposal.blocks[0]?.block;
    if (block?.type !== "rich_text") throw new Error("Expected rich text");

    expect(block.props.body.nodes[0]).toEqual({
      type: "paragraph",
      text: "Read [bad](javascript:alert(1)) now.",
    });
  });
});
