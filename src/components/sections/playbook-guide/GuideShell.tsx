import { Wordmark } from "@/components/site/Wordmark";
import { anton } from "@/app/fonts";

interface GuideShellProps {
  children: React.ReactNode;
  /** Small right-side header note, e.g. "Secure checkout". */
  note?: string;
}

/** Header + tinted canvas shared by the checkout, thank-you and access pages. */
export function GuideShell({ children, note }: GuideShellProps) {
  return (
    <div className={`${anton.variable} bg-brand-50 min-h-screen`}>
      <header className="border-ink border-b-2 bg-white">
        <div className="mx-auto flex max-w-[1180px] items-center justify-between px-5 py-4 lg:px-10">
          <Wordmark height={34} eager />
          {note ? (
            <p className="text-ink/70 text-xs font-black tracking-[0.1em] uppercase">
              {note}
            </p>
          ) : null}
        </div>
      </header>
      {/* The root layout already renders <main>; a second one breaks landmarks. */}
      <div className="mx-auto max-w-[760px] px-5 py-12 lg:py-16">
        {children}
      </div>
    </div>
  );
}

/** White bordered card with the brand's hard shadow. */
export function GuideCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-ink border-2 bg-white p-6 shadow-[8px_8px_0_#111111] sm:p-10">
      {children}
    </div>
  );
}
