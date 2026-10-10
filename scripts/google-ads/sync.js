/**
 * Vendingpreneurs Google Ads -> www.vendingpreneurs.com/api/admin/google-ads-ingest
 *
 * Paste into Google Ads (account 755-564-3511) > Tools > Bulk actions > Scripts.
 * Set SYNC_SECRET to the value of GOOGLE_ADS_SYNC_SECRET in Vercel production.
 * Schedule: daily. Each run re-pulls the last DAYS days (conversions keep
 * landing for days after the click) and the endpoint upserts, so reruns and
 * overlapping windows never duplicate. For a backfill, set DAYS = 90 and run once.
 *
 * Read-only in Google Ads: AdsApp.search only. Nothing here mutates the account.
 * See docs/marketing/google-ads-sync.md for the runbook.
 */
var ENDPOINT = "https://www.vendingpreneurs.com/api/admin/google-ads-ingest";
var SYNC_SECRET = "PASTE_GOOGLE_ADS_SYNC_SECRET";
var DAYS = 30;
var BATCH = 1000;

function main() {
  var range = dateRange(DAYS);
  var where =
    " WHERE segments.date BETWEEN '" + range.from + "' AND '" + range.to + "'";
  var reports = [
    {
      name: "campaign",
      query:
        "SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type, " +
        "campaign.bidding_strategy_type, campaign_budget.amount_micros, segments.date, metrics.impressions, " +
        "metrics.clicks, metrics.cost_micros, metrics.conversions, metrics.conversions_value, " +
        "metrics.all_conversions FROM campaign" +
        where,
      map: function (r) {
        return row([r.segments.date, r.campaign.id], r.segments.date, {
          campaignId: r.campaign.id,
          campaignName: r.campaign.name,
          status: r.campaign.status,
          channel: r.campaign.advertisingChannelType,
          bidding: r.campaign.biddingStrategyType,
          budgetMicros: r.campaignBudget && r.campaignBudget.amountMicros,
          impressions: r.metrics.impressions,
          clicks: r.metrics.clicks,
          costMicros: r.metrics.costMicros,
          conversions: r.metrics.conversions,
          conversionsValue: r.metrics.conversionsValue,
          allConversions: r.metrics.allConversions,
        });
      },
    },
    {
      name: "ad",
      query:
        "SELECT campaign.id, ad_group.id, ad_group.name, ad_group_ad.ad.id, ad_group_ad.ad.type, " +
        "ad_group_ad.status, ad_group_ad.ad_strength, ad_group_ad.policy_summary.approval_status, " +
        "ad_group_ad.ad.final_urls, ad_group_ad.ad.responsive_search_ad.headlines, " +
        "ad_group_ad.ad.responsive_search_ad.descriptions, segments.date, metrics.impressions, " +
        "metrics.clicks, metrics.cost_micros, metrics.conversions FROM ad_group_ad" +
        where,
      map: function (r) {
        var ad = r.adGroupAd.ad;
        var rsa = ad.responsiveSearchAd || {};
        return row([r.segments.date, r.adGroup.id, ad.id], r.segments.date, {
          campaignId: r.campaign.id,
          adGroupId: r.adGroup.id,
          adGroupName: r.adGroup.name,
          adId: ad.id,
          adType: ad.type,
          status: r.adGroupAd.status,
          adStrength: r.adGroupAd.adStrength,
          approval:
            r.adGroupAd.policySummary &&
            r.adGroupAd.policySummary.approvalStatus,
          finalUrls: ad.finalUrls || [],
          headlines: texts(rsa.headlines),
          descriptions: texts(rsa.descriptions),
          impressions: r.metrics.impressions,
          clicks: r.metrics.clicks,
          costMicros: r.metrics.costMicros,
          conversions: r.metrics.conversions,
        });
      },
    },
    {
      name: "asset",
      query:
        "SELECT ad_group.id, ad_group_ad.ad.id, ad_group_ad_asset_view.field_type, " +
        "ad_group_ad_asset_view.performance_label, asset.id, asset.type, asset.text_asset.text, " +
        "asset.image_asset.full_size.url, asset.youtube_video_asset.youtube_video_id, segments.date, " +
        "metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions " +
        "FROM ad_group_ad_asset_view" +
        where,
      map: function (r) {
        var v = r.adGroupAdAssetView,
          a = r.asset;
        return row(
          [r.segments.date, r.adGroup.id, r.adGroupAd.ad.id, a.id, v.fieldType],
          r.segments.date,
          {
            adGroupId: r.adGroup.id,
            adId: r.adGroupAd.ad.id,
            assetId: a.id,
            assetType: a.type,
            fieldType: v.fieldType,
            performanceLabel: v.performanceLabel,
            text: a.textAsset && a.textAsset.text,
            imageUrl:
              a.imageAsset &&
              a.imageAsset.fullSize &&
              a.imageAsset.fullSize.url,
            youtubeId:
              a.youtubeVideoAsset && a.youtubeVideoAsset.youtubeVideoId,
            impressions: r.metrics.impressions,
            clicks: r.metrics.clicks,
            costMicros: r.metrics.costMicros,
            conversions: r.metrics.conversions,
          },
        );
      },
    },
    {
      name: "search_term",
      query:
        "SELECT search_term_view.search_term, search_term_view.status, campaign.id, ad_group.id, " +
        "segments.date, metrics.impressions, metrics.clicks, metrics.cost_micros, metrics.conversions " +
        "FROM search_term_view" +
        where,
      map: function (r) {
        var t = r.searchTermView;
        return row(
          [r.segments.date, r.adGroup.id, t.searchTerm],
          r.segments.date,
          {
            searchTerm: t.searchTerm,
            status: t.status,
            campaignId: r.campaign.id,
            adGroupId: r.adGroup.id,
            impressions: r.metrics.impressions,
            clicks: r.metrics.clicks,
            costMicros: r.metrics.costMicros,
            conversions: r.metrics.conversions,
          },
        );
      },
    },
    {
      name: "keyword",
      query:
        "SELECT ad_group_criterion.criterion_id, ad_group_criterion.keyword.text, " +
        "ad_group_criterion.keyword.match_type, ad_group_criterion.quality_info.quality_score, " +
        "campaign.id, ad_group.id, segments.date, metrics.impressions, metrics.clicks, " +
        "metrics.cost_micros, metrics.conversions FROM keyword_view" +
        where,
      map: function (r) {
        var c = r.adGroupCriterion;
        return row(
          [r.segments.date, r.adGroup.id, c.criterionId],
          r.segments.date,
          {
            keyword: c.keyword.text,
            matchType: c.keyword.matchType,
            qualityScore: c.qualityInfo && c.qualityInfo.qualityScore,
            campaignId: r.campaign.id,
            adGroupId: r.adGroup.id,
            criterionId: c.criterionId,
            impressions: r.metrics.impressions,
            clicks: r.metrics.clicks,
            costMicros: r.metrics.costMicros,
            conversions: r.metrics.conversions,
          },
        );
      },
    },
    {
      name: "conversion_action",
      query:
        "SELECT conversion_action.id, conversion_action.name, conversion_action.type, " +
        "conversion_action.status, conversion_action.category, conversion_action.primary_for_goal, " +
        "conversion_action.counting_type FROM conversion_action",
      map: function (r) {
        var c = r.conversionAction;
        return row([c.id], null, {
          id: c.id,
          name: c.name,
          type: c.type,
          status: c.status,
          category: c.category,
          primaryForGoal: c.primaryForGoal,
          countingType: c.countingType,
        });
      },
    },
  ];

  var failed = [];
  reports.forEach(function (report) {
    try {
      var count = pull(report);
      Logger.log(report.name + ": " + count + " rows sent");
    } catch (e) {
      Logger.log(report.name + " FAILED: " + e);
      failed.push(report.name);
    }
  });
  if (failed.length)
    throw new Error("Google Ads sync failed for: " + failed.join(", "));
}

function pull(report) {
  var rows = AdsApp.search(report.query);
  var batch = [],
    total = 0;
  while (rows.hasNext()) {
    batch.push(report.map(rows.next()));
    if (batch.length === BATCH) {
      post(report.name, batch);
      total += batch.length;
      batch = [];
    }
  }
  if (batch.length) {
    post(report.name, batch);
    total += batch.length;
  }
  return total;
}

function post(name, rows) {
  var res, code;
  for (var attempt = 1; attempt <= 3; attempt++) {
    res = UrlFetchApp.fetch(ENDPOINT, {
      method: "post",
      contentType: "application/json",
      headers: { Authorization: "Bearer " + SYNC_SECRET },
      payload: JSON.stringify({ report: name, rows: rows }),
      muteHttpExceptions: true,
    });
    code = res.getResponseCode();
    if (code === 200) return;
    if (code < 500) break;
    Utilities.sleep(2000 * attempt);
  }
  throw new Error(
    name +
      " batch rejected: HTTP " +
      code +
      " " +
      res.getContentText().slice(0, 200),
  );
}

function row(keyParts, day, data) {
  return { key: keyParts.join("|"), day: day, data: data };
}

function texts(assets) {
  return (assets || []).map(function (a) {
    return a.text;
  });
}

/** Last `days` full days ending yesterday, in the account's time zone. */
function dateRange(days) {
  var tz = AdsApp.currentAccount().getTimeZone();
  var day = 24 * 60 * 60 * 1000;
  var now = new Date().getTime();
  return {
    from: Utilities.formatDate(new Date(now - days * day), tz, "yyyy-MM-dd"),
    to: Utilities.formatDate(new Date(now - day), tz, "yyyy-MM-dd"),
  };
}
