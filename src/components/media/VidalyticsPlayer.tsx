import Script from "next/script";

/**
 * One Vidalytics player.
 *
 * Vidalytics ships a per-video snippet: a sized placeholder div plus an IIFE
 * that loads the shared loader/player bundles and runs an Embed against that
 * div's id. The snippet is reproduced verbatim below — it already guards
 * against loading the bundles twice (it caches the loader on
 * `window.VidalyticsL`), which is what makes it safe to drop thirteen of these
 * on one page.
 *
 * The account segment (`erwZUUrS`) is the same for every Vendingpreneurs video,
 * so callers only pass the per-video embed id.
 *
 * `fast.vidalytics.com` is already allowed in script-src / connect-src /
 * frame-src — see src/lib/content-security-policy.ts. There is no sitewide
 * Vidalytics loader (it was removed on 2026-08-31); each player brings its own,
 * which keeps the cost on the pages that actually have videos.
 */

const ACCOUNT_ID = "erwZUUrS";

export function VidalyticsPlayer({
  embedId,
  className = "",
}: {
  embedId: string;
  className?: string;
}) {
  const containerId = `vidalytics_embed_${embedId}`;

  return (
    <div
      className={`relative overflow-hidden rounded-[12px] border-2 border-[#111111] bg-[#0b1b26] shadow-[8px_8px_0_#111111] ${className}`}
    >
      <div id={containerId} style={{ width: "100%", paddingTop: "56.25%" }} />
      <Script id={`vidalytics-${embedId}`} strategy="lazyOnload">
        {`(function (v, i, d, a, l, y, t, c, s) {
    y='_'+d.toLowerCase();c=d+'L';if(!v[d]){v[d]={};}if(!v[c]){v[c]={};}if(!v[y]){v[y]={};}var vl='Loader',vli=v[y][vl],vsl=v[c][vl + 'Script'],vlf=v[c][vl + 'Loaded'],ve='Embed';
    if (!vsl){vsl=function(u,cb){
        if(t){cb();return;}s=i.createElement("script");s.type="text/javascript";s.async=1;s.src=u;
        if(s.readyState){s.onreadystatechange=function(){if(s.readyState==="loaded"||s.readyState=="complete"){s.onreadystatechange=null;vlf=1;cb();}};}else{s.onload=function(){vlf=1;cb();};}
        i.getElementsByTagName("head")[0].appendChild(s);
    };}
    vsl(l+'loader.min.js',function(){if(!vli){var vlc=v[c][vl];vli=new vlc();}vli.loadScript(l+'player.min.js',function(){var vec=v[d][ve];t=new vec();t.run(a);});});
})(window, document, 'Vidalytics', '${containerId}', 'https://fast.vidalytics.com/embeds/${ACCOUNT_ID}/${embedId}/');`}
      </Script>
    </div>
  );
}
