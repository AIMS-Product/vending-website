import "server-only";

import { flattenBlocks } from "@/lib/page-builder/blocks";
import { resolveResourceQualificationAttachment } from "@/lib/page-builder/resource-lead-attribution";
import { resolvePublishedQualificationFormVersion } from "@/lib/services/qualification-forms";
import type { PageContent } from "@/lib/page-builder/blocks";

/**
 * Whether the phone field is required, keyed by qualification form id, for
 * every form this page could attach.
 *
 * The renderer decides which form a lead_form block uses inside a synchronous
 * render callback, so it cannot await the form version itself. Resolving the
 * policy up front — through the same attachment resolution the renderer uses,
 * so the two cannot drift — gives it a plain lookup.
 *
 * A form that fails to resolve is simply absent from the map, and the renderer
 * falls back to requiring phone. Failing closed here only ever asks a lead for
 * one more field; failing open would silently drop phone numbers the sales
 * team depends on.
 */
export async function resolvePhoneRequiredByFormId(
  content: PageContent | null | undefined,
  globalDefaultFormId?: string | null,
): Promise<Record<string, boolean>> {
  if (!content) return {};
  const formIds = new Set<string>();
  for (const block of flattenBlocks(content)) {
    if (block.type !== "lead_form") continue;
    const { formId } = resolveResourceQualificationAttachment({
      page: content,
      block,
      globalDefaultFormId,
    });
    if (formId) formIds.add(formId);
  }
  if (formIds.size === 0) return {};

  const resolved = await Promise.all(
    Array.from(formIds, async (formId) => {
      try {
        const version = await resolvePublishedQualificationFormVersion({
          formId,
        });
        if (!version) return null;
        return [formId, version.schema.contactPhoneRequired] as const;
      } catch {
        return null;
      }
    }),
  );

  return Object.fromEntries(resolved.filter((entry) => entry !== null));
}
