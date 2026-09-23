import { cn } from "@/lib/utils";
import { Container, type ContainerWidth } from "./Container";

// Section rhythm: 96px desktop / 64px phone by default, 64 / 48 for follow-on
// bands (logo strips, CTA bands). Tone sets the ground, never the content.
const TONES = {
  white: "bg-white text-ink",
  tint: "bg-brand-50 text-ink",
  ink: "bg-ink text-white",
} as const;

const SIZES = {
  default: "py-16 lg:py-24",
  tight: "py-12 lg:py-16",
} as const;

export function Section({
  tone = "white",
  size = "default",
  width = "page",
  id,
  className,
  innerClassName,
  children,
}: {
  tone?: keyof typeof TONES;
  size?: keyof typeof SIZES;
  width?: ContainerWidth;
  id?: string;
  className?: string;
  innerClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={cn(TONES[tone], SIZES[size], className)}>
      <Container width={width} className={innerClassName}>
        {children}
      </Container>
    </section>
  );
}
