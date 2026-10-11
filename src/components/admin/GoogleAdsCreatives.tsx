import Image from "next/image";
import {
  AdminStatusBadge,
  adminCardClass,
  adminEyebrowClass,
} from "@/components/admin/AdminUi";
import { formatCount, formatUsd } from "@/lib/admin/format-number";
import type {
  DisplayCreative,
  LiveAd,
} from "@/lib/services/google-ads-live-ads";

interface LiveAdsProps {
  ads: LiveAd[];
  rangeLabel: string;
}

const displayUrl = (url: string | null) => {
  if (!url || !URL.canParse(url)) return url ?? "vendingpreneurs.com";
  const u = new URL(url);
  const path = u.pathname === "/" ? "" : u.pathname;
  return `${u.hostname.replace(/^www\./, "")}${path}`;
};

function approvalChip(ad: LiveAd) {
  if (ad.inReview)
    return <AdminStatusBadge status="review" label="In review" tone="idle" />;
  if (ad.approval === "APPROVED_LIMITED")
    return <AdminStatusBadge status="limited" label="Limited" tone="warn" />;
  return <AdminStatusBadge status="approved" label="Live" tone="ok" />;
}

/** Each live search ad drawn the way Google shows it, with its spend. */
export function GoogleAdsLiveAds({ ads, rangeLabel }: LiveAdsProps) {
  return (
    <section className={adminCardClass} aria-label="Live ads">
      <h2 className={adminEyebrowClass}>What people see on Google</h2>
      <p className="text-ui-text-subtle mt-1 text-[0.8125rem]">
        Every ad that can show right now. Google mixes the headlines; these are
        the first three. Spend is {rangeLabel.toLowerCase()}.
      </p>
      {ads.length === 0 ? (
        <p className="text-ui-text-subtle mt-3 text-sm">
          No live ads synced yet. They arrive with the nightly Google Ads sync.
        </p>
      ) : (
        <ul className="mt-4 grid gap-4 lg:grid-cols-2">
          {ads.map((ad) => (
            <li
              key={ad.adId}
              className="border-ui-line rounded-ui flex flex-col border p-4"
            >
              <p className="text-ui-text-subtle text-xs">
                <span className="text-ui-text font-semibold">Sponsored</span> ·{" "}
                {displayUrl(ad.landing)}
              </p>
              <p className="mt-1 text-[1.0625rem] leading-snug text-[#1a0dab]">
                {ad.headlines.length
                  ? ad.headlines.slice(0, 3).join(" | ")
                  : "Ad copy arrives with the next sync"}
              </p>
              {ad.descriptions[0] ? (
                <p className="text-ui-text-muted mt-1 text-sm">
                  {ad.descriptions.slice(0, 2).join(" ")}
                </p>
              ) : null}
              <div className="border-ui-line mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 border-t pt-3 text-[0.8125rem]">
                {approvalChip(ad)}
                <span className="text-ui-text-subtle">
                  {ad.campaign}
                  {ad.adGroup ? ` › ${ad.adGroup}` : ""}
                </span>
                <span className="text-ui-text ml-auto tabular-nums">
                  {formatUsd(ad.spend)} · {formatCount(ad.clicks)} clicks
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Image and video assets, most seen first. */
export function GoogleAdsDisplayCreatives({
  creatives,
}: {
  creatives: DisplayCreative[];
}) {
  if (creatives.length === 0) return null;
  return (
    <section className={adminCardClass} aria-label="Image and video creatives">
      <h2 className={adminEyebrowClass}>Image and video creatives</h2>
      <p className="text-ui-text-subtle mt-1 text-[0.8125rem]">
        Display assets, most seen first, over the last sync window.
      </p>
      <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {creatives.map((c) => (
          <li key={c.assetId} className="text-[0.8125rem]">
            <div className="bg-ui-canvas rounded-ui relative aspect-square overflow-hidden">
              <Image
                src={c.previewUrl}
                alt={`${c.kind} creative, ${c.campaign}`}
                fill
                sizes="(min-width: 1024px) 16vw, 45vw"
                className="object-contain"
              />
            </div>
            <p className="text-ui-text mt-1.5 tabular-nums">
              {formatUsd(c.cost)} · {formatCount(c.clicks)} clicks
            </p>
            <p className="text-ui-text-subtle truncate">
              {c.kind === "video" ? "Video" : "Image"} · {c.campaign}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
