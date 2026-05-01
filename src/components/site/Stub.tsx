import { Button } from "@/components/ui/Button";

type StubProps = {
  title: string;
  body?: string;
};

/**
 * Placeholder for routes whose content is built in a later slice.
 * Renders a polite "coming soon" message with a way back to home and
 * a CTA so the page is not a dead end.
 */
export function Stub({ title, body }: StubProps) {
  return (
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-6 py-32 text-center">
      <p className="text-brand-400 text-sm font-medium tracking-wide uppercase">
        Coming soon
      </p>
      <h1 className="text-brand-500 text-4xl font-semibold tracking-tight sm:text-5xl">
        {title}
      </h1>
      {body && <p className="max-w-md text-slate-600">{body}</p>}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button href="/">Back to home</Button>
      </div>
    </section>
  );
}
