# Copy review

All interface copy lives in `src/messages/{sq,sr,en}.json`, written Albanian first. Serbian is Latin script, ekavian, formal "Vi", matching the copy that was already live. None of it is final until a native speaker has read it.

## Needs native review

| Language | What | Why |
| --- | --- | --- |
| sq | Everything in `sq.json` | Written by a non-native author. Check tone (direct, warm, "ti" form), word choice and the plural rule in `receipt.photoCount`. |
| sq | `categories.health.examples` ("QKMF pa mjek…") | Check that QKMF is the term people actually use. |
| sq | `shell.theme.*` ("Pamja", "E çelët", "E errët") | Check that these read naturally as theme names. |
| sr | Everything in `sr.json` | Same. Check the plural forms (`one`, `few`, `other`) in `receipt.photoCount`. |
| sr | `categories.health.examples` ("Dom zdravlja…") | Check the term people in Kosovo use for family health centres. |
| sr | `report.review.consent`, `sent.savedCheck` | Rewritten to be gender-neutral. Check that they still sound natural. |
| sq/sr/en | Meta titles and descriptions (`meta.*`) | Titles ≤ 60 and descriptions ≤ 155 characters. Check the search terms people really use in each language; Albanian and Serbian queries differ. |
| sq/sr/en | `home.citiesSoon` | Promises more municipalities "in the near future". Confirm the team is comfortable with that wording. |

## Cliché audit (2026-10-19)

Every banned phrase from the brief (sq, sr, en lists, plus em dashes) was searched for in all three files. No hits in the copy. "Essential cookies" appears as the legal category name in the cookie notice, which is the correct term, not filler.

## Facts to confirm (`TODO(data)`)

- `src/components/ReportFlow.jsx`: "outside the city" is a 20 km radius from the municipality centre. Real municipal boundaries aren't in the database.

- The example report number `PR-2026-000418` uses the seeded Prishtina code `PR`. If a different public ID prefix is set in admin, update the examples in `track.numberHint` and `track.invalidNumber`.
- No response times, statistics or resolution counts appear anywhere. Add them only from real backend numbers.
- Category and city guide pages need the real list of which department handles what in Prishtina.

## Legal review (`TODO(legal)`)

- `src/messages/*.json` → `privacy`: written from what the code does (fields stored, R2, SMTP2Go, map tiles, cookies, 90-day department links, one-year language cookie). A lawyer should check it, and the team should add: who the data controller is, how long reports and photos are kept, and server log retention.
- The privacy page shows `privacy@kosova.report` for data requests. Make sure that mailbox (or a forward) exists before launch.

## Emails

- The department and status emails carry all three languages because the database doesn't store the report's language. If a `language` column is added later, the emails can switch to the reporter's language.
