import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <p className="text-sm font-medium tracking-wide text-sky-700 uppercase">
        404
      </p>
      <h1 className="text-3xl font-semibold text-slate-900 sm:text-4xl">
        Page not found
      </h1>
      <p className="max-w-md text-slate-600">
        The page you&apos;re looking for doesn&apos;t exist or has moved.
      </p>
      <Link
        href="/"
        className="mt-2 inline-flex items-center rounded-full bg-white px-6 py-3 text-sm font-medium text-sky-700 shadow ring-1 ring-slate-200 transition hover:bg-slate-50"
      >
        Back to home
      </Link>
    </div>
  );
}
