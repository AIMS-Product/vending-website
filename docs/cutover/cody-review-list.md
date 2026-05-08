# Cody Review List

Source: May 8 page inventory screenshot.

This list contains rows that should not be treated as fully decided from the
spreadsheet alone. The implementation keeps deterministic keep/remove rows in
`docs/cutover/webflow-url-inventory.md`; these items need owner confirmation
before final launch cleanup.

## Needs Decision

| URL                                 | Current handling                      | Why Cody needs to review                                                                                                              | Safe default until decided                                                                                            |
| ----------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `/booking-vendingpreneurs-training` | Held as an existing legacy lead route | The screenshot places "Vendingpreneurs Training" under "Unsure need to dive into this" without an In Use, Channel, or Index decision. | Keep route available but noindex/canonical through the apply flow until confirmed.                                    |
| `/start-my-vending-business`        | Kept as an active VSL paid lead route | The same URL appears as an active paid VSL row and also appears again in the redirect/archive section as not in use.                  | Keep because the paid VSL row is more specific; confirm whether the organic duplicate should be retired.              |
| `/vending-route-blueprint`          | Kept as an active VSL/lead page       | Marked in use and indexable, but the sheet note suggests VSL/booking form work may still be needed.                                   | Keep route and confirm final form destination/tracking before launch.                                                 |
| `/thank-you-for-applying`           | Kept as a noindex support page        | The note says "LANE 2" and "add ty for webinar sign up", which is workflow-specific rather than a simple keep/remove decision.        | Keep current thank-you page noindex; add the webinar-specific thank-you page only after the target lane is confirmed. |
| `/schedule-your-call-ig`            | Kept as an active lead route          | It sits in the redirect/archive section but is marked In Use Yes with a "webinar showed up" note.                                     | Keep route and confirm whether it belongs to the webinar-attended path.                                               |

## Form And Tracking Follow-Up

| URL                          | Follow-up                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `/start-my-vending-business` | Add or verify the VSL booking form destination.                                                                                 |
| `/thank-you-for-applying`    | Confirm whether this remains the universal application thank-you page or whether a webinar-specific thank-you page is required. |
| `/vending-route-blueprint`   | Confirm whether it should be indexable as a real organic/lead magnet page or canonicalized as a paid/VSL route.                 |
