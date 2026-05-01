import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost";

type CommonProps = {
  variant?: Variant;
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

export function Button(props: LinkProps | ButtonProps) {
  const { variant = "primary", className, children, showArrow = true } = props;

  const base =
    "group inline-flex items-center gap-3 rounded-full px-6 py-3 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2";

  const styles: Record<Variant, string> = {
    primary:
      "bg-white text-brand-600 shadow ring-1 ring-brand-100 hover:shadow-md hover:ring-brand-200",
    ghost: "text-brand-600 hover:bg-white/60",
  };

  const inner = (
    <>
      <span>{children}</span>
      {showArrow && <Arrow />}
    </>
  );

  const classes = cn(base, styles[variant], className);

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
      className="bg-brand-400 group-hover:bg-brand-500 inline-flex size-7 items-center justify-center rounded-full text-white transition group-hover:translate-x-0.5"
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
