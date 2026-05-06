import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AiProposalValidationError,
  adminAcceptAiProposalBlocks,
} from "./ai-page-proposals";
import type { Database } from "@/types/database";

type ProposalClient = Pick<SupabaseClient<Database>, "from">;

const proposal = {
  version: 1,
  metadata: { seoTitle: "AI title" },
  warnings: [],
  blocks: [
    {
      block: {
        id: "block_ai",
        type: "rich_text",
        variant: "default",
        props: {
          eyebrow: "",
          heading: "AI supported block",
          body: {
            version: 1,
            nodes: [{ type: "paragraph", text: "Source-backed text." }],
          },
        },
      },
      sourceDocumentIds: [],
      sourceExcerptIds: ["11111111-1111-4111-8111-111111111111"],
      approvedClaimIds: [],
      warnings: [],
    },
  ],
};

function maybeSingleByMatch(data: unknown, error: unknown = null) {
  const maybeSingle = vi.fn().mockResolvedValue({ data, error });
  const match = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ match });
  return { table: { select }, mocks: { select, match, maybeSingle } };
}

function singleByEq(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq, single } };
}

function insertSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const insert = vi.fn().mockReturnValue({ select });
  return { table: { insert }, mocks: { insert, select, single } };
}

function updateSingle(data: unknown, error: unknown = null) {
  const single = vi.fn().mockResolvedValue({ data, error });
  const select = vi.fn().mockReturnValue({ single });
  const eq = vi.fn().mockReturnValue({ select });
  const update = vi.fn().mockReturnValue({ eq });
  return { table: { update }, mocks: { update, eq, select, single } };
}

function buildClient(...tables: unknown[]) {
  return {
    from: vi.fn().mockImplementation(() => {
      const next = tables.shift();
      if (!next) throw new Error("Unexpected Supabase table call");
      return next;
    }),
  } as unknown as ProposalClient & { from: ReturnType<typeof vi.fn> };
}

describe("AI page proposals", () => {
  it("rejects insertion for selected blocks with unsupported warnings", async () => {
    const proposalLookup = maybeSingleByMatch({
      id: "proposal_1",
      page_id: "page_1",
      status: "proposed",
      proposal_json: {
        ...proposal,
        blocks: [
          {
            ...proposal.blocks[0],
            warnings: [
              {
                code: "unsupported_claim",
                message: "Claim needs source.",
                blockId: "block_ai",
              },
            ],
          },
        ],
      },
    });
    const client = buildClient(proposalLookup.table);

    await expect(
      adminAcceptAiProposalBlocks("page_1", "proposal_1", ["block_ai"], {
        client,
      }),
    ).rejects.toBeInstanceOf(AiProposalValidationError);
  });

  it("inserts only admin-accepted, source-backed blocks into the draft", async () => {
    const proposalLookup = maybeSingleByMatch({
      id: "proposal_1",
      page_id: "page_1",
      status: "proposed",
      proposal_json: proposal,
    });
    const pageLookup = singleByEq({
      id: "page_1",
      slug: "start-vending",
      title: "Start Vending",
      target_keyword: "start vending",
      seo_title: "Start Vending",
      meta_description: "Meta",
      draft_content: { version: 1, sections: [] },
    });
    const insertRevision = insertSingle({ id: "revision_1" });
    const updatePage = updateSingle({ id: "page_1" });
    const updateProposal = updateSingle({
      id: "proposal_1",
      status: "accepted",
    });
    const client = buildClient(
      proposalLookup.table,
      pageLookup.table,
      insertRevision.table,
      updatePage.table,
      updateProposal.table,
    );

    await adminAcceptAiProposalBlocks("page_1", "proposal_1", ["block_ai"], {
      client,
      actorId: "admin_1",
      now: () => new Date("2026-05-06T01:00:00.000Z"),
    });

    expect(insertRevision.mocks.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        revision_type: "ai_insert",
        created_by: "admin_1",
      }),
    );
    expect(
      updatePage.mocks.update.mock.calls[0]?.[0].draft_content.sections[0]
        .columns[0].blocks,
    ).toHaveLength(1);
    expect(updateProposal.mocks.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "accepted",
        accepted_block_ids: ["block_ai"],
        accepted_by: "admin_1",
      }),
    );
  });
});
