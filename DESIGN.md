---
name: Amazon Afiliado / Ivethskin Finds
description: Two separate worlds. The private app is navy and orange, built to be read. The public shop (ivethskin.com, src/app/finds) is a paint-chip rack. Tokens prefixed finds- apply only to the public shop.
colors:
  navy: "#13284a"
  navy-2: "#1c3863"
  navy-ink: "#0f1f38"
  orange: "#f59a23"
  orange-hover: "#e2840a"
  bg: "#e9edf3"
  paper: "#ffffff"
  paper-2: "#f4f6fa"
  ink: "#14233a"
  ink-2: "#3b4a60"
  muted: "#56667d"
  line: "#c3cddb"
  line-strong: "#7b8ca4"
  focus: "#2563eb"
  finds-ink: "#16161b"
  finds-ink-2: "#4a4a55"
  finds-wall: "#ffffff"
  finds-rule: "#e6e4ea"
  finds-foot-text: "#d9d8de"
  finds-skincare-pale: "#fde4e6"
  finds-skincare-tone: "#f4adb6"
  finds-skincare-deep: "#741c30"
  finds-beauty-pale: "#fbe0f1"
  finds-beauty-tone: "#ec9fd0"
  finds-beauty-deep: "#6a1048"
  finds-wellness-pale: "#e2f0de"
  finds-wellness-tone: "#9fcd95"
  finds-wellness-deep: "#1c4526"
  finds-home-pale: "#fbf0c9"
  finds-home-tone: "#f2cd55"
  finds-home-deep: "#4f3a04"
  finds-kitchen-pale: "#fde3d6"
  finds-kitchen-tone: "#f6a582"
  finds-kitchen-deep: "#6b2410"
  finds-fashion-pale: "#ece5fb"
  finds-fashion-tone: "#b9a3ef"
  finds-fashion-deep: "#33206a"
  finds-fitness-pale: "#d8f3ec"
  finds-fitness-tone: "#74d3bf"
  finds-fitness-deep: "#0c4339"
  finds-tech-pale: "#e0e8fd"
  finds-tech-tone: "#93b1f4"
  finds-tech-deep: "#152f6b"
  finds-baby-pale: "#ffead8"
  finds-baby-tone: "#ffc28f"
  finds-baby-deep: "#653608"
  finds-pets-pale: "#f3e7dc"
  finds-pets-tone: "#d5aa83"
  finds-pets-deep: "#4a2b12"
  finds-gifts-pale: "#ffe1df"
  finds-gifts-tone: "#ff978c"
  finds-gifts-deep: "#741515"
typography:
  body:
    fontFamily: "Atkinson Hyperlegible Next, Atkinson Hyperlegible, Segoe UI, Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.55
  finds-display:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(40px, 9vw, 80px)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.035em"
  finds-headline:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(28px, 6vw, 46px)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.03em"
  finds-title:
    fontFamily: "Bricolage Grotesque, system-ui, sans-serif"
    fontSize: "clamp(17px, 2.2vw, 20px)"
    fontWeight: 700
    lineHeight: 1.12
    letterSpacing: "-0.015em"
  finds-body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  finds-label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: "0.02em"
    fontFeature: "tnum"
rounded:
  panel: "12px"
  finds-chip: "6px"
  finds-flag: "4px"
  finds-pill: "999px"
spacing:
  finds-gutter: "16px"
  finds-gap-sm: "14px"
  finds-gap-lg: "22px"
  finds-container: "1180px"
components:
  finds-cta:
    backgroundColor: "{colors.finds-ink}"
    textColor: "{colors.finds-wall}"
    padding: "13px 12px"
  finds-cta-big:
    backgroundColor: "{colors.finds-ink}"
    textColor: "{colors.finds-wall}"
    rounded: "{rounded.finds-chip}"
    padding: "16px 18px"
  finds-chip:
    backgroundColor: "{colors.finds-skincare-tone}"
    textColor: "{colors.finds-skincare-deep}"
    rounded: "{rounded.finds-chip}"
    padding: "12px 12px 0"
  finds-chip-fresh:
    backgroundColor: "{colors.finds-skincare-deep}"
    textColor: "{colors.finds-wall}"
    rounded: "{rounded.finds-chip}"
  finds-tab:
    backgroundColor: "{colors.finds-wall}"
    textColor: "{colors.finds-ink}"
    rounded: "{rounded.finds-pill}"
    padding: "7px 12px 7px 9px"
  finds-tab-current:
    backgroundColor: "{colors.finds-skincare-deep}"
    textColor: "{colors.finds-wall}"
    rounded: "{rounded.finds-pill}"
  finds-ad-bar:
    backgroundColor: "{colors.finds-ink}"
    textColor: "{colors.finds-wall}"
    padding: "8px 16px"
---

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

---

## Public shop: Ivethskin Finds

Everything below applies only to the public shop at ivethskin.com (`src/app/finds`). It is a separate visual world. It does not change the private app above, and the private app does not borrow from it. The tokens are scoped to the `.page` wrapper in `src/app/finds/finds.module.css`, the fonts are loaded in `src/app/finds/layout.tsx`, and the category families live in `src/app/finds/ui.tsx`. In the frontmatter every token for this world starts with `finds-`.

### Overview

**Creative North Star: "The Paint-Chip Rack"**

Each kind of find is a color family, and each product is a numbered chip pulled from that family's strip. The page is a white wall with near-black ink. Color carries the navigation: you pick a color first, then a product. Categories are laid down at full strength in three shades and never tinted down or mixed. One heavy grotesque names things and one plain grotesque prints the small print. Photos sit on top of every chip, and every chip ends with an ink bar that goes to the store.

**Key Characteristics:**
- White wall (`finds-wall`), near-black ink (`finds-ink`), and eleven three-shade category families (pale, tone, deep).
- One chip module repeated across the page as the unit of measure: square photo, tone body, short name, chip number, facts, ink CTA bar.
- Every product carries a chip number in tabular figures (`IF 001`).
- The disclosure bar is always the first thing on the page, and the disclosure repeats in the footer.

### Colors

A neutral wall and ink, with all the color coming from the category families.

#### Neutral
- **Rack Ink** (`finds-ink`): text, the disclosure bar, the CTA bar, the footer ground, focus outlines, text selection.
- **Soft Ink** (`finds-ink-2`): the lede line under the headline only.
- **White Wall** (`finds-wall`): page ground, photo ground, text on ink and on deep shades.
- **Rack Rule** (`finds-rule`): tab outlines and the hairline under the sticky tabs.
- **Footer Grey** (`finds-foot-text`): footer body text on ink.

#### Category families (pale / tone / deep)
Skincare (rose), Beauty (orchid), Wellness (sage), Home (mustard), Kitchen (apricot), Fashion (lavender), Fitness (mint), Tech (cornflower), Baby & Mom (peach), Pets (camel), Gifts (coral). Values are the `finds-<family>-pale|tone|deep` tokens. A category not in the table falls back to Gifts. Each family is applied through three inline custom properties (`--pale`, `--tone`, `--deep`) on the element that owns it.
- **Pale**: the top block of a rack strip and the ground of the label call-out.
- **Tone**: chip bodies, section bands, product panels, the middle block of a strip, tab swatches, and the footer's color rack.
- **Deep**: text on pale and tone, the bottom block of a strip, the "New" flag, fact bullets, the CTA hover, and the newest chip's body.

#### Named Rules
**The Three-Shade Rule.** A category uses only its own pale, tone and deep, at full strength. Text on pale or tone is always that family's deep. Text on deep is always white. Adding a category means adding a whole family (all three shades, with the deep passing contrast on both lighter shades) to `ui.tsx`, never one loose color.

**The One Reserved Accent Rule.** Among the tabs, only the strip on screen gets filled: deep background, white text. "All" holds that fill above the first section. No other control gets that filled-tab look.

**The Ink Basin Rule.** The newest finds (at most two, for 21 days) wear their family's deep shade as the chip body, with a tone-colored "New" flag. Every other chip uses the tone.

### Typography

**Display Font:** Bricolage Grotesque (fallback system-ui, sans-serif), via `--display`
**Body Font:** Hanken Grotesk (fallback system-ui, sans-serif), via `--text`

**Character:** A heavy, slightly quirky grotesque for names, tightly tracked, paired with a quiet grotesque for facts and fine print. Both fonts are served by the site through next/font.

#### Hierarchy
- **Display** (`finds-display`): the single home headline, balanced, max 12ch.
- **Headline** (`finds-headline`): category band names. On the desktop shelf they shrink to clamp(24px, 2.3vw, 30px). The product-page name uses the same face at 800, clamp(32px, 5vw, 52px), and "More in" headings use clamp(26px, 4.5vw, 36px).
- **Title** (`finds-title`): chip names. Rack-strip names use the same face at 700, 17px (19px from 720px).
- **Body** (`finds-body`): lede 17px max 44ch, facts 14px (16px in the call-out), product description 15px max 60ch, disclosure and notes 13px.
- **Label** (`finds-label`): chip numbers, set in tabular figures. CTA bars and tabs use 600 to 700 weight at 14px.

#### Named Rules
**The Numbered Chip Rule.** Every product shows its chip number (`IF` plus three digits, tabular figures) directly after its name, never above it.

### Layout

Content sits in a centered container (`finds-container`) with 16px gutters. On a phone the rack scrolls sideways with snap (strips 140px to 300px, 10px gap, scrollbar hidden). Category sections stack as full-width tone bands, each over a two-column chip grid (14px gap), and a lone chip takes the whole row. From 720px the sections become one shelf: an auto-fill grid of columns at least 260px wide with 22px gaps. Each column is a rounded band over a single column of chips, and a category with four or more chips spans two columns. The sticky tabs (white at 96%, hairline below) sit under the rack. On the product page, from 860px, photos and a sticky panel split 1.25fr to 1fr with a 28px gap, and the first photo spans the full width of its two-column photo grid. Breakpoints are 720px, 860px and 1080px; the related-chip grid goes 2, then 3, then 4 columns.

### Elevation & Depth

The wall is flat. Only physical chips and strips lift off it.

#### Shadow Vocabulary
- **Lift** (`0 1px 2px rgb(22 22 27 / 0.08), 0 10px 22px -14px rgb(22 22 27 / 0.35)`): resting chips and rack strips.
- **Pulled** (`0 2px 4px rgb(22 22 27 / 0.1), 0 24px 32px -16px rgb(22 22 27 / 0.4)`): a rack strip on hover, which also rises 10px.

#### Named Rules
**The Pulled Chip Rule.** Depth means "this can be pulled from the rack." Bands, panels, tabs and the call-out stay flat. Motion uses `cubic-bezier(0.16, 1, 0.3, 1)` (0.45s for strips, 0.6s for the 1.04 photo zoom on hover), and both are removed under reduced motion.

### Shapes

Corners are gently rounded at 6px on chips, strips, bands, product panels, photos and the big CTA. The "New" flag uses 4px, tabs are full pills, tab swatches use 3px, wordmark chips 2px, and fact bullets are tiny 6px squares. The one hard-edged shape is the label call-out: square corners, a 2px deep border, and two 12px solid deep corner blocks (top-left and bottom-right), like a parts call-out.

### Components

#### CTA bar ("See it on {store}")
Full-bleed ink bar at the foot of each chip: white 700 14px text and a 16px stroked arrow at the far end. On hover it fills with the family's deep shade (pure black on a newest chip). On the product page it becomes a standalone 6px-rounded button at 17px. Store links always carry `rel="sponsored nofollow noopener noreferrer"`.

#### Chip
Square photo on white, then a tone body holding the name, chip number, fact list and CTA bar. The photo and name link to the product page. The newest chips follow the Ink Basin Rule.

#### Rack strip
Three stacked blocks in one family. Pale holds the category name, tone holds the product names (clamped to two lines), and deep holds the count and a down arrow in white. Strips are tall from 720px.

#### Tabs (navigation)
Sticky row of outlined pills (1px rule border), each with a 12px tone swatch and the short family name. Hover darkens the border to ink. The current tab follows the One Reserved Accent Rule, and its swatch gets a 2px white ring.

#### Label call-out
Pale box on the product panel with the 2px deep border and corner blocks, headed "On the label" in 700 14px body type, listing the facts at 16px.

#### Disclosure bar and footer
A centered ink bar of 13px white text at the top of every page. The footer is ink, topped by a 10px color rack made of the tones of the categories present, with bold white social links and the full disclosure.

#### Wordmark
Four 8 by 18px tone chips followed by "Ivethskin Finds" in 800 16px display type.

### Do's and Don'ts

#### Do:
- **Do** set every category element's colors through `--pale`, `--tone` and `--deep` from the `ui.tsx` families.
- **Do** keep the disclosure bar first on every page and repeat it in the footer.
- **Do** end every chip with the ink CTA bar and show its chip number in tabular figures.
- **Do** keep focus visible: 3px ink outline, 3px offset.
- **Do** keep finds styles scoped under the `.page` wrapper so they never leak into the private app, and keep neutralizing the private app's global nav, main, footer and heading styles there.

#### Don't:
- **Don't** use the private app's navy, orange or Atkinson Hyperlegible anywhere in the public shop, and don't use finds tokens in the private app.
- **Don't** tint, blend or gradient a family, or put a second family's color inside a category.
- **Don't** fill any control other than the current tab with the deep accent.
- **Don't** add prices, sale badges or red deal styling. The only flag is "New".
- **Don't** put labels or chip numbers above headings.
