/**
 * Loading fallback for the chrome-less funnel routes. The root `loading.tsx`
 * paints the site's "Loading…" panel, which flashed on these pages while their
 * search params stream in. A blank full-height block keeps the same no-shift
 * guarantee (the root file's CLS fix) without the site look.
 */
export default function FunnelLoading() {
  return <div aria-busy="true" className="min-h-[100svh]" />;
}
