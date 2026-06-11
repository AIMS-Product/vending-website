import { describe, expect, it } from "vitest";
import type { PageBlock } from "@/lib/page-builder/blocks";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import { applyMediaAssetToProofBlock } from "./editor-media";

type ProofBlock = Extract<PageBlock, { type: "proof" }>;

const proofBlock: ProofBlock = {
  id: "block_proof",
  type: "proof",
  variant: "quote",
  props: {
    eyebrow: "Proof",
    body: "The support helped me launch.",
    name: "Operator",
    context: "Student",
  },
};

const asset: EditorMediaAsset = {
  id: "33333333-3333-4333-8333-333333333333",
  title: "Operator portrait",
  altText: "Operator restocking a vending machine",
  caption: null,
  sourceRightsNotes: "Owned campaign image.",
  publicUrl: "/images/proof-operator.webp",
  assetType: "image",
};

describe("applyMediaAssetToProofBlock", () => {
  it("maps the asset id, source, and alt text onto the proof block", () => {
    const next = applyMediaAssetToProofBlock(proofBlock, asset);

    expect(next.props.assetId).toBe(asset.id);
    expect(next.props.mediaSrc).toBe(asset.publicUrl);
    expect(next.props.mediaAltText).toBe(asset.altText);
  });

  it("preserves the existing proof copy and block identity", () => {
    const next = applyMediaAssetToProofBlock(proofBlock, asset);

    expect(next.id).toBe(proofBlock.id);
    expect(next.variant).toBe(proofBlock.variant);
    expect(next.props.eyebrow).toBe("Proof");
    expect(next.props.body).toBe("The support helped me launch.");
    expect(next.props.name).toBe("Operator");
    expect(next.props.context).toBe("Student");
    expect(proofBlock.props).not.toHaveProperty("assetId");
  });
});
