# Paid Ad Attribution URL Templates

Use these templates on paid traffic that lands on Vendingpreneurs forms. They
match the hidden fields captured by the public lead forms and the payload fields
forwarded to Money Page and Close.

Vendingpreneurs also creates a first-party session for paid visitors:

- `localStorage["vp_attr"]` stores the non-PII first/latest-touch attribution
  snapshot.
- `vp_sid` stores the stable `vp_session_id` cookie.

Do not place personal data, secrets, or CRM IDs in ad URL parameters. Those are
attached only after a form submit or Close sync.

## Google Ads

Prefer the **Final URL suffix** when the ad's final URL already points directly
to the landing page:

```text
utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&campaign_id={campaignid}&ad_group_id={adgroupid}&ad_id={creative}&gclid={gclid}&paid_platform=google_ads
```

If using a **tracking template**, include the final URL insertion parameter:

```text
{lpurl}?utm_source=google&utm_medium=cpc&utm_campaign={campaignid}&campaign_id={campaignid}&ad_group_id={adgroupid}&ad_id={creative}&gclid={gclid}&paid_platform=google_ads
```

Notes:

- Google documents `{campaignid}`, `{adgroupid}`, `{creative}`, and `{gclid}`
  as ValueTrack parameters. Auto-tagging can also append the Google click ID.
- Performance Max may not provide an ad group in the same way as search/ad group
  inventory. If `{adgroupid}` is unavailable, use `group_id={assetgroupid}` in
  addition to `campaign_id={campaignid}`.

## Meta Ads

Use the ad-level **URL parameters** field:

```text
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&campaign_id={{campaign.id}}&campaign_name={{campaign.name}}&adset_id={{adset.id}}&adset_name={{adset.name}}&ad_id={{ad.id}}&ad_name={{ad.name}}&paid_platform=meta_ads
```

Notes:

- Meta dynamic parameters populate values such as campaign, ad set, ad, and
  placement/source names based on delivery.
- `fbclid` is appended by Meta on click when applicable; the form capture code
  preserves it when present.

## Required Verification

After changing either platform:

1. Open the ad preview/click test and confirm the landing URL contains the
   expected query params.
2. Submit one test lead per platform.
3. Confirm the Vending lead row has `metadata.paid_attribution`.
4. Confirm the Vending lead row has `metadata.attribution_session` with
   `vp_session_id`, first/latest landing fields, and any clicked CTA context.
5. Confirm Money Page receives anonymous `landing_viewed`/`cta_clicked` events
   when ingest env vars are configured, plus a `lead_captured` event with
   `vp_session_id`, `paid_source_key`, or at least campaign/group/ad IDs.
6. Confirm Close lead custom fields populate when the corresponding
   `CLOSE_*_FIELD_ID` env vars are configured.
7. If any lead lacks a stable click/ad ID chain, label its ROAS/CAC as
   channel-level, blended, modeled, or unattributed instead of ad-level.

Sources:

- Google Ads Help, "Set up tracking with ValueTrack parameters":
  https://support.google.com/google-ads/answer/6305348
- Google Ads API, "Mapping ValueTrack parameters with report fields":
  https://developers.google.com/google-ads/api/docs/reporting/valuetrack-mapping
- Meta Business Help Center, "Add URL Parameters to Your Meta Ads":
  https://www.facebook.com/business/help/1016122818401732
