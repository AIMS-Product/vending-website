"use client";

import { useState } from "react";
import { adminCardClass } from "@/components/admin/AdminUi";
import { LibraryCard } from "./LibraryCard";
import { LibraryDrawer } from "./LibraryDrawer";
import {
  CtaPresetDrawerContent,
  ProofItemDrawerContent,
} from "./CtaAndProofDrawers";
import {
  ApprovedClaimDrawerContent,
  SourceDocumentDrawerContent,
  SourceExcerptDrawerContent,
} from "./SourceChainDrawers";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";
import type { PageBuilderLibraries } from "@/lib/services/page-builder-libraries";

// P1-7 / I10: default view is five compact summary cards (no always-open
// forms) plus a plain-English dependency cue. Each card opens a focused
// drawer containing that library's existing add form and item list. Only
// one drawer is open at a time.

type LibraryKey =
  | "ctaPresets"
  | "proofItems"
  | "sourceDocuments"
  | "sourceExcerpts"
  | "approvedClaims";

type LibrariesWorkspaceProps = {
  libraries: PageBuilderLibraries;
  editorMediaAssets: EditorMediaAsset[];
};

export function LibrariesWorkspace({
  libraries,
  editorMediaAssets,
}: LibrariesWorkspaceProps) {
  const [openDrawer, setOpenDrawer] = useState<LibraryKey | null>(null);
  const approvedExcerpts = libraries.sourceExcerpts.filter(
    (excerpt) => excerpt.approved,
  );

  return (
    <div className="grid gap-6">
      <DependencyCue />

      <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <LibraryCard
          icon="layers"
          name="CTA presets"
          purpose="Buttons and links you can reuse across pages, like Apply Now."
          itemCount={libraries.ctaPresets.length}
          itemNoun="reusable actions"
          addLabel="Add CTA preset"
          onOpen={() => setOpenDrawer("ctaPresets")}
        />
        <LibraryCard
          icon="check"
          name="Proof items"
          purpose="Testimonials, stats, and case studies that build trust."
          itemCount={libraries.proofItems.length}
          itemNoun="proof items"
          addLabel="Add proof item"
          onOpen={() => setOpenDrawer("proofItems")}
        />
        <LibraryCard
          icon="file"
          name="Source documents"
          purpose="Raw material you paste or upload before writing claims."
          itemCount={libraries.sourceDocuments.length}
          itemNoun="documents"
          addLabel="Add source document"
          onOpen={() => setOpenDrawer("sourceDocuments")}
        />
        <LibraryCard
          icon="book"
          name="Source excerpts"
          purpose="Short quotes pulled from a source document."
          itemCount={libraries.sourceExcerpts.length}
          itemNoun="excerpts"
          addLabel="Add source excerpt"
          onOpen={() => setOpenDrawer("sourceExcerpts")}
        />
        <LibraryCard
          icon="pencil"
          name="Approved claims"
          purpose="Statements you're allowed to publish, backed by an excerpt."
          itemCount={libraries.approvedClaims.length}
          itemNoun="approved claims"
          addLabel="Add approved claim"
          onOpen={() => setOpenDrawer("approvedClaims")}
        />
      </div>

      {openDrawer === "ctaPresets" && (
        <LibraryDrawer
          title="CTA presets"
          description="Independent library — safe to add anytime."
          onClose={() => setOpenDrawer(null)}
        >
          <CtaPresetDrawerContent items={libraries.ctaPresets} />
        </LibraryDrawer>
      )}

      {openDrawer === "proofItems" && (
        <LibraryDrawer
          title="Proof items"
          description="Independent library — safe to add anytime."
          onClose={() => setOpenDrawer(null)}
        >
          <ProofItemDrawerContent
            items={libraries.proofItems}
            editorMediaAssets={editorMediaAssets}
          />
        </LibraryDrawer>
      )}

      {openDrawer === "sourceDocuments" && (
        <LibraryDrawer
          title="Source documents"
          description="Step 1 of 3 — add these first."
          onClose={() => setOpenDrawer(null)}
        >
          <SourceDocumentDrawerContent items={libraries.sourceDocuments} />
        </LibraryDrawer>
      )}

      {openDrawer === "sourceExcerpts" && (
        <LibraryDrawer
          title="Source excerpts"
          description="Step 2 of 3 — quote an existing source document."
          onClose={() => setOpenDrawer(null)}
        >
          <SourceExcerptDrawerContent
            items={libraries.sourceExcerpts}
            sourceDocuments={libraries.sourceDocuments}
          />
        </LibraryDrawer>
      )}

      {openDrawer === "approvedClaims" && (
        <LibraryDrawer
          title="Approved claims"
          description="Step 3 of 3 — back a claim with an approved excerpt."
          onClose={() => setOpenDrawer(null)}
        >
          <ApprovedClaimDrawerContent
            items={libraries.approvedClaims}
            approvedExcerpts={approvedExcerpts}
          />
        </LibraryDrawer>
      )}
    </div>
  );
}

function DependencyCue() {
  return (
    <section
      className={`${adminCardClass} bg-[#f5f8ff] text-sm leading-6 text-slate-700`}
      aria-label="Library order guidance"
    >
      <p>
        <strong>Add source documents first</strong>; excerpts quote them, and
        approved claims are backed by excerpts. Source documents, source
        excerpts, and approved claims build on each other in that order.
      </p>
      <p className="mt-2 text-slate-500">
        CTA presets and proof items are independent — add them anytime.
      </p>
    </section>
  );
}
