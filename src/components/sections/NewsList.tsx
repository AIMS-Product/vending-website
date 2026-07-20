import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { ImageWithFallback } from "@/components/ui/ImageWithFallback";
import type { NewsPost } from "@/lib/services/news";

type NewsListProps = {
  posts: ReadonlyArray<
    Pick<
      NewsPost,
      | "id"
      | "slug"
      | "title"
      | "excerpt"
      | "cover_url"
      | "cover_alt"
      | "published_at"
    >
  >;
};

export function NewsList({ posts }: NewsListProps) {
  if (posts.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="bg-[#f5fbff] px-5 py-16 lg:px-10 lg:py-20">
      <ul className="mx-auto grid max-w-[1500px] gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <li key={post.id}>
            <NewsCard post={post} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function NewsCard({ post }: { post: NewsListProps["posts"][number] }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-[10px] border-2 border-[#111111] bg-white shadow-[7px_7px_0_#55b8e8] transition hover:-translate-y-1 hover:shadow-[10px_10px_0_#55b8e8]">
      <Link href={`/news/${post.slug}`} className="flex h-full flex-col">
        {post.cover_url ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden border-b-2 border-[#111111] bg-[#eaf8ff]">
            <ImageWithFallback
              src={post.cover_url}
              alt={post.cover_alt ?? post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : (
          <div className="aspect-[16/9] w-full border-b-2 border-[#111111] bg-[#55b8e8]" />
        )}
        <div className="flex flex-1 flex-col gap-4 p-6">
          <h2 className="text-2xl leading-tight font-black text-[#111111] uppercase transition-colors group-hover:text-[#2d9fd6]">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-base leading-7 font-semibold text-slate-700">
              {post.excerpt}
            </p>
          )}
          <Meta post={post} />
        </div>
      </Link>
    </article>
  );
}

function Meta({ post }: { post: NewsListProps["posts"][number] }) {
  const parts: string[] = [];
  if (post.published_at) parts.push(formatDate(post.published_at));
  if (parts.length === 0) return null;
  return (
    <p className="mt-auto border-t-2 border-[#bfeeff] pt-4 text-xs font-black text-[#066a99] uppercase">
      {parts.map((part, index) => (
        <span key={`${part}-${index}`}>
          {index > 0 && <span aria-hidden> · </span>}
          {part}
        </span>
      ))}
    </p>
  );
}

function EmptyState() {
  return (
    <section className="bg-[#f5fbff] px-5 py-20 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-black text-[#066a99] uppercase">
          More stories coming soon
        </p>
        <h2 className="mt-4 text-4xl leading-tight font-black text-[#111111] uppercase sm:text-5xl">
          We&rsquo;re publishing fresh insights here
        </h2>
        <p className="mt-6 text-lg leading-8 font-semibold text-slate-700">
          Want to skip the read and get straight to building? Apply to the
          program and we&rsquo;ll get you on the path.
        </p>
        <div className="mt-8 flex justify-center">
          <Button href="/apply">Apply Now</Button>
        </div>
      </div>
    </section>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    // Pin to UTC so a stored date renders the same calendar day regardless of
    // the server's or viewer's timezone (otherwise a midnight-UTC date rolls
    // back a day in US timezones).
    timeZone: "UTC",
  });
}
