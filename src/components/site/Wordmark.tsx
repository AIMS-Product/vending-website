import Image from "next/image";
import { cn } from "@/lib/utils";

type WordmarkProps = {
  className?: string;
  /** Override the default height. Width scales automatically. */
  height?: number;
  /** Prioritize only for the above-the-fold public header instance. */
  eager?: boolean;
};

/**
 * The official Vendingpreneurs wordmark — V mark + "Vendingpreneurs" text.
 * Sourced from the live Webflow asset.
 */
export function Wordmark({
  className,
  height = 36,
  eager = false,
}: WordmarkProps) {
  const width = Math.round((909 / 274) * height);
  return (
    <Image
      src="/brand/wordmark.png"
      alt="Vendingpreneurs"
      width={width}
      height={height}
      loading={eager ? "eager" : undefined}
      fetchPriority={eager ? "high" : undefined}
      className={cn("block", className)}
      style={{ width, height }}
    />
  );
}
