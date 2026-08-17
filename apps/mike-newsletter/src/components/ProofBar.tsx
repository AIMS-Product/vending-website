import Image from "next/image";
import { proof } from "@/lib/content";

export function ProofBar() {
  return (
    <section className="border-b border-rule bg-paper-deep">
      <div className="mx-auto w-full max-w-6xl px-6 py-8 sm:px-8">
        <p className="eyebrow text-center text-ink-subtle">{proof.heading}</p>
        {/* Two across on a phone: at three, the wordmark logos shrink to the
            point where they stop being evidence of anything. */}
        <ul className="mt-6 grid grid-cols-2 items-center gap-x-6 gap-y-6 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-5">
          {proof.logos.map((logo) => (
            <li key={logo.name} className="flex h-12 items-center justify-center">
              <Image
                src={logo.src}
                alt={logo.name}
                width={200}
                height={64}
                className="max-h-11 w-auto max-w-full object-contain opacity-70 grayscale"
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
