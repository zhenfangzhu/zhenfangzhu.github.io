# Leerob-Inspired Homepage Specification

## Overview
- Target files: `index.html`, `static/css/home.css`
- Screenshots: captured locally during QA and excluded from the public repository
- Interaction model: static content, anchor navigation, hover fades, local language toggle

## DOM Structure
- `main.site-shell`
  - `article.content-frame`
    - `div.home-layout`
      - `div.home-copy`
        - `h1.site-title`
        - `section.bio-section`
        - `section.world-section#reality` containing focus, education, tools, and contact
        - `section.world-section.dream-section#dreams` containing the dream statement and archive link
        - `footer.home-footer`
      - `aside.home-visual` with the existing portrait

## Computed Styles

### Global
- background: `#ffffff`
- reading color: `#282828`
- secondary color: `#504945`
- navigation color: `#676767`
- divider: `color-mix(in srgb, #282828 10%, transparent)` with `#e2e2df` fallback
- font: `"Iowan Old Style", "Palatino Linotype", Palatino, Georgia, serif`
- body font size: `17px`
- body line height: `1.6`

### Page shell
- padding: `clamp(1.25rem, 3.4vw, 3.25rem)`
- min-height: `100vh`

### Content frame
- reading width: `600px`
- width: `min(100%, 600px)`
- centered with `margin-inline: auto`

### Desktop layout
- breakpoint: `1100px`
- total width: `min(100cqi, 1500px)`
- columns: `minmax(0, 1.75fr) minmax(380px, 1fr)`
- gap: `clamp(2rem, 3.6vw, 3.75rem)`
- portrait: sticky, top equal to page padding, height `calc(100svh - 2 * page padding)`

### Title
- font size: `clamp(2.2rem, 3.5vw, 2.65rem)`
- weight: `600`
- line height: `1.15`
- letter spacing: `-0.02em`
- margin bottom: `0.95em`

### Section headings
- top-level: `1.45rem`, weight `600`, line-height `1.4`, letter-spacing `-0.02em`
- nested labels: `14px` UI/system font, muted color

### Rows
- top and bottom borders: `1px solid` subtle line
- grid: `minmax(0, 1fr) auto`
- gap: `1.25rem`
- padding: `0.72em 0`
- metadata: `13-14px` UI/system font, muted color

## States & Behaviors
- Language button toggles existing `[data-lang]` elements and persists the choice.
- In-page links jump to Reality or Dreams; no mode is stored and no content is hidden by world.
- On hover-capable pointers, sibling index rows fade to `0.72`; hovered row remains `1`.
- All interactive elements have a 2px focus outline with 3px offset.
- Reduced motion sets transition duration to `0.01ms`.

## Assets
- Portrait: `static/assets/img/photo.jpg`
- No assets from the reference site are published.

## Text Content
- Preserve the existing factual biography, focus areas, education, tools, email, and GitHub address.
- Move `Loading… 99%` out of Tools and make it the only entry in the Dreams world.
- Condense the existing manifesto into a short introduction without removing its central idea.

## Responsive Behavior
- Desktop 1440px: two columns with a 600px reading column and sticky portrait.
- Tablet 768px: single centered reading column.
- Mobile 390px: 20px page padding; index rows stack; portrait hidden.
