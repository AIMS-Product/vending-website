import Link from "next/link";
import { footerColumns } from "@/lib/content/nav";
import { Wordmark } from "./Wordmark";

const LEGAL_HREFS = new Set(["/terms", "/privacy", "/spam-policy"]);

// The legal links from the site footer, and nothing else: the paid-traffic
// legacy lead pages drop the full footer (every link in it is an exit), but
// Terms and Privacy stay reachable. Labels and hrefs are read from the site
// footer's own list so the two can never disagree.
const LEGAL_LINKS = footerColumns
  .flatMap((column) => column.items)
  .filter((item) => LEGAL_HREFS.has(item.href));

export function LegalFooter() {
  return (
    <footer className="border-t-2 border-[#111111] bg-[#f5fbff] pt-8 pb-24 sm:pb-8">
      {/* pb-24 on a phone: the chat launcher is fixed bottom-right and would
          sit on the last link once the page is scrolled to the end. */}
      <div className="mx-auto flex max-w-[1180px] flex-col items-center gap-5 px-5 sm:flex-row sm:justify-between lg:px-10">
        <Wordmark />
        <nav aria-label="Legal">
          <ul className="flex flex-wrap justify-center gap-x-6 gap-y-1">
            {LEGAL_LINKS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block py-2 text-sm font-black text-[#066a99] uppercase transition hover:text-[#111111] focus-visible:rounded-[6px] focus-visible:ring-2 focus-visible:ring-[#066a99] focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
}
