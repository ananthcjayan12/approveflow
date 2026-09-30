# Design system

## Principles

- **Calm and clear.** Neutral surfaces, one brand colour, colour used for meaning (amber = waiting, red = changes
  needed, green = approved).
- **Work first.** The review stage is dark and quiet so the client's artwork is the brightest thing on screen.
- **Any device.** Everything works with mouse, touch and pen; touch targets are at least 40 px; inputs are 16 px on
  touch devices so iOS never zooms the page.
- **Accessible by default.** All text/background token pairs meet WCAG AA. Interactive elements are keyboard
  operable and every icon-only control has a label.

## Tokens and theming

`apps/web/src/styles/tokens.css` defines every colour, radius, shadow and z-index. Dark mode swaps the tokens under
`:root[data-theme="dark"]` (and follows `prefers-color-scheme` when the user has not chosen). Components never
hard-code a colour, so a new theme is a token swap. The user's choice is stored in `localStorage` (`af-theme`) and
applied before first paint by a tiny inline script in `index.html`.

Stylesheets are split by concern and imported from `styles/index.css`: `tokens`, `base`, `components`, `app`
(shell and agency pages), `review` (the review workspace) and `marketing` (landing and auth).

## Breakpoints

| Width | Layout |
|---|---|
| ≥ 1101 px | Full sidebar |
| 761–1100 px | Icon-rail sidebar |
| ≤ 760 px | Top bar + bottom tabs with a centred “Send” action; dialogs become bottom sheets |
| ≥ 900 px (review) | Media stage beside a comments panel |
| < 900 px, portrait or tall (review) | Media stage with a bottom sheet for comments |
| Short landscape, ≤ 520 px tall (a phone held sideways) | Side by side again, with the markup tools moved into the panel and every row of chrome compacted |

### Phones

The media is the point, so on a phone every row of chrome has to earn its place:

- The designer's asset page becomes a **full-screen viewer**: one slim top bar (back, title, status, ⋯ menu) replaces the
  app header, page heading and tab bar.
- The client page shows the current item in the header line ("3 of 6 · Reel — clinic story") instead of a separate title bar.
- **Writing a comment tucks away the item strip and the Approve buttons**, so the picture keeps its size while you type.
  A compose bar that opened by itself (after a mark or a selected portion) closes itself again once nothing is left to
  comment on; one you opened on purpose (Add comment, a pin, clicking into the box) stays until you close it.
- The comment box is chat-style, with a round send button beside it. Colour and undo appear only when a drawing tool is selected.

## Review workspace

`components/FeedbackPanel.tsx` orchestrates the workspace and is shared by the client's review page and the
designer's asset page.

| File | Responsibility |
|---|---|
| `review/Annotator.tsx` | Zoom/pan viewport, pointer-based drawing for every tool (mouse, touch, pen), pinch, badges |
| `review/MarkupToolbar.tsx` | Tool picker, colour and thickness, undo; shapes collapse into one button on phones |
| `review/VideoStage.tsx` | Video clock, timeline with comment markers, drag-to-select portions, transport bar, shortcuts |
| `review/CommentsPanel.tsx` | Comment list (with the portion filter) and the composer |
| `lib/annotations.ts` | Shape model, geometry, persistence, and building the API payload |
| `lib/timeline.ts` | Time formatting, portion overlap, marker lane assignment |
| `lib/viewport.ts` | Zoom/pan maths |

The logic in `lib/` is pure and unit-tested; the components stay thin.

### Notes for contributors

- Drawing surfaces must set `touch-action: none`, otherwise browsers cancel the gesture the moment they decide a
  drag is a scroll.
- When testing layouts, use a *portrait* reel and a phone-sized viewport that already accounts for the browser's own bars
  (about 430×750 for a large iPhone): a landscape clip on a tall screen hides the problem.
- Video seeks use `currentTime`, never `fastSeek()`: keyframe snapping would make comment timestamps inexact.
- Shortcut handlers ignore Space/Enter only when a control was reached with the keyboard (`keyboardOwnsControl`),
  so clicking a thumbnail and then pressing Space still plays the video.
