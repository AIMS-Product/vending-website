import { cn } from "@/lib/utils";

// Containers carry the sky shadow; only interactive things carry ink.
// ink = at most one per page (a featured quote). flat = rows inside a card,
// FAQ items: border only.
const VARIANTS = {
  default: "border-ink bg-white shadow-card",
  tint: "border-ink bg-tint shadow-card",
  ink: "border-ink bg-ink text-white shadow-card",
  flat: "border-ink bg-white",
} as const;

type CardTag = "div" | "li" | "article" | "figure" | "blockquote";

export function Card({
  as: Tag = "div",
  variant = "default",
  className,
  children,
}: {
  as?: CardTag;
  variant?: keyof typeof VARIANTS;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Tag
      className={cn(
        "rounded-card border-2 p-6 lg:p-7",
        VARIANTS[variant],
        className,
      )}
    >
      {children}
    </Tag>
  );
}
