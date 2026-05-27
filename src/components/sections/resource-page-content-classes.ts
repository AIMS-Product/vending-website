import type { PageSection } from "@/lib/page-builder/blocks";

export function resourceSectionClass(
  background: PageSection["background"],
  spacing: PageSection["spacing"],
) {
  const backgroundClass =
    background === "muted"
      ? "rounded-[12px] border-2 border-[#111111] bg-white p-6 shadow-[7px_7px_0_#55b8e8]"
      : background === "brand"
        ? "rounded-[12px] border-2 border-[#111111] bg-[#eaf8ff] p-6 shadow-[7px_7px_0_#111111]"
        : "";
  const spacingClass =
    spacing === "compact" ? "py-6" : spacing === "spacious" ? "py-12" : "py-8";
  return `${backgroundClass} ${spacingClass}`;
}

export function resourceColumnGridClass(count: number) {
  if (count <= 1) return "grid gap-8";
  return "grid gap-8 md:grid-cols-2";
}
