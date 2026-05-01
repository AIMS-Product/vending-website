import Image from "next/image";
import Link from "next/link";
import type { NewsPost } from "@/lib/services/news";

type NewsArticleProps = {
  post: Pick<
    NewsPost,
    "title" | "excerpt" | "cover_url" | "cover_alt" | "author" | "published_at"
  >;
  /** Sanitised HTML rendered from the markdown body. */
  html: string;
};

export function NewsArticle({ post, html }: NewsArticleProps) {
  return (
    <article className="mx-auto max-w-[820px] px-6 pt-32 pb-16 lg:pt-40 lg:pb-20">
      <Link
        href="/news"
        className="text-brand-500 hover:text-brand-600 inline-flex items-center gap-1 text-sm font-medium"
      >
        <span aria-hidden>←</span> Back to News
      </Link>

      <header className="mt-8">
        <h1 className="text-brand-500 text-4xl font-semibold tracking-tight sm:text-5xl">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-5 text-lg text-slate-600">{post.excerpt}</p>
        )}
        <Byline post={post} />
      </header>

      {post.cover_url && (
        <div className="bg-brand-50 relative mt-10 aspect-[16/9] w-full overflow-hidden rounded-3xl shadow-sm">
          <Image
            src={post.cover_url}
            alt={post.cover_alt ?? post.title}
            fill
            sizes="(max-width: 820px) 100vw, 820px"
            priority
            className="object-cover"
          />
        </div>
      )}

      <div
        className="news-prose mt-10"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </article>
  );
}

function Byline({ post }: { post: NewsArticleProps["post"] }) {
  const parts: string[] = [];
  if (post.author) parts.push(post.author);
  if (post.published_at) {
    parts.push(
      new Date(post.published_at).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  }
  if (parts.length === 0) return null;
  return <p className="mt-6 text-sm text-slate-500">{parts.join(" · ")}</p>;
}
