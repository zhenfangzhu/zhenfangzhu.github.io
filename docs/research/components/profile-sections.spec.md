# ProfileSections Specification

## Overview

- **Target files:** `index.html`, `contents/home.md`, `static/css/main.css`
- **Reference evidence:** `docs/research/01.me/PAGE_TOPOLOGY.md`, `docs/research/01.me/BEHAVIORS.md`
- **Approved design:** `docs/superpowers/specs/2026-07-16-bilingual-academic-profile-design.md`
- **Interaction model:** static content + anchor navigation + link hover/focus
- **Purpose:** present supported interests and education as compact factual lists, without implying publications, awards, employment, or established research results.

## DOM Structure

```html
<section id="interests" aria-labelledby="interests-title">
  <h2 id="interests-title">Interests / 兴趣方向</h2>
  <ul class="interest-list">
    <li>...</li>
    <li>...</li>
    <li>...</li>
  </ul>
</section>

<section id="education" aria-labelledby="education-title">
  <h2 id="education-title">Education / 教育经历</h2>
  <ol class="education-list">
    <li>
      <time>2019–2023</time>
      <div>...</div>
    </li>
  </ol>
</section>
```

- `id="interests"` and `id="education"` are direct targets of matching primary-navigation links.
- `.interest-list` contains exactly three factual rows.
- `.education-list` contains the one verified education entry and uses semantic chronology.
- Do not add empty or invented `focus`, `highlights`, `publications`, `awards`, employer, project, supervisor, or affiliation sections.

## Planned Styles (exact values)

### Global page and container

- Container `max-width: 1120px`
- Body font: `Inter`, followed by system CJK fallbacks
- Body font size: `16px`
- Body line height: `1.65`
- Background: `#F7F8FA`
- Foreground: `#15181D`
- Accent: `#1F6FAF`
- Border: `#DDE3E8`

### Interest list

- Three compact factual rows, separated by subtle `#DDE3E8` borders.
- No promotional cards, heavy shadows, gradients, glass effects, or ornamental animation.
- Bilingual labels lead each row; supporting copy follows in plain language.

### Education list

- Restrained two-column timeline on desktop: date column followed by degree/institution content.
- Chronology is explicit through the visible date `2019–2023`.
- English precedes Chinese inside the education entry.

### Interactive elements

- Any verified inline link has `min-height: 44px`, accent `#1F6FAF`, non-shifting hover feedback, and visible keyboard focus.

## States & Behaviors

- Both sections are fully visible static content reached by native anchor navigation.
- There are no tabs, accordions, cards that reveal hidden content, carousel, parallax, scroll-triggered state, or time-driven animation.
- Link hover uses color or underline without scale effects.
- `prefers-reduced-motion: reduce` disables smooth scrolling and transitions.

## Per-State Content

- N/A. Interests and education have no alternate UI states.

## Assets

- No image, video, icon, SVG, or JavaScript asset is required.
- List structure and typography carry the hierarchy.

## Bilingual Text Content (verbatim)

### Interests

1. `Software Systems / 软件系统` — `system design, infrastructure, and reliable implementation.`
2. `Language Model Applications / 语言模型应用` — `practical experimentation and evaluation.`
3. `Developer Tools &amp; Open Source / 开发者工具与开源` — `reusable tools, reproducible workflows, and public technical work.`

- Label the section and rows as interests, not publications, achievements, or established research results.
- The term `AI` may appear only in specific supporting copy when genuinely needed; avoid it in the row labels above.

### Education

- Date: `2019–2023`
- English: `B.S., University of Science and Technology of China`
- Chinese: `中国科学技术大学 本科`

## Responsive Behavior

- **Desktop (1440px):** lists use the `1120px` page container; education is a restrained two-column timeline with the date beside the entry.
- **Tablet (768px):** preserve readable list rows; allow spacing to tighten without truncating bilingual labels.
- **Mobile (390px and 375px):** list rows remain single-column; education dates appear above their entries; no horizontal scrolling.
- **Breakpoint:** stacked mobile behavior applies at `@media (max-width: 767.98px)`.
