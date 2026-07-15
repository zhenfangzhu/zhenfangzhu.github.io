# Zhu Zhenfang Bilingual Academic Profile — Design Specification

## Goal

Rebuild the current homepage as a bilingual academic profile inspired by the information structure of `01.me/whoami/`, while using Zhu Zhenfang's own content, photograph, identity, and links. The result should feel credible, personal, and maintained by its author—not like a startup landing page or generated marketing copy.

## Reference and differentiation

The reference contributes four useful ideas:

1. a portrait beside a factual biography;
2. English and Chinese introductions presented together;
3. a compact contact strip;
4. a long-form profile organized by anchored sections.

The new site will improve on the reference with a more balanced grid, stronger Chinese typography, quieter color use, clearer chronology, better mobile spacing, and fewer heavy bordered boxes. No text, photograph, logo, or other asset from `01.me` will be copied.

## Information architecture

### Global header

- Left: `Zhu Zhenfang 朱振方`.
- Right: `About`, `Interests`, `Education`, and `Contact`.
- `Projects`, `Writing`, or `CV` appear only when real content or a real file exists. No empty navigation links.
- The header remains visually light and does not become a large marketing navbar.

### Profile introduction

- Left column: the existing portrait.
- Right column: English name, Chinese name, a short factual role line, English biography, then Chinese biography.
- Proposed role line: `Engineer · Entrepreneur`.
- Proposed English biography:

  > I studied at the University of Science and Technology of China and work on software systems, developer tools, and early-stage products. This site collects my projects, notes, and current interests.

- Proposed Chinese biography:

  > 我本科毕业于中国科学技术大学，目前关注软件系统、开发者工具与早期产品。本网站用于整理我的项目、笔记和近期关注的问题。

- The word “AI” is not used in the introduction. It may appear later where a specific interest genuinely requires it.

### Contact strip

- Visible email: `zhuzhenfang@ustc.edu`.
- GitHub: `github.com/zhuzhenfangx`.
- Links use text labels rather than icon-only controls.
- No email obfuscation or hidden display text.

### Interests

Present three compact, factual rows rather than promotional cards:

1. **Software Systems / 软件系统** — system design, infrastructure, and reliable implementation.
2. **Language Model Applications / 语言模型应用** — practical experimentation and evaluation; “AI” appears only in supporting copy if needed.
3. **Developer Tools & Open Source / 开发者工具与开源** — reusable tools, reproducible workflows, and public technical work.

These are labeled as interests, not as publications, achievements, or established research results.

### Education

- `2019–2023`
- `B.S., University of Science and Technology of China`
- `中国科学技术大学 本科`

The section uses a restrained two-column timeline on desktop and a stacked layout on mobile.

### Contact closing

A short, plain closing line in both languages invites relevant technical or product conversations. It must not use phrases such as “ambitious systems,” “high-impact ventures,” “shape the future,” or similar promotional language.

## Visual system

### Overall character

- Content-first academic profile.
- Light paper-gray background, near-black text, one restrained blue accent.
- Minimal shadows and rounded corners; no glassmorphism, gradients, oversized slogans, or decorative cards.
- Information density is higher than the current homepage but remains readable.

### Typography

- Body and interface: Inter with system CJK fallbacks.
- Display typography is limited; the name uses a strong sans-serif rather than an editorial serif headline.
- Desktop body: 16–18px, 1.65 line height, maximum text measure of roughly 70 characters.
- Chinese copy receives slightly more line height than English copy.

### Color direction

- Background: approximately `#F7F8FA`.
- Primary text: approximately `#15181D`.
- Secondary text: a WCAG-compliant slate gray.
- Accent: a calmer blue than the reference, used for links, section markers, and focus states only.
- Borders: subtle neutral gray.

### Layout

- Maximum content width: approximately 1080–1160px.
- Profile grid: portrait column plus flexible biography column.
- Portrait is vertical and fully visible; it is not forced into a square crop.
- Section rhythm follows an 8px spacing scale.

## Responsive behavior

### Desktop (1024px and above)

- Portrait and biography sit side by side.
- Contact information remains in one horizontal strip when space allows.
- Section navigation may remain sticky below the primary header.

### Tablet (768–1023px)

- The portrait column narrows while biography remains readable.
- Contact items wrap without truncating the email address.

### Mobile (below 768px)

- Portrait appears first and is centered.
- Name and biographies stack below it.
- Contact links and section navigation wrap naturally.
- Timeline dates appear above their entries.
- Minimum touch target is 44px and the page must have no horizontal scrolling at 390px and 375px.

## Interaction and accessibility

- Interactions are limited to navigation, links, and smooth anchor scrolling.
- Hover feedback uses color or underline; no layout-shifting scale effects.
- Visible keyboard focus, skip link, semantic landmarks, sequential headings, and descriptive portrait alt text remain required.
- `prefers-reduced-motion` disables smooth scrolling and transitions.
- All normal text/background pairs meet WCAG AA contrast.

## Content constraints

- Do not invent publications, awards, employers, job titles, projects, supervisors, or affiliations.
- Do not create empty `CV`, `Projects`, `Publications`, or `Writing` sections.
- A new section is added only when the user supplies verifiable content or an existing local asset/link supports it.
- The homepage is English-first within each bilingual pair, followed immediately by Chinese.

## Verification

- Automated contracts check bilingual copy, visible email, valid navigation targets, accessibility landmarks, and absence of prohibited marketing phrases.
- Visual checks are required at 1440px, 768px, 390px, and 375px.
- Compare the finished page with the saved reference screenshots for information hierarchy, not pixel identity.
- Confirm there is no horizontal overflow, broken link, empty section, console error, or mixed cached asset state.

