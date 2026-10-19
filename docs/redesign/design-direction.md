# Design direction — "Civic Evidence", draft 2 (friendlier)

For review before any implementation. Visual board: `docs/redesign/direction-board.html` (open it in a browser; the map uses real Prishtina street geometry, © OpenStreetMap contributors, ODbL).

Draft 1 felt too formal (sharp corners, tall condensed headlines, a serif, paper grain, gold buttons). Draft 2 keeps the original site's friendliness (blue actions, rounded shapes, clean light ground, one sans family) and keeps the parts that are specific to kosova.report.

## The idea in one line

A report should feel like a **receipt from the city**: a friendly slip that gets a category badge, a pin, clipped photos and your words, then a gold stamp and a tear-off key stub. That object is the memorable thing; the rest stays calm and familiar.

## Languages

Albanian (`sq`, default), Serbian **Latin only** (`sr`), English (`en`). No Cyrillic. Paths `/sq/…`, `/sr/…`, `/en/…`; hreflang `sq`, `sr-Latn`, `en`, plus `x-default`.

## Colour

Tokens in `oklch()`, hex values are sRGB approximations.

| Token | Light | Dark | Role | Contrast |
| --- | --- | --- | --- | --- |
| `ink` | `oklch(0.265 0.085 258)` ≈ `#06244d` | `oklch(0.95 0.01 250)` | Text, wordmark. The current `#062653`, kept. | 14.6:1 on page |
| `blue` | `oklch(0.47 0.19 262)` ≈ `#154fc3` | `oklch(0.72 0.13 262)` ≈ `#77a4f6` | Buttons and links. Close to the original `#0843b5`. | white on it 7.1:1 (AAA); navy on dark blue 7.2:1 |
| `wash` | `oklch(0.95 0.028 255)` ≈ `#e2f0ff` | `oklch(0.25 0.05 258)` | Hero band, key box, soft fills. Echoes the original blue-50 gradient. | navy on it 13.3:1 |
| `paper` | `oklch(0.982 0.006 255)` ≈ `#f6f9fd` | `oklch(0.205 0.045 258)` ≈ `#09172b` | Page ground | — |
| `card` | white | `oklch(0.27 0.05 258)` | The receipt, tiles | — |
| `pencil` | `oklch(0.48 0.035 258)` ≈ `#515e72` | `oklch(0.78 0.03 250)` | Secondary text, coordinates | 6.2:1 |
| `gold` | `oklch(0.80 0.125 84)` ≈ `#e4b756` | `oklch(0.82 0.13 84)` | Pin, wordmark dot. Kept small. | decorative |
| `stamp` | `oklch(0.53 0.105 72)` ≈ `#916016` | `oklch(0.80 0.12 82)` | The official stamp only | 5.0:1 on white |

Red is only for errors, because this is not an emergency service.

**Category accents** (always with icon + label; light values all ≥4.6:1 on white). Each also gets an 11% tint used behind its icon.

| Category | Light | Source |
| --- | --- | --- |
| Infrastrukturë | `oklch(0.55 0.13 48)` | rust, road works |
| Mjedis | `oklch(0.52 0.11 148)` | Gërmia green |
| Shërbime publike | `oklch(0.52 0.09 215)` | water mains |
| Administratë | `oklch(0.49 0.11 302)` | stamp-pad violet |
| Shëndetësi | `oklch(0.53 0.13 18)` | muted brick, not alarm red |
| Arsim | `oklch(0.54 0.10 105)` | school-desk olive |
| Siguri | `oklch(0.52 0.08 240)` | steel blue |

**Dark mode** is a navy page with light ink, not an inversion; blue lightens and takes navy text. **Sunlight mode** (one tap) goes to pure white, darkest ink, medium weight body text, outlined buttons, no tints.

## Type

One family: **Sofia Sans** (variable, OFL) for headlines (800, tight tracking), interface and reading text, with tabular figures for report numbers and dates. Its narrow sibling **Sofia Sans Extra Condensed** 900 appears only on the stamp and the key stub, where caps are the real vernacular. Both render ë, ç, č, ć, đ, š, ž well. Self-hosted via `next/font/local`, subset to Latin + Latin Extended. The PDF uses static instances of the same faces.

Fluid scale with `clamp()`: 14 / 16 / 18 / 22 / 28 / 36 / 52 / 76 px at the top end. Body never under 16 px, line-height 1.55–1.6. Headlines in sentence case.

## Shape and layout

- Radii: 10 px (small controls, icon tiles), 14 px (buttons, tiles, choice rows), 22 px (receipt, map panel), pill for toggles.
- Soft blue-tinted shadows, used only on the receipt, the map panel and the primary button.
- Mobile (designed at 360 px): one left-aligned column, primary action in a sticky bottom bar, the receipt peeks from the top of the report flow.
- Desktop: asymmetric 7/6 grid; the receipt lies on the right, rotated −1.5°.

## Wordmark

`kosova.report` in Sofia Sans 800, lowercase, the full stop replaced by a small gold map pin (also the favicon and app icon).

## Signature moments

Same six as draft 1, softened: map draw-in on the landing page, category badge stamp, pin drop with coordinates, photo clip, the submission stamp with the tearing key stub (under 1.2 s, skippable), and a cross-fade on language switch. Every one has a reduced-motion fallback.

## Copy (samples, Albanian first, pending native review)

- Hero: "Zëri yt. Një qytet më i mirë." (existing slogan)
- Under it: "Gropa në Dardani, ndriçimi i fikur në Ulpianë, kontejnerët plot afër stacionit të autobusëve. Raporto atë që sheh, me foto dhe vendndodhje, dhe raporti shkon te departamenti që e mbulon."
- Disclaimer with `112` as a `tel:` link, visible in the hero and footer.
