# ProfileIntro Specification

## Overview

- **Target files:** `index.html`, `contents/home.md`, `static/css/main.css`
- **Reference evidence:** `docs/research/01.me/PAGE_TOPOLOGY.md`, `docs/research/01.me/BEHAVIORS.md`
- **Approved design:** `docs/superpowers/specs/2026-07-16-bilingual-academic-profile-design.md`
- **Interaction model:** static content + anchor navigation + link hover/focus
- **Purpose:** establish Zhu Zhenfang's identity with a fully visible vertical portrait and factual English-first bilingual biography.

## DOM Structure

```html
<main id="main-content">
  <section id="about" class="profile-intro" aria-labelledby="profile-name">
    <figure class="profile-intro__portrait">
      <img src="static/assets/img/photo.jpg" alt="Portrait of Zhu Zhenfang">
    </figure>
    <div class="profile-intro__body">
      <h1 id="profile-name">Zhu Zhenfang</h1>
      <p class="profile-intro__name-zh" lang="zh-CN">朱振方</p>
      <p class="profile-intro__role">Engineer · Entrepreneur</p>
      <p>I studied at the University of Science and Technology of China and work on software systems, developer tools, and early-stage products. This site collects my projects, notes, and current interests.</p>
      <p lang="zh-CN">我本科毕业于中国科学技术大学，目前关注软件系统、开发者工具与早期产品。本网站用于整理我的项目、笔记和近期关注的问题。</p>
    </div>
  </section>
</main>
```

- The page contains exactly one `h1`.
- English precedes Chinese within the bilingual biography pair.
- The portrait remains a semantic image with the exact descriptive alt text shown above.

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

### Profile grid

- Desktop columns: `260px minmax(0, 1fr)`
- Desktop gap: `clamp(48px, 7vw, 88px)`
- Biography text measure: no more than approximately `70ch`.
- Chinese copy may use slightly more line height than English while preserving the `1.65` body baseline.
- Any interactive link introduced from verified content uses `min-height: 44px`.

### Portrait

- Preserve the source image's vertical composition.
- Use `object-fit: contain`.
- Do not use `aspect-ratio: 1` or any square crop.
- Keep the whole portrait visible at desktop, tablet, and mobile widths.

## States & Behaviors

- The introduction has no tabs, carousel, modal, scroll-triggered state, or time-driven animation.
- Any inline link added from verified content uses accent `#1F6FAF`, hover feedback by color or underline, and a visible keyboard focus outline.
- `prefers-reduced-motion: reduce` disables nonessential transitions.

## Per-State Content

- N/A. All identity and biography content is visible at once.

## Assets

- Portrait: `static/assets/img/photo.jpg`
- Alt text: `Portrait of Zhu Zhenfang`
- No reference-site photograph, logo, layered image, decorative SVG, or generated asset is permitted.

## Bilingual Text Content (verbatim)

- English name: `Zhu Zhenfang`
- Chinese name: `朱振方`
- Role: `Engineer · Entrepreneur`
- English biography: `I studied at the University of Science and Technology of China and work on software systems, developer tools, and early-stage products. This site collects my projects, notes, and current interests.`
- Chinese biography: `我本科毕业于中国科学技术大学，目前关注软件系统、开发者工具与早期产品。本网站用于整理我的项目、笔记和近期关注的问题。`
- Do not use the word `AI` in the introduction.

## Responsive Behavior

- **Desktop (1440px):** two-column profile using `260px minmax(0, 1fr)` with gap `clamp(48px, 7vw, 88px)`; portrait at left and biography at right.
- **Tablet (768px):** retain two columns while allowing the portrait column to narrow and keeping the biography readable.
- **Mobile (390px and 375px):** portrait first and centered, followed by name, role, English biography, and Chinese biography in one column; no horizontal scrolling.
- **Breakpoint:** stack the grid at `@media (max-width: 767.98px)`.
