# Design direction — "Civic Evidence", draft 1

For review before any implementation. Visual board: `docs/redesign/direction-board.html` (open it in a browser; it uses real Prishtina street geometry from OpenStreetMap, © OpenStreetMap contributors, ODbL).

## The idea in one line

A report should feel like a **receipt from the city**: a slip of paper that gets a category stamp, a pin, clipped photos, your words, and finally an official stamp in ochre ink and a tear-off key stub. Everything else on the site stays quiet so that object can be the memorable thing.

## Colour

Tokens in `oklch()`. Hex values are sRGB approximations. Contrast measured against `paper` unless stated.

| Token | Light (paper) | Night ink | Role | Contrast |
| --- | --- | --- | --- | --- |
| `ink` | `oklch(0.265 0.085 258)` ≈ `#06244d` | `oklch(0.94 0.015 88)` ≈ `#efebe0` | Text, wordmark, rules that matter. The current `#062653`, barely moved. | 14.2:1 / 15.1:1 |
| `paper` | `oklch(0.972 0.010 88)` ≈ `#f8f6ee` | `oklch(0.205 0.045 258)` ≈ `#09172b` | Page ground. Faintly warm, closer to a municipal form than to cream. | — |
| `card` | `oklch(0.993 0.004 90)` ≈ `#fefdfa` | `oklch(0.265 0.05 258)` ≈ `#15253d` | The receipt itself, a step brighter than the page. | — |
| `pencil` | `oklch(0.47 0.035 258)` ≈ `#4f5c6f` | `oklch(0.76 0.03 250)` ≈ `#a3b3c4` | Secondary text, coordinates, captions. | 6.3:1 / 8.4:1 |
| `rule` | `oklch(0.86 0.018 250)` ≈ `#c8d2dd` | `oklch(0.38 0.045 258)` | Ruled lines on the receipt, map linework. | decorative |
| `gold` | `oklch(0.80 0.125 84)` ≈ `#e4b756` | `oklch(0.82 0.13 84)` ≈ `#ecbd57` | **Signal.** Primary action fill (ink text on it), the pin, the wordmark dot. | ink on gold 8.2:1 (AAA) |
| `stamp` | `oklch(0.53 0.105 72)` ≈ `#916016` | `oklch(0.80 0.12 82)` | Stamp ink. Same hue as gold, dark enough to read on paper. | 5.0:1 |

**Why gold and not vermilion.** Three reasons. It is the gold of the Kosovo flag, so it belongs to this place and not to every startup. The current wordmark already has an amber dot, so it's continuity. And red reads as "emergency", which is exactly what the mandatory disclaimer says this platform is not. Red is reserved for errors only.

**Category accents** (always paired with icon + label, never colour alone):

| Category | Token | Light ≈ | Contrast | Material it comes from |
| --- | --- | --- | --- | --- |
| Infrastrukturë | `oklch(0.55 0.12 48)` | `#a9592b` | 4.7:1 | rust on rebar, road works |
| Mjedis | `oklch(0.52 0.10 148)` | `#3c7847` | 4.9:1 | Gërmia forest |
| Shërbime publike | `oklch(0.52 0.08 215)` | `#237486` | 4.9:1 | water mains |
| Administratë | `oklch(0.49 0.10 302)` | `#6b518f` | 6.0:1 | violet office stamp pads |
| Shëndetësi | `oklch(0.53 0.12 18)` | `#a64b51` | 5.2:1 | muted brick, deliberately not alarm red |
| Arsim | `oklch(0.54 0.10 105)` | `#787121` | 4.6:1 | school-desk olive |
| Siguri | `oklch(0.52 0.07 240)` | `#416e8d` | 5.0:1 | steel blue |

**Night ink** is a navy-black page with paper-coloured ink, not an inversion. The stamp turns to bright gold because dark ochre disappears on navy. **Sunlight mode** (one tap, header) goes to pure white paper, `oklch(0.18 0.07 260)` ink (18.9:1), drops the grain and the map linework, bumps body weight one step, and gives the gold button a 2 px ink border.

## Type

| Role | Face | Why |
| --- | --- | --- |
| Display, stamps, wordmark, step titles | **Sofia Sans Extra Condensed**, 800–900 | Tall, blocky capitals in the spirit of the NEWBORN monument letters and of stamp and ticket lettering. Condensed, so long Albanian headlines ("Zgjidhni kategorinë e problemit") still fit at large sizes on a 360 px screen. Lettersoup's Cyrillic is first-class, which matters for `sr-Cyrl`. |
| UI: buttons, labels, inputs, numbers | **Sofia Sans** (normal width), 400–700, `tnum` for reference numbers and dates | Same skeleton as the display face, so the system feels like one voice. |
| Reading: descriptions, guides, legal, the citizen's own words on the card | **Literata** (variable `opsz`), 400–600 | A screen-drawn text serif with full Cyrillic and good ë/ç. Putting the citizen's description in a serif makes it read as testimony, set apart from the form chrome. |

All three are OFL, variable, with Latin Extended and Cyrillic (checked against the Google Fonts subsets). In production they're self-hosted via `next/font/local`, subset to Latin + Latin Ext + Cyrillic. jsPDF can't use variable fonts, so the PDF gets static instances (Sofia Sans Extra Condensed 800, Sofia Sans 400/600, Literata 400) cut once with `fonttools`.

Scale (fluid, `clamp()`, ratio about 1.25 on mobile and 1.333 on desktop): 14 / 16 / 18 / 22 / 28 / 36 / 52 / 84 px at the top end. Body never under 16 px. Display line-height 0.92, body 1.55 (sans) and 1.65 (Literata).

No all-caps labels in the interface. Caps appear only where the vernacular actually uses them: on the stamp ring and on the ticket stub.

## Layout

- **Mobile (designed at 360 px):** one column, left-aligned. Primary action in a sticky bottom bar (gold, full width, `safe-area-inset-bottom`). In the report flow the receipt is a sheet that peeks from the top showing what's filled in so far, and expands on tap.
- **Desktop:** asymmetric 7/5 grid. Form or story on the left, the receipt pinned on the right and slightly rotated (−1.5°), as if it's lying on the desk.
- **No box-in-box cards.** The only thing with paper edges is the receipt. Everything else sits directly on the page and is separated by space and ruled lines.
- Radius: 2 px on inputs and buttons, 0 on the receipt (it has perforations instead), full round only on the pin.

## Wordmark

`kosova.report` set lowercase in Sofia Sans Extra Condensed 900, with the full stop replaced by a small gold map pin. The pin is also the favicon and the maskable app icon.

## Signature moments

Ordered as a user meets them.

- **Map draw-in (landing):** central Prishtina's real streets draw themselves with `stroke-dashoffset` (major roads first, then the residential grid), then category pins drop onto real streets. About 1.6 s, once per session, static under reduced motion.
- **Category stamp:** picking a category presses its mark onto the receipt (scale 1.15 → 1 with a slight rotation, ink blur settling via `filter`).
- **Pin drop:** pin falls with a spring, coordinates type in beside it (`42.6643° N, 21.1650° E`), 10 ms `navigator.vibrate` where supported.
- **Photo clip:** thumbnails land on the receipt at ±3° under a drawn paper clip.
- **Submission stamp:** the big ochre stamp hits the receipt with the reference number, the bottom perforation tears and the key stub slides free, then the PDF button appears. Under 1.2 s, tap to skip, instant under reduced motion.
- **Language switch:** same-document View Transition cross-fade of text only; layout doesn't move because all three languages are measured into the same grid.

Motion tokens: `--ease-out-quint: cubic-bezier(.22,1,.36,1)`, `--spring-snappy` as a CSS `linear()` spring, durations 120 / 220 / 400 / 700 ms. Every animation has a `prefers-reduced-motion: reduce` fallback (opacity or instant).

## Self-review: what I changed after checking the plan against the brief

- **Stamp colour.** First instinct was a vermilion stamp. Changed to ochre "stamp" ink: red would contradict the non-emergency message, and vermilion-on-navy is a stock look.
- **Display face.** First shortlist had a high-contrast editorial serif. Dropped it: cream paper + big serif is the most common generated look, and a serif display doesn't survive sunlight at 360 px as well as a heavy condensed sans. The serif moved to where it earns its place, the citizen's own words.
- **Hero.** Rejected "big headline + sample card" as the whole hero, since that's the default treatment. The map is the hero; the headline sits on it and the card is pinned to an actual street (Rruga Agim Ramadani).
- **Numbered steps.** The "how it works" section isn't numbered circles; it's the same receipt assembling as you scroll, so the sequence is shown by the object itself.

## Copy direction (samples, Albanian first, all pending native review)

- Hero: "Zëri yt. Një qytet më i mirë." (existing slogan, kept)
- Under it: "Gropa në Dardani, ndriçimi i fikur në Ulpianë, kontejnerët plot afër stacionit të autobusëve. Raporto atë që sheh, me foto dhe vendndodhje, dhe raporti shkon te departamenti që e mbulon."
- Category one-liners: see the board.
- Disclaimer, kept word for word in meaning: "Kjo platformë nuk është shërbim emergjence. Raportimi nuk garanton zgjidhjen e menjëhershme të problemit." followed by `112` as a `tel:` link.

All copy is marked for native review in `docs/redesign/copy-review.md` (created when copy work starts).
