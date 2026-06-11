"use client";

import { useState } from "react";
import {
  adminLabelClass,
  adminSecondaryButtonClass,
} from "@/components/admin/AdminUi";
import {
  MediaLibrarySelectButton,
  MediaPickerProvider,
  useMediaPicker,
} from "@/components/admin/MediaPickerProvider";
import type { EditorMediaAsset } from "@/lib/media/editor-asset";

type ProofItemMediaFieldProps = {
  assets: EditorMediaAsset[];
};

export function ProofItemMediaField({ assets }: ProofItemMediaFieldProps) {
  return (
    <MediaPickerProvider initialAssets={assets}>
      <ProofItemMediaFieldInner />
    </MediaPickerProvider>
  );
}

function ProofItemMediaFieldInner() {
  const { openMediaPicker } = useMediaPicker();
  const [asset, setAsset] = useState<EditorMediaAsset | null>(null);

  return (
    <div>
      <span className={adminLabelClass}>Proof image (optional)</span>
      <input type="hidden" name="assetId" value={asset?.id ?? ""} />
      <p className="mt-1 text-xs text-slate-500">
        {asset ? asset.title : "No asset selected"}
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <MediaLibrarySelectButton
          label="Choose from library"
          onClick={() =>
            openMediaPicker({
              allowedTypes: ["image"],
              onSelect: setAsset,
            })
          }
        />
        {asset && (
          <button
            type="button"
            className={adminSecondaryButtonClass}
            onClick={() => setAsset(null)}
          >
            Clear image
          </button>
        )}
      </div>
    </div>
  );
}
