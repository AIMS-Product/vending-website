import Image from "next/image";
import Link from "next/link";
import type { NewsPost } from "@/lib/services/news";
import { siteUrl } from "@/lib/site";

type NewsArticleProps = {
  post: Pick<
    NewsPost,
    "slug" | "title" | "excerpt" | "cover_url" | "cover_alt" | "published_at"
  >;
  /** Sanitised HTML rendered from the markdown body. */
  html: string;
};

export function NewsArticle({ post, html }: NewsArticleProps) {
  const headings = extractArticleHeadings(html);
  const readingTime = getReadingTime(html);
  const articleUrl = new URL(`/news/${post.slug}`, siteUrl).toString();
  const category = getCategoryLabel(post.title);

  return (
    <div className="bg-[#f5fbff] px-5 pt-28 pb-20 lg:px-10 lg:pt-32">
      <div className="mx-auto grid max-w-[1500px] gap-12 xl:grid-cols-[64px_minmax(0,920px)_360px] xl:gap-14">
        <ShareRail title={post.title} url={articleUrl} />

        <article className="min-w-0">
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/"
              className="text-sm font-black text-[#066a99] uppercase transition hover:text-[#2d9fd6]"
            >
              Home
            </Link>
            <span aria-hidden className="font-black text-[#066a99]">
              /
            </span>
            <Link
              href="/news"
              className="text-sm font-black text-[#066a99] uppercase transition hover:text-[#2d9fd6]"
            >
              News
            </Link>
            <span className="rounded-[8px] border-2 border-[#55b8e8] bg-[#111111] px-4 py-2 text-xs font-black text-white uppercase shadow-[4px_4px_0_#55b8e8]">
              {category}
            </span>
          </div>

          <header className="mt-10">
            <h1 className="max-w-[900px] text-[clamp(2.75rem,6vw,5.4rem)] leading-[0.96] font-black break-words text-[#111111] uppercase">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mt-6 max-w-3xl text-xl leading-8 font-semibold text-slate-700">
                {post.excerpt}
              </p>
            )}
            <Byline publishedAt={post.published_at} readingTime={readingTime} />
          </header>

          {post.cover_url && (
            <div className="relative mt-12 aspect-[16/9] w-full overflow-hidden rounded-[8px] border-2 border-[#111111] bg-white shadow-[8px_8px_0_#55b8e8]">
              <Image
                src={post.cover_url}
                alt={post.cover_alt ?? post.title}
                fill
                sizes="(max-width: 1024px) 100vw, 920px"
                priority
                className="object-cover"
              />
            </div>
          )}

          <div
            className="public-news-prose mt-14"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </article>

        <ArticleSidebar headings={headings} />
      </div>
    </div>
  );
}

function Byline({
  publishedAt,
  readingTime,
}: {
  publishedAt: string | null;
  readingTime: number;
}) {
  const parts: string[] = [];
  if (publishedAt) {
    parts.push(
      new Date(publishedAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }
  parts.push(`${readingTime} min read`);
  return (
    <div className="mt-12 border-y-2 border-[#bfeeff] py-6">
      <div className="flex flex-wrap items-center gap-5 text-[#066a99]">
        {parts.map((part) => (
          <span key={part} className="flex items-center gap-5 text-lg">
            <span aria-hidden className="size-1.5 rounded-full bg-[#55b8e8]" />
            <span className="font-semibold">{part}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ShareRail({ title, url }: { title: string; url: string }) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);
  const links = [
    {
      label: "Share on X",
      text: "X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
    },
    {
      label: "Share on LinkedIn",
      text: "in",
      href: `https://www.linkedin.com/shareArticle?mini=true&url=${encodedUrl}&title=${encodedTitle}`,
    },
    {
      label: "Share on Facebook",
      text: "f",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      label: "Open article link",
      text: "link",
      href: url,
    },
  ];

  return (
    <aside className="hidden xl:block" aria-label="Share this article">
      <div className="sticky top-32 flex flex-col items-center gap-5">
        {links.slice(0, 3).map((link) => (
          <a
            key={link.label}
            href={link.href}
            aria-label={link.label}
            target="_blank"
            rel="noopener noreferrer"
            className="flex size-12 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-white text-base font-black text-[#111111] shadow-[4px_4px_0_#111111] transition hover:-translate-y-0.5 hover:bg-[#eaf8ff]"
          >
            {link.text}
          </a>
        ))}
        <span className="my-2 h-px w-12 bg-[#55b8e8]" aria-hidden />
        <a
          href={links[3].href}
          aria-label={links[3].label}
          className="flex size-12 items-center justify-center rounded-[8px] border-2 border-[#111111] bg-white text-base font-black text-[#111111] shadow-[4px_4px_0_#111111] transition hover:-translate-y-0.5 hover:bg-[#eaf8ff]"
        >
          {links[3].text}
        </a>
      </div>
    </aside>
  );
}

function ArticleSidebar({ headings }: { headings: string[] }) {
  const items = headings.length
    ? headings.slice(0, 6)
    : [
        "Route selection",
        "Machine economics",
        "Launch checklist",
        "Scaling next steps",
      ];

  return (
    <aside className="hidden lg:block">
      <div className="sticky top-32 space-y-10">
        <section className="rounded-[12px] border-2 border-[#111111] bg-white p-7 shadow-[7px_7px_0_#111111]">
          <p className="inline-flex rounded-[5px] border border-[#9fe6ff] bg-[#d6f4ff] px-3 py-2 text-xs font-black text-[#111111] uppercase">
            In this article
          </p>
          <ol className="mt-6 space-y-4 text-lg font-semibold text-[#066a99]">
            {items.map((heading, index) => (
              <li key={`${heading}-${index}`} className="flex gap-3">
                <span>{index + 1}.</span>
                <span>{heading}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="rounded-[12px] border-2 border-[#111111] bg-[#111111] p-8 text-white shadow-[7px_7px_0_#55b8e8]">
          <h2 className="text-3xl leading-tight font-black uppercase">
            Build your route today.
          </h2>
          <p className="mt-5 text-lg leading-7 font-semibold text-white">
            Get the complete A-Z blueprint to passive income.
          </p>
          <Link
            href="/contact"
            className="mt-8 inline-flex min-h-14 w-full items-center justify-center rounded-[8px] bg-[#f47b3b] px-6 text-sm font-black text-[#111111] uppercase transition hover:-translate-y-0.5"
          >
            Step inside
          </Link>
        </section>
      </div>
    </aside>
  );
}

function extractArticleHeadings(html: string): string[] {
  return [...html.matchAll(/<h2(?:\s[^>]*)?>(.*?)<\/h2>/gi)].flatMap(
    (match) => {
      const heading = decodeHtmlEntities(stripTags(match[1]).trim());
      return heading ? [heading] : [];
    },
  );
}

function getReadingTime(html: string): number {
  const words = stripTags(html).trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 220));
}

function getCategoryLabel(title: string): string {
  const lower = title.toLowerCase();
  if (lower.includes("location")) return "Location Scouting";
  if (lower.includes("machine")) return "Machine Selection";
  if (lower.includes("finance") || lower.includes("cost")) return "Finance";
  if (lower.includes("product")) return "Product Mix";
  return "Vending Strategy";
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, " ");
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}
