import Image from "next/image";
import { cn } from "@/lib/utils";

type WordmarkProps = {
  className?: string;
  /** Override the default height. Width scales automatically. */
  height?: number;
};

/**
 * The official Vendingpreneurs wordmark — V mark + "Vendingpreneurs" text.
 * Sourced from the live Webflow asset.
 */
export function Wordmark({ className, height = 36 }: WordmarkProps) {
  return (
    <Image
      src="/brand/wordmark.png"
      alt="Vendingpreneurs"
      width={Math.round((909 / 274) * height)}
      height={height}
      priority
      className={cn("h-auto w-auto", className)}
    />
  );
}
