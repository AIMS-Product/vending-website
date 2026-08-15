import Image from "next/image";
import { proof } from "@/lib/content";

export function ProofBar() {
  return (
    <section className="border-b border-rule bg-paper-deep">
      <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-8">
        <p className="eyebrow text-center text-ink-subtle">{proof.heading}</p>
        <ul className="mt-7 grid grid-cols-2 items-center gap-x-8 gap-y-8 sm:grid-cols-3 lg:grid-cols-5">
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
