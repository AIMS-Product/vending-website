import type { Metadata } from "next";
import Link from "next/link";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireAdmin } from "@/lib/supabase/auth";
import { adminListPosts, type NewsPost } from "@/lib/services/news";

export const metadata: Metadata = {
  title: "News admin",
  robots: { index: false, follow: false },
};

type SearchParams = { status?: string };
type StatusFilter = "all" | "draft" | "published" | "archived";

const filters: Array<{ label: string; value: StatusFilter }> = [
  { label: "All", value: "all" },
  { label: "Drafts", value: "draft" },
  { label: "Published", value: "published" },
  { label: "Archived", value: "archived" },
];

export default async function AdminNewsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { user, role } = await requireAdmin();
  const params = await searchParams;
  const active = normalizeStatus(params.status);
  const [allPosts, filteredPosts] = await Promise.all([
    adminListPosts(),
    active === "all"
      ? Promise.resolve(null)
      : adminListPosts({ status: active }),
  ]);
  const posts = filteredPosts ?? allPosts;
  const postCounts = countPostsByStatus(allPosts);

  return (
    <AdminShell
      activeSection="posts"
      eyebrow="Blog CMS"
      title="Blog and news"
      description="Create and manage articles from the same admin shell that will also cover landing pages and resource pages."
      userEmail={user.email}
      userRole={role}
    >
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <PostMetricCard label="Showing" value={posts.length} />
        <PostMetricCard label="Drafts" value={postCounts.draft} />
        <PostMetricCard label="Published" value={postCounts.published} />
        <PostMetricCard label="Archived" value={postCounts.archived} />
      </div>

      <nav
        className="mb-5 inline-flex flex-wrap gap-1 rounded-lg bg-[#e8e8ed] p-1"
        aria-label="Post status filters"
      >
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value === "all"
                ? "/admin/news"
                : `/admin/news?status=${filter.value}`
            }
            className={`rounded-md px-4 py-2 text-sm font-medium transition ${
              active === filter.value
                ? "bg-white text-[#1d1d1f] shadow-[0_1px_2px_rgba(0,0,0,0.06)]"
                : "text-[#6e6e73] hover:text-[#1d1d1f]"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-lg border border-black/10 bg-white shadow-[0_20px_60px_rgba(0,0,0,0.06)]">
        {posts.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold text-[#1d1d1f]">
              No posts here yet
            </h2>
            <p className="mt-2 text-sm text-[#6e6e73]">
              Create a draft to start migrating the Webflow news archive.
            </p>
            <Link
              href="/admin/news/new"
              className="mt-5 inline-flex rounded-full bg-[#0071e3] px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-[#0077ed]"
            >
              New post
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="border-b border-black/10 bg-[#fbfbfd] text-xs font-semibold text-[#86868b] uppercase">
              <tr>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/5">
              {posts.map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </AdminShell>
  );
}

function PostMetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-black/10 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]">
      <p className="text-xs font-medium text-[#86868b]">{label}</p>
      <p className="mt-1 text-2xl font-semibold tracking-normal text-[#1d1d1f]">
        {value}
      </p>
    </div>
  );
}

function PostRow({ post }: { post: NewsPost }) {
  return (
    <tr className="align-top transition hover:bg-[#f5f5f7]">
      <td className="px-5 py-4">
        <Link
          href={`/admin/news/${post.id}`}
          className="font-semibold text-[#1d1d1f] hover:text-[#0071e3]"
        >
          {post.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-[#86868b]">/{post.slug}</p>
      </td>
      <td className="px-5 py-4">
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(
            post.status,
          )}`}
        >
          {post.status}
        </span>
      </td>
      <td className="px-5 py-4 text-[#6e6e73]">
        {formatDate(post.updated_at)}
      </td>
      <td className="px-5 py-4 text-[#6e6e73]">
        {post.published_at ? formatDate(post.published_at) : "-"}
      </td>
    </tr>
  );
}

function normalizeStatus(value: string | undefined): StatusFilter {
  if (value === "draft" || value === "published" || value === "archived") {
    return value;
  }
  return "all";
}

function countPostsByStatus(posts: NewsPost[]) {
  return posts.reduce(
    (counts, post) => {
      if (post.status === "draft") counts.draft += 1;
      if (post.status === "published") counts.published += 1;
      if (post.status === "archived") counts.archived += 1;
      return counts;
    },
    { draft: 0, published: 0, archived: 0 },
  );
}

function statusClass(status: string) {
  if (status === "published") return "bg-[#e4f7ec] text-[#0b6b35]";
  if (status === "archived") return "bg-[#e8e8ed] text-[#6e6e73]";
  return "bg-[#fff3d6] text-[#8a5a00]";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
