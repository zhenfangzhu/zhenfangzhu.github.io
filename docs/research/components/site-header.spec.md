# SiteHeader Specification

## Overview

- **Target files:** `index.html`, `static/css/main.css`
- **Reference evidence:** `docs/research/01.me/PAGE_TOPOLOGY.md`, `docs/research/01.me/BEHAVIORS.md`
- **Approved design:** `docs/superpowers/specs/2026-07-16-bilingual-academic-profile-design.md`
- **Interaction model:** static content + anchor navigation + link hover/focus
- **Purpose:** provide a light identity header and direct navigation to every supported profile section without empty destinations.

## DOM Structure

```html
<header class="site-header">
  <div class="site-container site-header__inner">
    <a class="site-brand" href="#about">Zhu Zhenfang 朱振方</a>
    <nav aria-label="Primary navigation">
      <ul class="site-nav">
        <li><a href="#about">About</a></li>
        <li><a href="#interests">Interests</a></li>
        <li><a href="#education">Education</a></li>
        <li><a href="#contact">Contact</a></li>
      </ul>
    </nav>
  </div>
</header>
```

- Keep the existing skip link before the header and point it to `#main-content`.
- The four navigation anchors map one-to-one to the four required section IDs: `about`, `interests`, `education`, and `contact`.
- Do not render `Projects`, `Writing`, `CV`, `Publications`, or `Awards` links unless verified content is supplied later.

## Planned Styles (exact values)

### Global page and container

- `max-width: 1120px`
- Body font: `Inter`, followed by system CJK fallbacks
- Body font size: `16px`
- Body line height: `1.65`
- Background: `#F7F8FA`
- Foreground: `#15181D`
- Accent/link color: `#1F6FAF`
- Border color: `#DDE3E8`

### Header and navigation

- The header remains visually light; no marketing-style oversized bar, gradient, glass effect, or heavy shadow.
- Brand and navigation links use the body/interface font and foreground color at rest.
- Navigation uses a horizontal list where space permits and may wrap without truncation.
- Every interactive anchor has `min-height: 44px` and a visible focus indicator.
- Section targets use sufficient `scroll-margin-top` so anchored headings are not obscured by the header.

## States & Behaviors

### Anchor navigation

- **Trigger:** activate the brand or one of the four navigation links.
- **Result:** navigate to the matching same-page section ID.
- **Implementation approach:** native anchors; smooth scrolling may be CSS-enhanced.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables smooth scrolling and transitions.

### Link hover and keyboard focus

- **Rest:** foreground `#15181D`.
- **Hover:** accent `#1F6FAF` and/or underline; no scale or layout shift.
- **Focus:** visible high-contrast outline; focus must not be indicated by color alone.

## Per-State Content

- N/A. Navigation does not switch content or maintain a selected application state.

## Assets

- No image, icon, SVG, or JavaScript asset is required.
- Text labels remain visible; do not replace navigation labels with icon-only controls.

## Bilingual Text Content (verbatim)

- Brand: `Zhu Zhenfang 朱振方`
- Navigation: `About`, `Interests`, `Education`, `Contact`
- The brand is the bilingual identity treatment; navigation remains concise English labels matching the section IDs.

## Responsive Behavior

- **Desktop (1440px):** brand at left and the four navigation links at right within the `1120px` container; navigation stays horizontal.
- **Tablet (768px):** preserve the brand and all four text links; allow the navigation row to wrap rather than truncate or become icon-only.
- **Mobile (390px and 375px):** header contents wrap naturally, retain all labels, keep each target at least `44px` high, and introduce no horizontal scrolling.
- **Breakpoint:** mobile layout applies at `@media (max-width: 767.98px)`.
