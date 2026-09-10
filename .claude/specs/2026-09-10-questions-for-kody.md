# Questions for Kody — YouTube attribution

Everything here is a real fork in the build where I did not want to guess.
Nothing below blocks slice 1; the ones marked BLOCKING stop a later slice.

## Registry data

1. Two campaign slugs are each used by two different videos:
   `jn-vp-pod` and `mike-chelsea-interview`. A lead carrying one of those slugs
   cannot be traced to a single video. Should one video get a new slug, or is
   the pair intentional (same series)?
2. Leads carry `vending-machine-location`; the registry has
   `vending-machine-location-strategy`. I have treated them as the same video.
   Confirm that is right — it is 5 leads.
3. 42 of the 646 registry rows have no Bitly link. Untracked on purpose, or a
   gap to fill? Those videos can never show clicks.
4. 37 rows are not marked redirect-verified / added-to-description. Same
   question — deliberate or unfinished?

5. The single biggest "video" in the report is a registry row titled
   `N/A - Channel` — 39 leads and 24 bookings, 16% of all YouTube lead volume.
   That looks like a channel-level link (banner, about page, or a pinned
   link) rather than a specific video. Should it be reported as its own row
   called something clearer, like "Channel link (not a video)"? Right now it
   tops the per-video table and reads as if it were a video.

## The utm_content convention

5. Every live link uses `desc-link-1`, `desc-link`, or `desc-link ` (with a
   trailing space — worth cleaning). The written convention also describes
   `cta-[label]`. Is the `cta-*` form actually live anywhere?
   If it is not, `utm_content` cannot yet tell us WHERE in a video the click
   came from (description vs pinned comment vs end card), and adding it to the
   convention is the single cheapest new dimension available — the column is
   already stored on every lead.

## Bitly — BLOCKING slice 3

6. Need a Bitly API token with read access, and the workspace's group GUID.
7. Are all ~604 links in one Bitly group, or spread across several?
8. Are all the branded back-halves on `booking.vendingpreneurs.com`? The API
   addresses a link as host + back-half, so a second branded domain means a
   second set of keys.

## Close CRM — BLOCKING slice 2

9. When a deal is won, does Close get an Opportunity record (with a value and a
   won date), or is it only the lead status label `🏆 Closed / Won`?
   This decides whether the 50 leads already marked won can be dated
   retroactively, or whether time-to-close only starts counting from now.
10. Is there anything in Close that records a call was actually HELD? Today the
    only signal is the absence of `👻 No Show` / `🔻 Canceled`, so "attended" is
    a subtraction rather than something we observed. If a field or activity
    exists, the number becomes real.
11. `📄 Contract Sent` — does that sit before or after `🏆 Closed / Won` in the
    pipeline? It changes whether it belongs in the funnel as its own stage.

## Reporting definitions

12. Every registry link points at `/booking-youtube`, but only 195 of 244
    YouTube leads submit there — the other 49 submit on `/`, `/about`, `/news`
    and others. Is that expected browsing behaviour, or does it suggest links in
    descriptions that are not in the registry?
13. Multi-touch: if someone watched three videos before booking, which video
    should get the credit on Kody's report — first touch, last touch, or split?
    I have built first-touch cohorts because that is what the
    "August click, September close" problem needs, but per-video credit is a
    separate choice.
14. Does Kody want the 20 leads whose Close booking predates their form fill
    (returning leads, already in Close) counted in the booking rate? They are
    excluded from cycle-time maths today and reported as their own number.
