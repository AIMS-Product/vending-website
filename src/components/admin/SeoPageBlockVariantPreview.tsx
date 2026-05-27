import type { PageBlock } from "@/lib/page-builder/blocks";
import { getBlockPreviewCase } from "@/lib/page-builder/block-preview-cases";
import type { BlockVariant } from "@/lib/page-builder/block-options";
import { ResourcePageBlockPreview } from "@/components/sections/ResourcePageContent";

const PREVIEW_REFERENCE_WIDTH_PX = 1024;
const PREVIEW_SCALE = 0.34;

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
    <span className="block h-full w-full overflow-hidden rounded-md bg-[#f5fbff] text-left ring-1 ring-[#d8effb]">
      <span
        className="block origin-top-left"
        style={{
          width: PREVIEW_REFERENCE_WIDTH_PX,
          transform: `scale(${PREVIEW_SCALE})`,
          transformOrigin: "top left",
        }}
      >
        <span className="block bg-[#f5fbff]">
          <span className="mx-auto block max-w-5xl px-5 py-8 lg:px-10">
            <ResourcePageBlockPreview block={previewCase.block} />
          </span>
        </span>
      </span>
    </span>
  );
}
