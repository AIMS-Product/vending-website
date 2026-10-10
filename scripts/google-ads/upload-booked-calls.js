/**
 * Booked calls -> Google Ads "CRM - Booked Call" (offline click conversions).
 *
 * Paste into Google Ads (755-564-3511) > Tools > Bulk actions > Scripts.
 * Set SYNC_SECRET to GOOGLE_ADS_SYNC_SECRET (same as sync.js).
 * Backfill: DAYS = 90, run once. Then DAYS = 7 and schedule Daily.
 * Re-uploading the same click, action and time is ignored by Google, so the
 * overlapping 7-day window is safe.
 *
 * Preview uploads nothing: it builds the upload and shows Google's preview.
 * Run applies it. Results: Goals > Conversions > Uploads.
 */
var ENDPOINT =
  "https://www.vendingpreneurs.com/api/admin/google-ads-booked-calls";
var SYNC_SECRET = "PASTE_GOOGLE_ADS_SYNC_SECRET";
var CONVERSION_NAME = "CRM - Booked Call";
var DAYS = 7;
var TZ = "America/Los_Angeles";

function main() {
  var res = UrlFetchApp.fetch(ENDPOINT + "?days=" + DAYS, {
    headers: { Authorization: "Bearer " + SYNC_SECRET },
    muteHttpExceptions: true,
  });
  if (res.getResponseCode() !== 200) {
    throw new Error(
      "Booked calls endpoint: HTTP " +
        res.getResponseCode() +
        " " +
        res.getContentText().slice(0, 200),
    );
  }
  var conversions = JSON.parse(res.getContentText()).conversions || [];
  Logger.log(
    conversions.length + " booked calls in the last " + DAYS + " days",
  );
  if (!conversions.length) return;

  var upload = AdsApp.bulkUploads().newCsvUpload(
    ["Google Click ID", "Conversion Name", "Conversion Time"],
    { timeZone: TZ },
  );
  upload.forOfflineConversions();
  upload.setFileName(
    "booked-calls-" + Utilities.formatDate(new Date(), TZ, "yyyyMMdd-HHmm"),
  );
  conversions.forEach(function (c) {
    upload.append({
      "Google Click ID": c.gclid,
      "Conversion Name": CONVERSION_NAME,
      "Conversion Time": Utilities.formatDate(
        new Date(c.conversionTime),
        TZ,
        "yyyyMMdd HHmmss",
      ),
    });
  });
  if (AdsApp.getExecutionInfo().isPreview()) {
    upload.preview();
    Logger.log(
      "PREVIEW: built " + conversions.length + " rows, nothing uploaded.",
    );
  } else {
    upload.apply();
    Logger.log(
      "UPLOADED " +
        conversions.length +
        " booked calls to " +
        CONVERSION_NAME +
        ".",
    );
  }
}
