import Script from "next/script";

/**
 * Third-party marketing / attribution tags ported from the legacy Webflow site
 * for the cutover: Meta Pixel, HubSpot, ClickMagick, Vidalytics, Wisepops,
 * ManyChat, RightMessage, and idpixel.
 *
 * These are GATED behind `NEXT_PUBLIC_TRACKING_ENABLED` (off by default) so
 * preview/dev traffic never pollutes real pixel/CRM reporting. Set it to "1" in
 * the production environment at cutover to activate every tag at once.
 *
 * NOT ported: the Typeform embed script (Typeform was replaced by the native
 * lead form) and the Swiper/jQuery UI scripts (the React site builds carousels
 * and nav behavior with its own components).
 *
 * First-party UTM/source attribution is handled separately by
 * AttributionSessionTracker + the native lead form — that always runs.
 */
const META_PIXEL_ID = "2008180456764704";
const HUBSPOT_ID = "48512363";
const VIDALYTICS_ID = "vid_glb_erwZUUrS";

export function TrackingScripts() {
  if (process.env.NEXT_PUBLIC_TRACKING_ENABLED !== "1") return null;

  return (
    <>
      {/* Meta Pixel */}
      <Script id="meta-pixel" strategy="afterInteractive">
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`}
      </Script>
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
          alt=""
        />
      </noscript>

      {/* ClickMagick — config must be set before the loader runs */}
      <Script id="clickmagick-config" strategy="afterInteractive">
        {`window.clickmagick_cmc = {
  uid: '206516',
  hid: '2907647933',
  cmc_project: 'Vendingpreneurs',
  vid_info: 'on',
  utm_source: 'organic',
  cmc_ref: 'website',
};`}
      </Script>
      <Script
        id="clickmagick-loader"
        src="https://cm.vendingpreneurs.ai/e00dc3b0.js"
        strategy="afterInteractive"
      />

      {/* idpixel — visitor identity resolution */}
      <Script
        id="idpixel"
        src="https://cdn.idpixel.app/v1/idp-analytics-6a289e9683e9dbc113e83182.min.js"
        strategy="afterInteractive"
      />

      {/* HubSpot */}
      <Script
        id="hs-script-loader"
        src={`https://js.hs-scripts.com/${HUBSPOT_ID}.js`}
        strategy="afterInteractive"
      />

      {/* Vidalytics */}
      <Script
        id={VIDALYTICS_ID}
        src="https://fast.vidalytics.com/js/global.min.js"
        strategy="afterInteractive"
      />

      {/* RightMessage — personalization */}
      <Script id="rightmessage" strategy="afterInteractive">
        {`(function(p, a, n, d, o, b, c) {
  window.RM = window.RM || [];
  o = n.createElement('script'); o.type = 'text/javascript'; o.async = true; o.src = 'https://t.rightmessage.com/'+p+'.js';
  b = n.getElementsByTagName('script')[0]; d = function(h, u, i, s) { var c = n.createElement('style'); c.id = 'rmcloak'+i;
      c.type = 'text/css'; c.appendChild(n.createTextNode('.rmcloak'+h+'{visibility:hidden}.rmcloak'+u+'{display:none}'+s));
      b.parentNode.insertBefore(c, b); return c; }; c = d('', '-hidden', '', '[data-rm-if],[data-rm-else-if],[data-rm-else]{display:none}'); d('-stay-invisible', '-stay-hidden', '-stay', '');
  setTimeout(o.onerror = function() { c.parentNode && c.parentNode.removeChild(c); }, a); b.parentNode.insertBefore(o, b);
})('46855491', 20000, document);`}
      </Script>

      {/* ManyChat */}
      <Script
        id="manychat"
        src="https://widget.manychat.com/4445302_bb820.js"
        strategy="lazyOnload"
      />
      <Script
        id="manychat-widget"
        src="https://mccdn.me/assets/js/widget.js"
        strategy="lazyOnload"
      />

      {/* Wisepops — popups */}
      <Script id="wisepops" strategy="lazyOnload">
        {`(function(w,i,s,e){window[w]=window[w]||function(){(window[w].q=window[w].q||[]).push(arguments)};window[w].l=Date.now();s=document.createElement('script');e=document.getElementsByTagName('script')[0];s.defer=1;s.src=i;e.parentNode.insertBefore(s, e)})('wisepops', 'https://wisepops.net/h/7JTLjfseNd/loader.js?v=3');`}
      </Script>
    </>
  );
}
