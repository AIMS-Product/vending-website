import type { Metadata } from "next";
import Link from "next/link";
import { requireAdmin } from "@/lib/supabase/auth";
import { adminListPosts, type NewsPost } from "@/lib/services/news";
import { signOut } from "./actions";

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
  const posts = await adminListPosts(
    active === "all" ? {} : { status: active },
  );

  return (
    <section className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-6 py-12 lg:px-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-brand-500 text-sm font-medium">News CMS</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            Posts
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Signed in as{" "}
            <span className="font-medium text-slate-900">{user.email}</span> (
            {role}).
          </p>
        </div>
        <div className="flex items-center gap-3">
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/admin/news/new"
            className="bg-brand-500 hover:bg-brand-600 rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition"
          >
            New post
          </Link>
        </div>
      </header>

      <nav className="flex flex-wrap gap-2" aria-label="Post status filters">
        {filters.map((filter) => (
          <Link
            key={filter.value}
            href={
              filter.value === "all"
                ? "/admin/news"
                : `/admin/news?status=${filter.value}`
            }
            className={`rounded-full px-4 py-2 text-sm font-medium transition ${
              active === filter.value
                ? "bg-slate-950 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {filter.label}
          </Link>
        ))}
      </nav>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {posts.length === 0 ? (
          <div className="p-10 text-center">
            <h2 className="text-lg font-semibold text-slate-950">
              No posts here yet
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Create a draft to start migrating the Webflow news archive.
            </p>
            <Link
              href="/admin/news/new"
              className="bg-brand-500 hover:bg-brand-600 mt-5 inline-flex rounded-full px-5 py-2 text-sm font-semibold text-white shadow-sm transition"
            >
              New post
            </Link>
          </div>
        ) : (
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-5 py-3">Title</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3">Updated</th>
                <th className="px-5 py-3">Published</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {posts.map((post) => (
                <PostRow key={post.id} post={post} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function PostRow({ post }: { post: NewsPost }) {
  return (
    <tr className="align-top transition hover:bg-slate-50/70">
      <td className="px-5 py-4">
        <Link
          href={`/admin/news/${post.id}`}
          className="hover:text-brand-600 font-semibold text-slate-950"
        >
          {post.title}
        </Link>
        <p className="mt-1 font-mono text-xs text-slate-500">/{post.slug}</p>
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
      <td className="px-5 py-4 text-slate-600">
        {formatDate(post.updated_at)}
      </td>
      <td className="px-5 py-4 text-slate-600">
        {post.published_at ? formatDate(post.published_at) : "—"}
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

function statusClass(status: string) {
  if (status === "published") return "bg-emerald-50 text-emerald-700";
  if (status === "archived") return "bg-slate-100 text-slate-600";
  return "bg-amber-50 text-amber-700";
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
