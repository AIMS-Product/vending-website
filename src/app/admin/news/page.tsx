import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/auth";
import { signOut } from "./actions";

export const metadata: Metadata = {
  title: "News admin",
  robots: { index: false, follow: false },
};

/**
 * Placeholder admin landing — the real list view lands in 3b.6. Calling
 * `requireAdmin()` at the top is the defence-in-depth gate the proxy
 * matcher could miss if a Server Function ever moves to a route the
 * matcher excludes.
 */
export default async function AdminNewsPage() {
  const { user, role } = await requireAdmin();

  return (
    <section className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-6 py-16">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold text-slate-900">News admin</h1>
        <p className="text-sm text-slate-600">
          Signed in as{" "}
          <span className="font-medium text-slate-900">{user.email}</span> (
          {role}).
        </p>
      </header>

      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">
        Post list, drafts, and the editor land in slice 3b.6 / 3b.7. For now
        this page just confirms auth + the admin gate are wired end to end.
      </div>

      <form action={signOut}>
        <button
          type="submit"
          className="inline-flex items-center justify-center rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
        >
          Sign out
        </button>
      </form>
    </section>
  );
}
