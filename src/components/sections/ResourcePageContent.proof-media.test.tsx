import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PageBlock } from "@/lib/page-builder/blocks";
import { ResourcePageBlockPreview } from "./ResourcePageContent";

type ProofBlock = Extract<PageBlock, { type: "proof" }>;

const PROOF_VARIANTS: ProofBlock["variant"][] = ["quote", "stat", "logo"];

function buildProofBlock(
  variant: ProofBlock["variant"],
  media?: Pick<ProofBlock["props"], "assetId" | "mediaSrc" | "mediaAltText">,
): ProofBlock {
  return {
    id: "test-proof",
    type: "proof",
    variant,
    props: {
      eyebrow: "Proof",
      body: "The support helped me launch.",
      name: "Operator",
      context: "Student",
      ...media,
    },
  };
}

function renderBlock(block: ProofBlock) {
  return renderToStaticMarkup(<ResourcePageBlockPreview block={block} />);
}

describe("proof block media rendering", () => {
  for (const variant of PROOF_VARIANTS) {
    it(`renders the selected image with alt text on the ${variant} variant`, () => {
      const html = renderBlock(
        buildProofBlock(variant, {
          assetId: "33333333-3333-4333-8333-333333333333",
          mediaSrc: "/images/proof-operator.webp",
          mediaAltText: "Operator restocking a vending machine",
        }),
      );

      expect(html).toContain("<img");
      expect(html).toContain('alt="Operator restocking a vending machine"');
      expect(html).toMatch(/width="\d+"/);
      expect(html).toMatch(/height="\d+"/);
    });

    it(`renders no image on the ${variant} variant when no media is set`, () => {
      const html = renderBlock(buildProofBlock(variant));

      expect(html).not.toContain("<img");
    });

    it(`keeps legacy ${variant} markup identical when media props are empty strings`, () => {
      const legacyHtml = renderBlock(buildProofBlock(variant));
      const emptyMediaHtml = renderBlock(
        buildProofBlock(variant, { mediaSrc: "", mediaAltText: "" }),
      );

      expect(emptyMediaHtml).toBe(legacyHtml);
    });
  }
});
