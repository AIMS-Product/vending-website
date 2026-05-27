import type { PageBlock } from "@/lib/page-builder/blocks";
import { getBlockPreviewCase } from "@/lib/page-builder/block-preview-cases";
import type { BlockVariant } from "@/lib/page-builder/block-options";
import { ResourcePageContentView } from "@/components/sections/ResourcePageContent";

export function BlockVariantPreviewSkeleton({
  type,
  variant,
}: {
  type: PageBlock["type"];
  variant: BlockVariant;
}) {
  const previewCase = getBlockPreviewCase(type, variant);

  if (!previewCase) {
    return null;
  }

  return (
    <span className="block h-full overflow-hidden rounded-md bg-[#f5fbff] text-left ring-1 ring-[#d8effb]">
      <span className="block h-[430px] w-[275%] origin-top-left scale-[0.36] px-6 py-5">
        <ResourcePageContentView
          content={previewCase.content}
          renderMode="public"
          linkMode="disabled"
        />
      </span>
    </span>
  );
}
