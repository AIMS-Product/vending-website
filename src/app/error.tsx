"use client";

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { ERROR_PAGE_LINKS } from "@/lib/content/error-links";

// Route-level render errors land here, inside the root layout. Built on the
// same layout as not-found.tsx (DESIGN.md public system) so a 500 still looks
// like Vendingpreneurs, and it always offers a way out.
export default function Error({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    // The root layout's boundary never reaches global-error.tsx, so report
    // here or route render errors are invisible in Sentry.
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <section className="flex h-full items-center bg-[#eaf6ff] px-5 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto w-full max-w-[720px] text-center">
        <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          Error
        </p>
        <h1 className="mt-4 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05] font-black text-[#111111] uppercase">
          Something went wrong
        </h1>
        <p className="mx-auto mt-5 max-w-[46ch] text-lg leading-relaxed font-semibold text-slate-700">
          An unexpected error occurred. Please try again.
        </p>
        {error.digest && (
          <p className="mt-3 text-sm text-slate-600">
            Reference: {error.digest}
          </p>
        )}
        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <Button onClick={() => unstable_retry()}>Try again</Button>
          <Button href="/" variant="ghost">
            Back to home
          </Button>
        </div>
        <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-black tracking-[0.04em] uppercase">
          {ERROR_PAGE_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="text-[#066a99] underline decoration-2 underline-offset-4 hover:text-[#111111]"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
