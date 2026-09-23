import Link from "next/link";
import { cn } from "@/lib/utils";

// primary = brand-700 fill, ghost = white, onInk = white on a dark band (the
// ink border and ink shadow vanish on #111, so it takes the sky shadow).
type Variant = "primary" | "ghost" | "onInk";
// md 48px (nav, cards), lg 56px (hero, form submit, sticky bar).
type Size = "md" | "lg";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  className?: string;
  children: React.ReactNode;
  showArrow?: boolean;
};

type LinkProps = CommonProps & {
  href: string;
  type?: never;
  onClick?: never;
};

type ButtonProps = CommonProps & {
  href?: never;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
};

const BASE =
  "group inline-flex items-center justify-center gap-3 rounded-control border-2 border-ink text-sm font-black uppercase shadow-btn transition hover:-translate-y-0.5 hover:shadow-btn-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky focus-visible:ring-offset-2 active:translate-y-0 active:shadow-[3px_3px_0_#111111]";

const SIZES: Record<Size, string> = {
  md: "min-h-12 px-6 py-3",
  lg: "min-h-14 px-7 py-3.5",
};

// Primary is filled with brand-700 (darker step of the existing brand
// scale) rather than the accent brand-600 (#2a8fcc): white text on #2a8fcc
// is only 3.56:1, below WCAG AA. brand-700 clears 5.24:1.
const STYLES: Record<Variant, string> = {
  primary: "bg-brand-700 text-white",
  ghost: "bg-white text-ink hover:bg-tint",
  onInk:
    "border-white bg-white text-ink shadow-[5px_5px_0_#55b8e8] hover:bg-tint hover:shadow-[7px_7px_0_#55b8e8] active:shadow-[3px_3px_0_#55b8e8]",
};

/**
 * The button classes on their own, for the few CTAs that cannot be a
 * <Button>: a submit button carrying data-gtm and disabled state, a plain
 * same-page anchor, a class string a page-builder block hands around. Never
 * hand-roll a CTA class string; call this.
 */
export function buttonClass({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: Variant;
  size?: Size;
  className?: string;
} = {}) {
  return cn(BASE, SIZES[size], STYLES[variant], className);
}

export function Button(props: LinkProps | ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    className,
    children,
    showArrow = false,
  } = props;

  const inner = (
    <>
      <span>{children}</span>
      {showArrow && <Arrow />}
    </>
  );

  const classes = buttonClass({ variant, size, className });

  if ("href" in props && props.href) {
    return (
      <Link href={props.href} className={classes}>
        {inner}
      </Link>
    );
  }

  return (
    <button
      type={props.type ?? "button"}
      onClick={props.onClick}
      className={classes}
    >
      {inner}
    </button>
  );
}

function Arrow() {
  return (
    <span
      aria-hidden
      className="inline-flex size-7 items-center justify-center rounded-full bg-[#111111] text-white transition group-hover:translate-x-0.5"
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M3 8h10M9 4l4 4-4 4"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
