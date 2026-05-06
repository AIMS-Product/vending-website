import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  AiProposalValidationError,
  adminAcceptAiProposalBlocks,
  adminListAiPageProposals,
} from "./ai-page-proposals";
import type { Database } from "@/types/database";

type ProposalClient = Pick<SupabaseClient<Database>, "from" | "rpc">;

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

function listByPage(data: unknown, error: unknown = null) {
  const limit = vi.fn().mockResolvedValue({ data, error });
  const order = vi.fn().mockReturnValue({ limit });
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  return { table: { select }, mocks: { select, eq, order, limit } };
}

function buildClient(...tables: unknown[]) {
  return {
    from: vi.fn().mockImplementation(() => {
      const next = tables.shift();
      if (!next) throw new Error("Unexpected Supabase table call");
      return next;
    }),
    rpc: vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Unexpected Supabase RPC call" },
    }),
  } as unknown as ProposalClient & {
    from: ReturnType<typeof vi.fn>;
    rpc: ReturnType<typeof vi.fn>;
  };
}

describe("AI page proposals", () => {
  it("lists recent proposals with parsed source-bound proposal JSON", async () => {
    const list = listByPage([
      {
        id: "proposal_1",
        page_id: "page_1",
        status: "proposed",
        model: "gpt-5.5",
        prompt_version: "seo-source-bound-proposal-v1",
        selected_source_document_ids: [],
        selected_source_excerpt_ids: ["11111111-1111-4111-8111-111111111111"],
        selected_approved_claim_ids: [],
        proposal_json: proposal,
        warnings: [],
        accepted_block_ids: [],
        created_by: null,
        accepted_by: null,
        accepted_at: null,
        created_at: "2026-05-06T01:00:00.000Z",
        updated_at: "2026-05-06T01:00:00.000Z",
      },
    ]);
    const client = buildClient(list.table);

    const result = await adminListAiPageProposals("page_1", { client });

    expect(result).toEqual([
      expect.objectContaining({
        id: "proposal_1",
        status: "proposed",
        model: "gpt-5.5",
        promptVersion: "seo-source-bound-proposal-v1",
        selectedSourceExcerptIds: ["11111111-1111-4111-8111-111111111111"],
        proposal,
      }),
    ]);
    expect(list.mocks.eq).toHaveBeenCalledWith("page_id", "page_1");
    expect(list.mocks.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(list.mocks.limit).toHaveBeenCalledWith(5);
  });

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
    const rpcResult = {
      page: {
        id: "page_1",
        draft_content: {
          version: 1,
          sections: [
            {
              id: "section_1",
              preset: "standard",
              background: "default",
              spacing: "standard",
              columns: [
                {
                  id: "column_1",
                  width: "1/1",
                  blocks: [proposal.blocks[0]!.block],
                },
              ],
            },
          ],
        },
      },
      proposal: {
        id: "proposal_1",
        status: "accepted",
        accepted_block_ids: ["block_ai"],
        accepted_by: "admin_1",
      },
      revision: { id: "revision_1", revision_type: "ai_insert" },
    };
    const client = buildClient(proposalLookup.table, pageLookup.table);
    client.rpc.mockResolvedValue({
      data: rpcResult,
      error: null,
    });

    const result = await adminAcceptAiProposalBlocks(
      "page_1",
      "proposal_1",
      ["block_ai"],
      {
        client,
        actorId: "admin_1",
        now: () => new Date("2026-05-06T01:00:00.000Z"),
      },
    );

    expect(result).toEqual(rpcResult);
    expect(client.rpc).toHaveBeenCalledWith("accept_ai_proposal_blocks", {
      p_page_id: "page_1",
      p_proposal_id: "proposal_1",
      p_next_content: expect.objectContaining({ version: 1 }),
      p_seo_snapshot: {
        slug: "start-vending",
        title: "Start Vending",
        target_keyword: "start vending",
        seo_title: "Start Vending",
        meta_description: "Meta",
      },
      p_accepted_block_ids: ["block_ai"],
      p_actor_id: "admin_1",
      p_label: "AI insert 2026-05-06T01:00:00.000Z",
      p_accepted_at: "2026-05-06T01:00:00.000Z",
    });
  });

  it("rejects stale concurrent proposal acceptance attempts", async () => {
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
    const client = buildClient(proposalLookup.table, pageLookup.table);
    client.rpc.mockResolvedValue({
      data: null,
      error: { message: "AI proposal is not available for insertion." },
    });

    await expect(
      adminAcceptAiProposalBlocks("page_1", "proposal_1", ["block_ai"], {
        client,
        actorId: "admin_1",
        now: () => new Date("2026-05-06T01:00:00.000Z"),
      }),
    ).rejects.toThrow("AI proposal is not available for insertion.");
  });
});
