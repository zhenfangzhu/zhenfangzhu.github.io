# Bilingual Academic Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current marketing-style homepage with a factual, bilingual academic profile inspired by the information structure of `01.me/whoami/` and tailored to Zhu Zhenfang's verified content.

**Architecture:** Keep the existing static GitHub Pages architecture: semantic structure in `index.html`, asynchronously loaded content in the three files under `contents/`, site behavior in `static/js/scripts.js`, and the bespoke visual system in `static/css/main.css`. Preserve Bootstrap only for its responsive navigation primitives; do not introduce a build system or framework. Treat the saved reference screenshots and component specifications as visual contracts, then verify the result in a real browser at four widths.

**Tech Stack:** HTML5, CSS3, vanilla JavaScript, Bootstrap 5 runtime, Marked, js-yaml, Python `unittest`, GitHub Pages.

## Global Constraints

- The homepage is English-first within each bilingual pair, followed immediately by Chinese.
- Do not invent publications, awards, employers, job titles, projects, supervisors, or affiliations.
- Do not create empty `CV`, `Projects`, `Publications`, or `Writing` sections.
- Keep `zhuzhenfang@ustc.edu` fully visible and clickable.
- Use the existing portrait; keep its natural vertical composition rather than forcing a square crop.
- Use a paper-gray background, near-black text, one restrained blue accent, minimal shadows, and no gradients or glassmorphism.
- Do not use promotional phrases such as “ambitious systems,” “high-impact ventures,” or “shape the future.”
- Normal text/background pairs must meet WCAG AA; interactive targets are at least 44px high.
- The page must have no horizontal overflow at 1440px, 768px, 390px, or 375px.
- Preserve canonical URLs for `https://zhuzhenfangx.github.io/` until a custom domain is actually connected.

## File Structure

- `index.html` — semantic page shell, global navigation, profile introduction, section containers, contact strip, and footer.
- `contents/home.md` — bilingual About copy.
- `contents/publications.md` — bilingual Interests rows; the legacy filename remains only to avoid changing the loader interface.
- `contents/awards.md` — bilingual Education and closing Contact content; the legacy filename remains only to avoid changing the loader interface.
- `static/css/main.css` — all site-specific tokens, layout, responsive rules, interaction states, and accessibility styles.
- `static/js/scripts.js` — Markdown loading, cache version, current year, and responsive navigation behavior.
- `tests/test_site.py` — structural, copy, accessibility, domain, and cache-busting contracts.
- `docs/research/components/*.spec.md` — auditable component contracts required by the clone workflow.

---

### Task 1: Lock the new information architecture and component contracts

**Files:**
- Create: `docs/research/components/site-header.spec.md`
- Create: `docs/research/components/profile-intro.spec.md`
- Create: `docs/research/components/contact-strip.spec.md`
- Create: `docs/research/components/profile-sections.spec.md`
- Modify: `tests/test_site.py`

**Interfaces:**
- Consumes: approved design in `docs/superpowers/specs/2026-07-16-bilingual-academic-profile-design.md` and reference evidence in `docs/research/01.me/`.
- Produces: exact class names and section IDs used by Tasks 2–4: `about`, `interests`, `education`, `contact`, `.profile-intro`, `.contact-strip`, `.interest-list`, and `.education-list`.

- [ ] **Step 1: Write four component specification files**

Each spec must use the clone-skill template and include: overview, DOM structure, exact planned values, interaction model, assets, bilingual text, and desktop/tablet/mobile behavior. Use these fixed decisions:

```text
Container: max-width 1120px
Body: Inter/system CJK, 16px, line-height 1.65
Background: #F7F8FA
Foreground: #15181D
Accent: #1F6FAF
Border: #DDE3E8
Desktop profile columns: 260px minmax(0, 1fr)
Desktop profile gap: clamp(48px, 7vw, 88px)
Mobile breakpoint: 767.98px
Touch target: min-height 44px
Interaction model: static content + anchor navigation + link hover/focus
```

- [ ] **Step 2: Replace legacy tests with new failing contracts**

Update `test_navigation_and_sections_match_new_information_architecture` to assert the four IDs and links:

```python
for section_id in ("about", "interests", "education", "contact"):
    self.assertIn(f'id="{section_id}"', index)
    self.assertIn(f'href="#{section_id}"', index)
for legacy_id in ("focus", "highlights", "publications", "awards"):
    self.assertNotIn(f'id="{legacy_id}"', index)
```

Replace the old phrase list in `test_content_has_no_placeholders_or_empty_links` with:

```python
for phrase in (
    "I studied at the University of Science and Technology of China",
    "我本科毕业于中国科学技术大学",
    "Software Systems / 软件系统",
    "Language Model Applications / 语言模型应用",
    "Developer Tools &amp; Open Source / 开发者工具与开源",
    "2019–2023",
):
    self.assertIn(phrase, index + content)
```

Add a plain-language contract:

```python
def test_copy_is_factual_and_not_marketing_style(self):
    text = "\n".join((
        read("index.html"),
        read("contents/home.md"),
        read("contents/publications.md"),
        read("contents/awards.md"),
    )).lower()
    for phrase in (
        "ambitious ai systems",
        "high-impact technical ventures",
        "shape the future",
        "research × engineering × entrepreneurship",
        "venture building",
    ):
        self.assertNotIn(phrase, text)
    self.assertLessEqual(len(re.findall(r"\bai\b", text)), 3)
```

Replace `test_portrait_is_shifted_left_on_desktop` with:

```python
def test_portrait_keeps_vertical_composition(self):
    css = read("static/css/main.css")
    self.assertIn("object-fit: contain", css)
    self.assertNotIn("aspect-ratio: 1", css)
```

- [ ] **Step 3: Run tests and confirm the new contracts fail**

Run:

```bash
python3 -m unittest discover -s tests -v
```

Expected: failures for missing new IDs, legacy copy, and portrait styling; existing domain and accessibility tests may still pass.

- [ ] **Step 4: Commit the contracts and component specifications**

```bash
git add docs/research/components tests/test_site.py
git commit -m "Define bilingual profile contracts"
```

---

### Task 2: Build the semantic profile and factual bilingual content

**Files:**
- Modify: `index.html`
- Modify: `contents/home.md`
- Modify: `contents/publications.md`
- Modify: `contents/awards.md`
- Modify: `contents/config.yml`

**Interfaces:**
- Consumes: section IDs and class contracts from Task 1.
- Produces: stable DOM consumed by `static/js/scripts.js` and styled by Task 3.

- [ ] **Step 1: Add a failing semantic-content assertion**

Extend `test_page_has_semantic_accessible_landmarks`:

```python
self.assertIn('class="profile-intro"', index)
self.assertIn('class="contact-strip"', index)
self.assertIn('lang="zh-CN"', index)
self.assertRegex(index, r'<img[^>]+width="[0-9]+"[^>]+height="[0-9]+"')
```

Run the single test and expect failure:

```bash
python3 -m unittest tests.test_site.SiteContractTests.test_page_has_semantic_accessible_landmarks -v
```

- [ ] **Step 2: Replace the global header and profile introduction in `index.html`**

Use this semantic shape:

```html
<nav class="site-nav navbar navbar-expand-md fixed-top" id="mainNav" aria-label="Primary navigation">
  <div class="container site-container">
    <a class="navbar-brand" href="#page-top">Zhu Zhenfang <span lang="zh-CN">朱振方</span></a>
    <!-- existing accessible Bootstrap toggler -->
    <div class="collapse navbar-collapse" id="navbarResponsive">
      <ul class="navbar-nav ms-auto">
        <li class="nav-item"><a class="nav-link" href="#about">About</a></li>
        <li class="nav-item"><a class="nav-link" href="#interests">Interests</a></li>
        <li class="nav-item"><a class="nav-link" href="#education">Education</a></li>
        <li class="nav-item"><a class="nav-link" href="#contact">Contact</a></li>
      </ul>
    </div>
  </div>
</nav>
```

The `#about` section must place the existing portrait first in DOM order, then the English/Chinese identity copy. Include:

```html
<p class="profile-role">Engineer · Entrepreneur</p>
<p class="profile-bio">I studied at the University of Science and Technology of China and work on software systems, developer tools, and early-stage products. This site collects my projects, notes, and current interests.</p>
<p class="profile-bio profile-bio-zh" lang="zh-CN">我本科毕业于中国科学技术大学，目前关注软件系统、开发者工具与早期产品。本网站用于整理我的项目、笔记和近期关注的问题。</p>
```

The contact strip must contain visible text links for `zhuzhenfang@ustc.edu` and `github.com/zhuzhenfangx`.

- [ ] **Step 3: Replace Markdown content with factual bilingual sections**

`contents/home.md` contains only a short bilingual About note. `contents/publications.md` contains an `.interest-list` with three rows and the approved bilingual labels. `contents/awards.md` contains the `2019–2023` USTC education entry and a short bilingual contact closing. Do not include blockquotes, numbered card indexes, publications, awards, or unsupported work history.

- [ ] **Step 4: Update document metadata and config**

Use:

```yaml
title: Zhu Zhenfang 朱振方 | Personal Website
page-top-title: Zhu Zhenfang <span lang="zh-CN">朱振方</span>
copyright-text: '&copy; <span id="current-year">2026</span> Zhu Zhenfang'
```

Set HTML description and Open Graph copy to a factual summary of the bilingual personal site; remove “AI entrepreneur,” “research-driven product development,” and keyword stuffing.

- [ ] **Step 5: Run all tests and inspect failures limited to unimplemented CSS**

```bash
python3 -m unittest discover -s tests -v
```

Expected: structure and content tests pass; portrait/style contracts remain failing until Task 3.

- [ ] **Step 6: Commit semantic structure and content**

```bash
git add index.html contents
git commit -m "Build bilingual academic profile content"
```

---

### Task 3: Implement the reference-informed visual system and responsive layout

**Files:**
- Modify: `static/css/main.css`
- Test: `tests/test_site.py`

**Interfaces:**
- Consumes: DOM classes from Task 2 and exact values from the component specs.
- Produces: the complete responsive visual system used by browser QA in Task 4.

- [ ] **Step 1: Add failing CSS token and responsive assertions**

Add:

```python
def test_bilingual_profile_visual_contract(self):
    css = read("static/css/main.css")
    for rule in (
        "--color-paper: #f7f8fa",
        "--color-heading: #15181d",
        "--color-accent: #1f6faf",
        'grid-template-columns: 260px minmax(0, 1fr)',
        ".contact-strip",
        ".interest-row",
        ".education-row",
        "object-fit: contain",
    ):
        self.assertIn(rule, css.lower())
```

Run the single test and expect failure.

- [ ] **Step 2: Replace the old design tokens and page-wide typography**

Implement:

```css
:root {
  --color-heading: #15181d;
  --color-body: #39424e;
  --color-muted: #596574;
  --color-accent: #1f6faf;
  --color-accent-dark: #155686;
  --color-focus: #0b5f8a;
  --color-paper: #f7f8fa;
  --color-surface: #ffffff;
  --color-tint: #f0f3f6;
  --color-border: #dde3e8;
  --font-body: Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  --nav-height: 68px;
}
```

Use 16px body text, 1.65 line-height, readable max-widths, and no display serif font.

- [ ] **Step 3: Implement desktop profile, contact strip, interests, and education**

Key declarations must include:

```css
.profile-intro {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  align-items: start;
  gap: clamp(3rem, 7vw, 5.5rem);
}

.portrait-wrap img {
  display: block;
  width: 100%;
  height: auto;
  object-fit: contain;
}

.contact-strip {
  display: flex;
  flex-wrap: wrap;
  min-height: 64px;
  gap: 1.5rem;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border);
  background: var(--color-surface);
}
```

Interest and education rows use subtle top borders and two-column label/content alignment. Remove old `.focus-card` lift effects, pill tags, hero slogan sizing, square portrait ratio, and dark footer block.

- [ ] **Step 4: Implement tablet and mobile behavior**

At `max-width: 767.98px`, use one column, center the portrait at `width: min(58vw, 210px)`, reset transforms, keep all contact text visible, stack timeline dates above content, and set page gutters to 20px. At `max-width: 991.98px`, reduce the desktop portrait to 220px and the grid gap to 40px.

- [ ] **Step 5: Run the entire automated suite**

```bash
python3 -m unittest discover -s tests -v
git diff --check
```

Expected: all tests pass and `git diff --check` prints no output.

- [ ] **Step 6: Commit the visual system**

```bash
git add static/css/main.css tests/test_site.py
git commit -m "Style bilingual academic profile"
```

---

### Task 4: Bust caches, perform browser QA, and publish

**Files:**
- Modify: `index.html`
- Modify: `static/js/scripts.js`
- Create: `docs/design-references/zhuzhenfang/profile-desktop-1440.png`
- Create: `docs/design-references/zhuzhenfang/profile-tablet-768.png`
- Create: `docs/design-references/zhuzhenfang/profile-mobile-390.png`
- Create: `docs/design-references/zhuzhenfang/profile-mobile-375.png`

**Interfaces:**
- Consumes: completed static page from Tasks 2–3.
- Produces: deployable GitHub Pages files and visual QA evidence.

- [ ] **Step 1: Update mutable asset versions**

Set `main.css` and `scripts.js` query versions in `index.html` to `2026071604`, and set `CONTENT_VERSION` in `static/js/scripts.js` to the same value so the three Markdown files refresh atomically.

- [ ] **Step 2: Run a local server and verify desktop behavior**

```bash
python3 -m http.server 4173
```

In the browser at 1440px verify: visible bilingual bio, portrait at natural ratio, all four nav targets, email/GitHub visibility, no console errors, and no horizontal overflow. Save the full-page screenshot to the specified desktop path.

- [ ] **Step 3: Verify tablet and mobile behavior**

Repeat at 768px, 390px, and 375px. At mobile widths verify portrait-first order, no truncated email, 44px targets, stacked education row, and no horizontal overflow. Save all screenshots.

- [ ] **Step 4: Compare against the reference evidence**

Compare with:

```text
docs/design-references/01.me/whoami-desktop-1440.png
docs/design-references/01.me/whoami-mobile-390.png
```

The finished site must retain the reference's factual hierarchy and compact profile structure while using the approved quieter blue, improved bilingual rhythm, and original user content.

- [ ] **Step 5: Run final verification**

```bash
python3 -m unittest discover -s tests -v
git diff --check
git status --short
```

Expected: all tests pass, no whitespace errors, and only intended files/screenshots are modified or untracked.

- [ ] **Step 6: Commit and push**

```bash
git add index.html static/js/scripts.js docs/design-references/zhuzhenfang
git commit -m "Finalize bilingual profile and visual QA"
git push origin main
```

- [ ] **Step 7: Verify the live deployment**

Poll `https://zhuzhenfangx.github.io/` until its HTML references version `2026071604`, then inspect the live page at desktop and mobile widths. Confirm the computed layout has no horizontal overflow and the visible email is exactly `zhuzhenfang@ustc.edu`.

