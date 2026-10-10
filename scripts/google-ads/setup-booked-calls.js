/**
 * One-time setup: make Google Ads optimize for booked calls.
 *
 * Paste into Google Ads (755-564-3511) > Tools > Bulk actions > Scripts.
 * PREVIEW first: preview runs every query and logs every change it WOULD make,
 * but applies none. Run only after the preview log reads right.
 *
 * What it changes:
 *  1. Creates conversion action "Booked Call" (website, Book appointment,
 *     one per click, 90-day window) if it does not exist, and logs the
 *     send_to value for NEXT_PUBLIC_GOOGLE_ADS_BOOKED_CALL_SEND_TO.
 *  2. Account goals: bid on BID_CATEGORIES only (booked call, lead form,
 *     qualified lead, closed won). Page views, outbound clicks, directions,
 *     engagement and the rest stop steering bids. They are still reported.
 *  3. Every campaign's own goal list is set to the same, which fixes VP | Brand
 *     ("targeted goal is missing a primary conversion action") and stops Web
 *     Retargeting from bidding on page views.
 * Safe to run twice.
 */
var BID_CATEGORIES = [
  "BOOK_APPOINTMENT",
  "SUBMIT_LEAD_FORM",
  "QUALIFIED_LEAD",
  "CONVERTED_LEAD",
];
var BOOKED_CALL_NAME = "Booked Call";

function main() {
  var customerId = AdsApp.currentAccount().getCustomerId().replace(/-/g, "");
  ensureBookedCall(customerId);
  setGoals(
    "customer_conversion_goal",
    "customerConversionGoalOperation",
    "SELECT customer_conversion_goal.resource_name, customer_conversion_goal.category, " +
      "customer_conversion_goal.origin, customer_conversion_goal.biddable FROM customer_conversion_goal",
    function (r) {
      return r.customerConversionGoal;
    },
  );
  setGoals(
    "campaign_conversion_goal",
    "campaignConversionGoalOperation",
    "SELECT campaign.name, campaign_conversion_goal.resource_name, campaign_conversion_goal.category, " +
      "campaign_conversion_goal.origin, campaign_conversion_goal.biddable FROM campaign_conversion_goal " +
      "WHERE campaign.status = 'ENABLED'",
    function (r) {
      return r.campaignConversionGoal;
    },
  );
  logCustomGoals();
}

function ensureBookedCall(customerId) {
  var existing = AdsApp.search(
    "SELECT conversion_action.resource_name, conversion_action.tag_snippets FROM conversion_action " +
      "WHERE conversion_action.name = '" +
      BOOKED_CALL_NAME +
      "' AND conversion_action.status = 'ENABLED'",
  );
  if (existing.hasNext()) {
    logSendTo(existing.next().conversionAction);
    return;
  }
  var result = AdsApp.mutate({
    conversionActionOperation: {
      create: {
        name: BOOKED_CALL_NAME,
        type: "WEBPAGE",
        category: "BOOK_APPOINTMENT",
        status: "ENABLED",
        countingType: "ONE_PER_CLICK",
        clickThroughLookbackWindowDays: 90,
        viewThroughLookbackWindowDays: 1,
        primaryForGoal: true,
        valueSettings: { defaultValue: 1, alwaysUseDefaultValue: true },
      },
    },
  });
  if (!result.isSuccessful()) {
    throw new Error(
      "Could not create Booked Call: " + result.getErrorMessages().join("; "),
    );
  }
  Logger.log(
    "CREATED Booked Call: " +
      result.getResourceName() +
      ". Run this script again (or open the action in Goals > Conversions > Tag setup) to read its send_to label.",
  );
}

function logSendTo(action) {
  (action.tagSnippets || []).forEach(function (s) {
    var m = /send_to': '([^']+)'/.exec(s.eventSnippet || "");
    if (m)
      Logger.log(
        "Booked Call send_to = " +
          m[1] +
          "  -> set NEXT_PUBLIC_GOOGLE_ADS_BOOKED_CALL_SEND_TO",
      );
  });
}

function setGoals(label, operationKey, query, pick) {
  var rows = AdsApp.search(query);
  while (rows.hasNext()) {
    var r = rows.next();
    var goal = pick(r);
    var want = BID_CATEGORIES.indexOf(goal.category) >= 0;
    if (goal.biddable === want) continue;
    var where = r.campaign ? r.campaign.name + " / " : "account / ";
    var op = {};
    op[operationKey] = {
      update: { resourceName: goal.resourceName, biddable: want },
      updateMask: "biddable",
    };
    var result = AdsApp.mutate(op);
    Logger.log(
      (result.isSuccessful() ? "SET " : "FAILED ") +
        label +
        " " +
        where +
        goal.category +
        "/" +
        goal.origin +
        " biddable " +
        goal.biddable +
        " -> " +
        want +
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
          ? " CUSTOM GOAL " + c.customConversionGoal + " (fix by hand)"
          : ""),
    );
  }
}
