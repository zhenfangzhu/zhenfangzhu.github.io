# Academic Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the personal site into a credible, accessible academic-engineering homepage at `zhuzhenfangx.github.io`.

**Architecture:** Keep the existing dependency-light static site: semantic HTML defines the page shell, Markdown stores editable content, CSS owns the complete visual system, and a small JavaScript loader renders Markdown/YAML with graceful error handling. A Python standard-library test suite validates structural, content, accessibility, and domain requirements.

**Tech Stack:** HTML5, CSS3, Bootstrap 5 utilities, vanilla JavaScript, Marked, js-yaml, Python `unittest`.

## Global Constraints

- Preserve the user's current USTC email change.
- Do not invent publications, awards, projects, affiliations, or social profiles.
- Use English body copy while retaining Chinese name and USTC's Chinese name.
- Use `https://zhuzhenfangx.github.io/` in canonical, Open Graph, and sitemap metadata until a custom domain is registered.
- Do not rename or push the GitHub remote.

---

### Task 1: Site Contract Tests

**Files:**
- Create: `tests/test_site.py`

**Interfaces:**
- Consumes: repository HTML, CSS, JavaScript, Markdown, YAML, and sitemap files.
- Produces: executable structural contract via `python3 -m unittest discover -s tests -v`.

- [ ] Write tests asserting the new domain metadata, semantic landmarks, accessible navigation, non-placeholder content, requested sections, and responsive CSS.
- [ ] Run `python3 -m unittest discover -s tests -v` and verify failures identify the missing redesign.

### Task 2: Semantic Page Shell and Domain Metadata

**Files:**
- Modify: `index.html`
- Modify: `sitemap.xml`

**Interfaces:**
- Consumes: IDs defined in `contents/config.yml` and Markdown section filenames.
- Produces: `#about`, `#focus`, and `#highlights` rendering targets plus canonical metadata.

- [ ] Replace the template shell with semantic navigation, main content, and footer landmarks.
- [ ] Add canonical, Open Graph, Twitter card, and requested-domain metadata.
- [ ] Remove duplicate MathJax loading and obsolete commented template sections.
- [ ] Run the tests and confirm Task 2 assertions pass.

### Task 3: Credible English Content

**Files:**
- Modify: `contents/home.md`
- Modify: `contents/publications.md`
- Modify: `contents/awards.md`
- Modify: `contents/config.yml`

**Interfaces:**
- Consumes: existing verified biography, education, email, and GitHub profile facts.
- Produces: biography, focus cards, and highlights without empty links or placeholders.

- [ ] Rewrite the introduction around Research × Engineering × Entrepreneurship.
- [ ] Replace empty publication and award lists with honest focus and highlight content.
- [ ] Update navigation/footer strings and preserve the USTC email.
- [ ] Run the tests and confirm all content assertions pass.

### Task 4: Editorial Academic Visual System

**Files:**
- Modify: `static/css/main.css`

**Interfaces:**
- Consumes: semantic classes and section structure from Tasks 2–3.
- Produces: responsive typography, spacing, colors, surfaces, and accessible states.

- [ ] Define semantic color/type/spacing tokens and editorial typography.
- [ ] Build desktop and mobile layouts with a 70-character text measure.
- [ ] Add visible focus, skip-link, anchor offset, and reduced-motion rules.
- [ ] Run the tests and confirm responsive/accessibility CSS assertions pass.

### Task 5: Content Loading Reliability

**Files:**
- Modify: `static/js/scripts.js`

**Interfaces:**
- Consumes: `contents/config.yml` and the three section Markdown files.
- Produces: rendered content, current-year footer value, and visible fallback messages on fetch failure.

- [ ] Refactor loading into small async functions with response-status checks.
- [ ] Preserve mobile navigation collapse and initialize scrollspy after rendering.
- [ ] Run the full unittest suite.

### Task 6: Visual Verification

**Files:**
- Verify only: all modified site files.

**Interfaces:**
- Consumes: locally served site.
- Produces: desktop and 375px visual verification evidence.

- [ ] Serve with `python3 -m http.server 8000`.
- [ ] Inspect desktop and mobile layouts in the in-app browser.
- [ ] Verify navigation, external links, keyboard focus, and absence of horizontal overflow.
- [ ] Run `python3 -m unittest discover -s tests -v` once more before reporting completion.
