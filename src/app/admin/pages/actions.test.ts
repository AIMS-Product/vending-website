import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PageContent } from "@/lib/page-builder/blocks";
import {
  acceptAiSeoProposalBlocks,
  generateAiSeoPageProposal,
} from "./actions";
import { SeoAgentConfigurationError } from "@/lib/services/openai-seo-agent";
import { AiProposalValidationError } from "@/lib/services/ai-page-proposals";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
  redirect: vi.fn(),
  adminGenerateOpenAiSeoPageProposal: vi.fn(),
  adminAcceptAiProposalBlocks: vi.fn(),
}));

vi.mock("@/lib/supabase/auth", () => ({
  requireAdmin: mocks.requireAdmin,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mocks.revalidatePath,
}));

vi.mock("next/navigation", () => ({
  redirect: mocks.redirect,
}));

vi.mock("@/lib/services/openai-seo-agent", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/openai-seo-agent")
  >("@/lib/services/openai-seo-agent");
  return {
    ...actual,
    adminGenerateOpenAiSeoPageProposal:
      mocks.adminGenerateOpenAiSeoPageProposal,
  };
});

vi.mock("@/lib/services/ai-page-proposals", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/services/ai-page-proposals")
  >("@/lib/services/ai-page-proposals");
  return {
    ...actual,
    adminAcceptAiProposalBlocks: mocks.adminAcceptAiProposalBlocks,
  };
});

const pageId = "11111111-1111-4111-8111-111111111111";
const proposalId = "22222222-2222-4222-8222-222222222222";
const validContent: PageContent = {
  version: 1,
  sections: [],
};

describe("admin page actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({ user: { id: "admin_1" } });
  });

  it("maps missing page IDs without calling the AI proposal service", async () => {
    const result = await generateAiSeoPageProposal("");

    expect(result).toEqual({
      status: "error",
      message: "Save the page before running AI.",
    });
    expect(mocks.adminGenerateOpenAiSeoPageProposal).not.toHaveBeenCalled();
  });

  it("maps OpenAI configuration errors to a safe admin-facing message", async () => {
    mocks.adminGenerateOpenAiSeoPageProposal.mockRejectedValue(
      new SeoAgentConfigurationError("sk-secret is missing"),
    );

    const result = await generateAiSeoPageProposal(pageId);

    expect(result).toEqual({
      status: "error",
      message: "OpenAI is not configured for the SEO agent.",
    });
    expect(JSON.stringify(result)).not.toContain("sk-secret");
    expect(mocks.adminGenerateOpenAiSeoPageProposal).toHaveBeenCalledWith(
      pageId,
      { actorId: "admin_1" },
    );
  });

  it("rejects invalid proposal insert payloads before calling the service", async () => {
    const result = await acceptAiSeoProposalBlocks("not-a-uuid", proposalId, [
      "block_ai",
    ]);

    expect(result.status).toBe("error");
    expect(result.proposalId).toBe(proposalId);
    expect(result.message).toMatch(/Invalid UUID/);
    expect(mocks.adminAcceptAiProposalBlocks).not.toHaveBeenCalled();
  });

  it("returns inserted AI blocks with parsed draft content", async () => {
    mocks.adminAcceptAiProposalBlocks.mockResolvedValue({
      page: { draft_content: validContent },
    });

    const result = await acceptAiSeoProposalBlocks(pageId, proposalId, [
      "block_ai",
    ]);

    expect(result).toEqual({
      status: "inserted",
      message: "1 AI block inserted into the draft.",
      proposalId,
      insertedBlockIds: ["block_ai"],
      content: validContent,
    });
    expect(mocks.adminAcceptAiProposalBlocks).toHaveBeenCalledWith(
      pageId,
      proposalId,
      ["block_ai"],
      { actorId: "admin_1" },
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/pages/${pageId}`);
  });

  it("surfaces AI proposal validation errors without inserting blocks", async () => {
    mocks.adminAcceptAiProposalBlocks.mockRejectedValue(
      new AiProposalValidationError([
        {
          code: "missing_source",
          path: "blocks.0",
          message: "AI proposals can only use selected approved source data.",
        },
      ]),
    );

    const result = await acceptAiSeoProposalBlocks(pageId, proposalId, [
      "block_ai",
    ]);

    expect(result).toEqual({
      status: "error",
      proposalId,
      message: "AI proposals can only use selected approved source data.",
    });
  });
});
