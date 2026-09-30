import { Button } from "@/components/ui/Button";

interface PlaybookCtaProps {
  href: string;
  label: string;
  className?: string;
}

/** Every buy button on /playbook: one link to the GHL order form. */
export function PlaybookCta({ href, label, className }: PlaybookCtaProps) {
  return (
    <Button href={href} size="lg" showArrow className={className}>
      {label}
    </Button>
  );
}

interface PlaybookCtaBandProps {
  href: string;
  label: string;
}

export function PlaybookCtaBand({ href, label }: PlaybookCtaBandProps) {
  return (
    <div className="mt-10 flex justify-center">
      <PlaybookCta href={href} label={label} />
    </div>
  );
}

export const H2 =
  "text-ink text-[clamp(1.8rem,3.6vw,2.8rem)] leading-[1.15] font-black uppercase";
export const EYEBROW =
  "text-eyebrow text-xs font-black tracking-[0.14em] uppercase";
