import { z } from "zod";
import { pageBlockSchema } from "@/lib/page-builder/blocks";
import { META_DESCRIPTION_MAX_LENGTH } from "@/lib/page-builder/copy-standards";

const aiProposalWarningSchema = z
  .object({
    code: z.enum(["unsupported_claim", "needs_source", "schema_warning"]),
    message: z.string().trim().min(1).max(500),
    blockId: z.string().trim().optional(),
  })
  .strict();

const aiProposedBlockSchema = z
  .object({
    block: pageBlockSchema,
    sourceDocumentIds: z.array(z.uuid()).default([]),
    sourceExcerptIds: z.array(z.uuid()).default([]),
    approvedClaimIds: z.array(z.uuid()).default([]),
    warnings: z.array(aiProposalWarningSchema).default([]),
  })
  .strict();

const aiPageProposalSchema = z
  .object({
    version: z.literal(1),
    metadata: z
      .object({
        title: z.string().trim().max(180).optional(),
        seoTitle: z.string().trim().max(80).optional(),
        metaDescription: z
          .string()
          .trim()
          .max(META_DESCRIPTION_MAX_LENGTH)
          .optional(),
        suggestedSlug: z.string().trim().max(120).optional(),
      })
      .strict()
      .default({}),
    blocks: z.array(aiProposedBlockSchema).max(40),
    warnings: z.array(aiProposalWarningSchema).default([]),
  })
  .strict();

export type AiPageProposal = z.infer<typeof aiPageProposalSchema>;
export type AiProposedBlock = z.infer<typeof aiProposedBlockSchema>;

export function validateAiPageProposal(input: unknown) {
  return aiPageProposalSchema.safeParse(input);
}

export function proposedBlockHasSourceSupport(block: AiProposedBlock) {
  return (
    block.sourceDocumentIds.length > 0 ||
    block.sourceExcerptIds.length > 0 ||
    block.approvedClaimIds.length > 0
  );
}

export function proposedBlockHasUnsupportedWarnings(block: AiProposedBlock) {
  return block.warnings.some(
    (warning) =>
      warning.code === "unsupported_claim" || warning.code === "needs_source",
  );
}
