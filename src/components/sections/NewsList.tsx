import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
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
      | "author"
      | "published_at"
    >
  >;
};

export function NewsList({ posts }: NewsListProps) {
  if (posts.length === 0) {
    return <EmptyState />;
  }

  return (
    <section className="px-6 py-16 lg:px-10 lg:py-20">
      <ul className="mx-auto grid max-w-[1400px] gap-8 sm:grid-cols-2 lg:grid-cols-3">
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
    <article className="ring-brand-100/60 group flex h-full flex-col overflow-hidden rounded-3xl bg-white shadow-sm ring-1 transition hover:shadow-lg">
      <Link href={`/news/${post.slug}`} className="flex h-full flex-col">
        {post.cover_url ? (
          <div className="bg-brand-50 relative aspect-[16/9] w-full overflow-hidden">
            <Image
              src={post.cover_url}
              alt={post.cover_alt ?? post.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition duration-300 group-hover:scale-[1.02]"
            />
          </div>
        ) : (
          <div className="from-brand-200 via-brand-300 to-brand-400 aspect-[16/9] w-full bg-gradient-to-br" />
        )}
        <div className="flex flex-1 flex-col gap-3 p-6">
          <h2 className="text-brand-600 group-hover:text-brand-500 text-xl font-semibold tracking-tight transition-colors">
            {post.title}
          </h2>
          {post.excerpt && (
            <p className="text-sm text-slate-600">{post.excerpt}</p>
          )}
          <Meta post={post} />
        </div>
      </Link>
    </article>
  );
}

function Meta({ post }: { post: NewsListProps["posts"][number] }) {
  const parts: string[] = [];
  if (post.author) parts.push(post.author);
  if (post.published_at) parts.push(formatDate(post.published_at));
  if (parts.length === 0) return null;
  return (
    <p className="mt-auto text-xs text-slate-500">
      {parts.map((part, i) => (
        <span key={i}>
          {i > 0 && <span aria-hidden> · </span>}
          {part}
        </span>
      ))}
    </p>
  );
}

function EmptyState() {
  return (
    <section className="px-6 py-20 lg:px-10 lg:py-24">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-brand-400 text-sm font-medium tracking-wide uppercase">
          More stories coming soon
        </p>
        <h2 className="text-brand-500 mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
          We&rsquo;re publishing fresh insights here
        </h2>
        <p className="mt-6 text-slate-600">
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
  });
}
