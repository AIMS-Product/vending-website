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
    <section className="flex min-h-[60vh] flex-col items-center justify-center gap-6 bg-[#f5fbff] px-5 py-32 text-center">
      <p className="inline-flex rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-sm font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
        Coming soon
      </p>
      <h1 className="max-w-3xl text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
        {title}
      </h1>
      {body && (
        <p className="max-w-md text-lg leading-8 font-semibold text-slate-700">
          {body}
        </p>
      )}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button href="/">Back to home</Button>
      </div>
    </section>
  );
}
