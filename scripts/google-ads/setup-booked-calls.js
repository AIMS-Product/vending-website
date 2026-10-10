/**
 * Setup: make Google Ads bid for booked calls. Run twice.
 *
 * Paste into Google Ads (755-564-3511) > Tools > Bulk actions > Scripts.
 * PREVIEW first: it logs every change it would make and applies none.
 *
 * RUN 1 (BOOKINGS_ONLY = false):
 *  1. Creates "CRM - Booked Call" (Import from clicks, Book appointment, one
 *     per click, 90 days, primary). upload-booked-calls.js fills it from the
 *     site's booked calls (141 with a gclid in the last 90 days on 2026-10-09).
 *  2. Bids on booked calls, lead form, qualified lead and closed won only.
 *     Page views, outbound clicks, directions, engagement stop steering bids.
 *  3. Applies the same to every campaign's goal list (fixes VP | Brand:
 *     "targeted goal is missing a primary conversion action", 0 impressions
 *     since mid-September; it was $29 per booked call).
 *  4. VP | Brand -> Maximize conversions (no target that can starve it).
 *  5. Pauses Web Retargeting ($1,666 since Aug 1, 0 booked calls).
 *  6. Adds utm_term={keyword} to the URL suffix so keywords reach the site.
 * Wait until the backfill shows in Goals > Conversions (about 3 hours after
 * upload-booked-calls.js runs), then:
 * RUN 2 (BOOKINGS_ONLY = true): lead form stops steering bids; Google bids on
 *  booked calls, qualified leads and closed won only.
 * Safe to run again.
 */
var BOOKINGS_ONLY = false;
var BOOKED_CALL_NAME = "CRM - Booked Call";
var BRAND_CAMPAIGN = "VP | Brand";
var PAUSE_CAMPAIGNS = ["Web Retargeting"];

function main() {
  var bid = ["BOOK_APPOINTMENT", "QUALIFIED_LEAD", "CONVERTED_LEAD"];
  if (!BOOKINGS_ONLY) bid.push("SUBMIT_LEAD_FORM");
  Logger.log(
    (AdsApp.getExecutionInfo().isPreview()
      ? "PREVIEW, nothing applied. "
      : "RUN. ") +
      "Bidding on: " +
      bid.join(", "),
  );

  ensureBookedCall();
  setGoals(
    bid,
    "customerConversionGoalOperation",
    "SELECT customer_conversion_goal.resource_name, customer_conversion_goal.category, " +
      "customer_conversion_goal.origin, customer_conversion_goal.biddable FROM customer_conversion_goal",
    function (r) {
      return r.customerConversionGoal;
    },
  );
  setGoals(
    bid,
    "campaignConversionGoalOperation",
    "SELECT campaign.name, campaign_conversion_goal.resource_name, campaign_conversion_goal.category, " +
      "campaign_conversion_goal.origin, campaign_conversion_goal.biddable FROM campaign_conversion_goal " +
      "WHERE campaign.status = 'ENABLED'",
    function (r) {
      return r.campaignConversionGoal;
    },
  );
  logCustomGoals();
  if (!BOOKINGS_ONLY) {
    brandToMaximizeConversions();
    pauseCampaigns();
    addKeywordToSuffix();
  }
}

function ensureBookedCall() {
  var existing = AdsApp.search(
    "SELECT conversion_action.id FROM conversion_action WHERE conversion_action.name = '" +
      BOOKED_CALL_NAME +
      "' AND conversion_action.status = 'ENABLED'",
  );
  if (existing.hasNext()) {
    Logger.log("OK " + BOOKED_CALL_NAME + " exists");
    return;
  }
  var result = AdsApp.mutate({
    conversionActionOperation: {
      create: {
        name: BOOKED_CALL_NAME,
        type: "UPLOAD_CLICKS",
        category: "BOOK_APPOINTMENT",
        status: "ENABLED",
        countingType: "ONE_PER_CLICK",
        clickThroughLookbackWindowDays: 90,
        primaryForGoal: true,
        valueSettings: { defaultValue: 1, alwaysUseDefaultValue: true },
      },
    },
  });
  Logger.log(
    (result.isSuccessful() ? "CREATED " : "FAILED to create ") +
      BOOKED_CALL_NAME +
      (result.isSuccessful()
        ? ""
        : ": " + result.getErrorMessages().join("; ")),
  );
}

function setGoals(bid, operationKey, query, pick) {
  var rows = AdsApp.search(query);
  while (rows.hasNext()) {
    var r = rows.next(),
      goal = pick(r);
    var want = bid.indexOf(goal.category) >= 0;
    if (goal.biddable === want) continue;
    var op = {};
    op[operationKey] = {
      update: { resourceName: goal.resourceName, biddable: want },
      updateMask: "biddable",
    };
    var result = AdsApp.mutate(op);
    Logger.log(
      (result.isSuccessful() ? "SET " : "FAILED ") +
        (r.campaign ? r.campaign.name : "account") +
        " goal " +
        goal.category +
        "/" +
        goal.origin +
        ": " +
        (want ? "bid on it" : "report only") +
        (result.isSuccessful()
          ? ""
          : ": " + result.getErrorMessages().join("; ")),
    );
  }
}

/** A campaign on a custom goal ignores the lists above; say so instead of guessing. */
function logCustomGoals() {
  var rows = AdsApp.search(
    "SELECT campaign.name, conversion_goal_campaign_config.goal_config_level, " +
      "conversion_goal_campaign_config.custom_conversion_goal FROM conversion_goal_campaign_config " +
      "WHERE campaign.status = 'ENABLED'",
  );
  while (rows.hasNext()) {
    var r = rows.next(),
      c = r.conversionGoalCampaignConfig;
    Logger.log(
      "goal config " +
        r.campaign.name +
        ": " +
        c.goalConfigLevel +
        (c.customConversionGoal
          ? " CUSTOM GOAL " + c.customConversionGoal + " (needs a hand fix)"
          : ""),
    );
  }
}

function brandToMaximizeConversions() {
  var it = AdsApp.campaigns()
    .withCondition("campaign.name = '" + BRAND_CAMPAIGN + "'")
    .get();
  if (!it.hasNext()) {
    Logger.log("NOT FOUND " + BRAND_CAMPAIGN);
    return;
  }
  it.next().bidding().setStrategy("MAXIMIZE_CONVERSIONS");
  Logger.log("SET " + BRAND_CAMPAIGN + " bidding: Maximize conversions");
}

function pauseCampaigns() {
  PAUSE_CAMPAIGNS.forEach(function (name) {
    var it = AdsApp.campaigns()
      .withCondition("campaign.name = '" + name + "'")
      .withCondition("campaign.status = 'ENABLED'")
      .get();
    if (!it.hasNext()) return;
    it.next().pause();
    Logger.log("PAUSED " + name);
  });
}

/**
 * Clicks arrive with utm_source/medium/campaign/content but no keyword. Append
 * utm_term={keyword} where the suffix lives (campaign first, else account),
 * leaving every existing parameter as it is.
 */
function addKeywordToSuffix() {
  var rows = AdsApp.search(
    "SELECT campaign.resource_name, campaign.name, campaign.final_url_suffix FROM campaign " +
      "WHERE campaign.status = 'ENABLED' AND campaign.advertising_channel_type = 'SEARCH'",
  );
  var accountNeeded = false;
  while (rows.hasNext()) {
    var c = rows.next().campaign;
    if (!c.finalUrlSuffix) {
      accountNeeded = true;
      continue;
    }
    if (/utm_term=/.test(c.finalUrlSuffix)) continue;
    var r = AdsApp.mutate({
      campaignOperation: {
        update: {
          resourceName: c.resourceName,
          finalUrlSuffix: c.finalUrlSuffix + "&utm_term={keyword}",
        },
        updateMask: "final_url_suffix",
      },
    });
    Logger.log(
      (r.isSuccessful() ? "SET " : "FAILED ") +
        c.name +
        " suffix: " +
        c.finalUrlSuffix +
        "&utm_term={keyword}",
    );
  }
  if (!accountNeeded) return;
  var cust = AdsApp.search(
    "SELECT customer.resource_name, customer.final_url_suffix FROM customer",
  ).next().customer;
  var suffix = cust.finalUrlSuffix || "";
  if (/utm_term=/.test(suffix)) {
    Logger.log("OK account suffix already has utm_term");
    return;
  }
  if (!suffix) {
    Logger.log(
      "NO account suffix found; utm tags come from a tracking template. Left as is.",
    );
    return;
  }
  var res = AdsApp.mutate({
    customerOperation: {
      update: {
        resourceName: cust.resourceName,
        finalUrlSuffix: suffix + "&utm_term={keyword}",
      },
      updateMask: "final_url_suffix",
    },
  });
  Logger.log(
    (res.isSuccessful() ? "SET " : "FAILED ") +
      "account suffix: " +
      suffix +
      "&utm_term={keyword}" +
      (res.isSuccessful() ? "" : ": " + res.getErrorMessages().join("; ")),
  );
}
