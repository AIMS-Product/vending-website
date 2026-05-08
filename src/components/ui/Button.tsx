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
  const { variant = "primary", className, children, showArrow = false } = props;

  const base =
    "group inline-flex min-h-12 items-center justify-center gap-3 rounded-[8px] border-2 border-[#111111] px-6 py-3 text-sm font-black uppercase text-[#111111] shadow-[5px_5px_0_#111111] transition hover:-translate-y-0.5 hover:shadow-[7px_7px_0_#111111] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55b8e8] focus-visible:ring-offset-2 active:translate-y-0 active:shadow-[3px_3px_0_#111111]";

  const styles: Record<Variant, string> = {
    primary: "bg-[#f47b3b]",
    ghost: "bg-white hover:bg-[#eaf8ff]",
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
