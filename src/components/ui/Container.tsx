import { cn } from "@/lib/utils";

// One left edge per page. page = grids and heroes, article = long-form copy,
// narrow = single forms, thank-you pages, auth.
const WIDTHS = {
  page: "max-w-page",
  article: "max-w-article",
  narrow: "max-w-narrow",
} as const;

export type ContainerWidth = keyof typeof WIDTHS;

export function Container({
  width = "page",
  className,
  children,
}: {
  width?: ContainerWidth;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("mx-auto w-full px-5 lg:px-10", WIDTHS[width], className)}
    >
      {children}
    </div>
  );
}
