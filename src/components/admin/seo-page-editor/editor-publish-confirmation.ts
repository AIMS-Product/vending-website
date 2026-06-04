import { pagePathForSlug } from "@/lib/page-builder/page-paths";

export function editorPublishConfirmMessage({
  isPublishedPage,
  routePrefix,
  visibleSlug,
}: {
  isPublishedPage: boolean;
  routePrefix: string;
  visibleSlug: string;
}) {
  const publicPath = visibleSlug
    ? pagePathForSlug(visibleSlug, routePrefix)
    : "the public site";
  const action = isPublishedPage
    ? "replace the current live version"
    : "make this draft visible";

  return `Publish this page?\n\nThis will ${action} at ${publicPath}.`;
}
