# 01.me `/whoami/` — Behavior Notes

## Viewports inspected

- Desktop: 1440 × 1000
- Mobile: 390 × 844

## Global observations

- Native document scrolling; no Lenis or Locomotive-style smooth-scroll runtime detected.
- No horizontal overflow at either inspected viewport.
- The page is content-led and largely static.
- Primary interactions are ordinary links and same-page anchors.
- No carousel, modal, tab state, parallax, scroll-snap, or scroll-triggered content switch was observed.

## Responsive observations

- Desktop uses a portrait-and-biography two-column profile.
- At 390px the portrait appears above the name and biography.
- Mobile portrait measured approximately 160 × 240px at x=22px.
- Mobile H1 measured 36px and occupied the full content width below the portrait.
- Utility navigation remains visible and wraps rather than becoming an icon-only menu.

## Extracted visual foundation

- Body background: `rgb(247, 248, 250)`.
- Body foreground: `rgb(21, 24, 29)`.
- Body typeface: Inter with system and CJK fallbacks.
- Body size/line-height: 16px / 25.6px.
- H1: 36px, weight 800.
- Section H2: 22px, weight 800.
- Reference page contains one portrait image and no essential layered visual assets.

## Adaptation decision

The new homepage will preserve the reference's static, readable interaction model. It will improve typography, spacing, section chronology, and mobile composition without adding ornamental motion.

