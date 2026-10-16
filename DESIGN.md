# Design

Navy and orange, built to be read. Chosen by the user on 2026-10-16 to replace the pale green-on-white look that was hard to read. All tokens live at the top of `src/app/globals.css`.

## Color

| Role | Token | Value |
|---|---|---|
| Sidebar | `--navy` | #13284a |
| Top bar, hero, dark tiles | `--navy-2` | #1c3863 |
| Headings | `--navy-ink` | #0f1f38 |
| Primary action, active nav | `--orange` | #f59a23 (navy text on it, never white) |
| Page background | `--bg` | #e9edf3 |
| Cards | `--paper` | #ffffff, 1px `--line` #c3cddb border |
| Card header bands, table heads | `--paper-2` | #f4f6fa |
| Body text / secondary / muted | `--ink` / `--ink-2` / `--muted` | #14233a / #3b4a60 / #56667d |
| Input borders | `--line-strong` | #7b8ca4 |
| Focus ring | `--focus` | #2563eb, 3px |
| States | green / amber / red / blue with `-soft` fills | success, draft/queued, error, info |

## Type

One family for everything: Atkinson Hyperlegible Next (Google Fonts), drawn for low-vision readers. Body 16px; nothing below 13px (nav section labels only). h1 32px, h2 22px, h3 18px, all weight 700-800. Numbers use tabular figures.

## Components

- Buttons: orange fill with navy text, 46px tall; secondary is white with a 1.5px border; text buttons are underlined in orange.
- Panels: white, 12px radius, visible border, soft shadow; the first `.panel-heading` becomes a tinted header band.
- Badges: pill, colored fill and border per status.
- Inputs: 48px tall, 1.5px border, blue focus ring.
- Sidebar navy; the active item is a full orange pill.

## Rules

- Never white text on orange (fails contrast).
- No eyebrow labels above headings, no thick colored edge borders on rounded cards, no glow decorations.
- Mobile (≤720px): sidebar becomes a drawer, grids collapse to one column.
