# ManyChat → Channels tab (Instagram DM)

The Channels tab shows an **Instagram DM** row (new leads, booking links sent,
calls booked, closed) fed by ManyChat flows. ManyChat's API cannot list
contacts in bulk, so each flow tells us when a contact reaches a stage. One
"External Request" action per stage. Contract version 1.

## Setup, once per stage (5 minutes total)

In ManyChat → Automation, open the flow that applies the stage's tag (or the
"Tag Added" flow) and add an **Action → External Request** right after the tag:

- Method: `POST`
- URL: `https://www.vendingpreneurs.com/api/admin/manychat-ingest`
- Headers:
  - `Authorization`: `Bearer <MANYCHAT_INGEST_SECRET>` (Adam has it)
  - `Content-Type`: `application/json`
- Body (raw JSON):

```json
{ "subscriber_id": "{{user_id}}", "event": "call_booked" }
```

Use one of these `event` values per stage:

| Tag in ManyChat          | `event`             | Counts on the tab as |
| ------------------------ | ------------------- | -------------------- |
| New Lead                 | `new_lead`          | Lead                 |
| Pearl Booking link sent  | `booking_link_sent` | Clicked              |
| Pearl Call Booked        | `call_booked`       | Booked a call        |
| Pearl Call Pitched       | `call_pitched`      | stored, not charted  |
| Pearl Booked Call Closed | `closed`            | Won                  |

Nothing else is needed in the body. The receiver looks the contact up in the
ManyChat API and stores their Instagram username, email, phone and tags so a
Calendly booking can be matched back to the DM.

Test: press "Test request" in the action. A `200` with `"ok": true` means it
landed; the Instagram DM row on the Channels tab updates on the next page load.

## Rules

- Same contact, same stage, same day = one count. Firing twice is safe.
- A stage never fires retroactively: history before the action was added is
  not in the tab. The coverage grid shows the gap with its cause until then.
- Links Pearl sends should still use the link standard
  (`utm_source=ghl&utm_medium=pearl` is already mapped to Instagram DM).
