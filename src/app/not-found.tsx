import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

// Through the root layout's "%s | Vendingpreneurs" template. Without it every
// 404 tab read just "Vendingpreneurs", like the home page.
export const metadata: Metadata = {
  title: "Page not found",
};

// Every 404 on the site lands here: notFound() in a route, and the proxy's
// real-404 rewrite to /_not-found. Set in the public system (DESIGN.md) so a
// dead link still looks like Vendingpreneurs.
const LINKS = [
  { href: "/case-studies", label: "Member stories" },
  { href: "/news", label: "News" },
  { href: "/about", label: "About the program" },
] as const;

export default function NotFound() {
  return (
    <section className="flex h-full items-center bg-[#eaf6ff] px-5 py-20 lg:px-10 lg:py-28">
      <div className="mx-auto w-full max-w-[720px] text-center">
        <p className="text-xs font-black tracking-[0.14em] text-[#066a99] uppercase">
          404
        </p>
        <h1 className="mt-4 text-[clamp(2.2rem,4.4vw,3.6rem)] leading-[1.05] font-black text-[#111111] uppercase">
          Page not found
        </h1>
        <p className="mx-auto mt-5 max-w-[46ch] text-lg leading-relaxed font-semibold text-slate-700">
          The page you&apos;re looking for doesn&apos;t exist or has moved.
        </p>
        <div className="mt-9 flex justify-center">
          <Button href="/" showArrow>
            Back to home
          </Button>
        </div>
        <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2 text-sm font-black tracking-[0.04em] uppercase">
          {LINKS.map((link) => (
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
