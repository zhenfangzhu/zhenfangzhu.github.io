# ContactStrip Specification

## Overview

- **Target files:** `index.html`, `contents/home.md`, `static/css/main.css`
- **Reference evidence:** `docs/research/01.me/PAGE_TOPOLOGY.md`, `docs/research/01.me/BEHAVIORS.md`
- **Approved design:** `docs/superpowers/specs/2026-07-16-bilingual-academic-profile-design.md`
- **Interaction model:** static content + anchor navigation + link hover/focus
- **Purpose:** expose direct, truthful contact routes and a restrained bilingual invitation without icon-only controls or hidden email text.

## DOM Structure

```html
<section id="contact" class="profile-contact" aria-labelledby="contact-title">
  <h2 id="contact-title">Contact / 联系方式</h2>
  <div class="contact-strip">
    <a href="mailto:zhuzhenfang@ustc.edu">zhuzhenfang@ustc.edu</a>
    <a href="https://github.com/zhuzhenfangx" target="_blank" rel="noopener noreferrer">github.com/zhuzhenfangx</a>
  </div>
  <p>For relevant technical or product conversations, feel free to get in touch.</p>
  <p lang="zh-CN">欢迎就相关技术或产品问题与我交流。</p>
</section>
```

- `id="contact"` is the target of `href="#contact"` in the primary navigation.
- The visible email exactly matches the `mailto:` address.
- The external GitHub link includes `rel="noopener noreferrer"` when opened in a new tab.

## Planned Styles (exact values)

### Global page and container

- Container `max-width: 1120px`
- Body font: `Inter`, followed by system CJK fallbacks
- Body font size: `16px`
- Body line height: `1.65`
- Background: `#F7F8FA`
- Foreground: `#15181D`
- Accent/link color: `#1F6FAF`
- Border color: `#DDE3E8`

### Contact strip

- Compact bordered horizontal surface using `#DDE3E8`.
- Text labels are always visible; no icon-only controls and no email obfuscation.
- Contact items remain on one horizontal row on desktop when space allows.
- Links have `min-height: 44px` and sufficient inline spacing for distinct touch targets.

## States & Behaviors

### Email link

- **Trigger:** activate `zhuzhenfang@ustc.edu`.
- **Result:** open the user's mail handler through `mailto:zhuzhenfang@ustc.edu`.

### GitHub link

- **Trigger:** activate `github.com/zhuzhenfangx`.
- **Result:** open `https://github.com/zhuzhenfangx` safely in a new tab.

### Link hover and keyboard focus

- **Rest:** accent `#1F6FAF`.
- **Hover:** underline and/or a restrained color change; no scaling or layout shift.
- **Focus:** visible high-contrast outline, not color alone.
- **Reduced motion:** `prefers-reduced-motion: reduce` disables transitions.

## Per-State Content

- N/A. Contact information is never hidden behind a tab, disclosure, hover, or icon.

## Assets

- No image, icon, SVG, or JavaScript asset is required.
- Do not add email or GitHub icons unless text labels remain present.

## Bilingual Text Content (verbatim)

- Heading: `Contact / 联系方式`
- Email label: `zhuzhenfang@ustc.edu`
- GitHub label: `github.com/zhuzhenfangx`
- English closing: `For relevant technical or product conversations, feel free to get in touch.`
- Chinese closing: `欢迎就相关技术或产品问题与我交流。`
- The closing must remain factual and must not use `ambitious systems`, `high-impact ventures`, `shape the future`, or similar promotional phrasing.

## Responsive Behavior

- **Desktop (1440px):** email and GitHub remain in one horizontal strip when space allows.
- **Tablet (768px):** contact items may wrap; the email address remains complete and untruncated.
- **Mobile (390px and 375px):** stack or wrap links naturally, preserve `44px` minimum touch targets, and prevent horizontal scrolling.
- **Breakpoint:** mobile layout applies at `@media (max-width: 767.98px)`.
