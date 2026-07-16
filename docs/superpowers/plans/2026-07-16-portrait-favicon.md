# Portrait Favicon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic browser-tab icon for zhuzhenfang.com with a clear personal-brand mark derived from the supplied pencil portrait.

**Architecture:** Generate one square high-contrast portrait master, then derive standard browser icon sizes from that approved composition. Keep the existing static-site structure and reference the resulting favicon and touch icon from `index.html`.

**Tech Stack:** Static HTML, PNG, multi-resolution ICO, GitHub Pages

## Global Constraints

- Use a circular dark background and a simplified light portrait mark.
- Preserve the tilted head, hair shape, face contour, and eye emphasis.
- Do not include text or initials.
- Keep strong contrast and clean edges at 16–32 px.
- Never permanently delete files; replaced assets must remain recoverable through Git history.

---

### Task 1: Generate and validate the portrait master

**Files:**
- Create: `static/assets/favicon-master.png`

**Interfaces:**
- Consumes: `/Users/hitler/Desktop/f836a0f694d29beb9923aac5752e739d.jpg`
- Produces: a square RGBA PNG used for every favicon derivative

- [ ] **Step 1: Generate the square icon master**

Use image generation to simplify the supplied portrait into the approved high-contrast circular mark with no text.

- [ ] **Step 2: Check small-size legibility**

Render the master at 32 px and 16 px and inspect that the face silhouette and eye line remain recognizable.

### Task 2: Build favicon assets and integrate them

**Files:**
- Modify: `static/assets/favicon.ico`
- Create: `static/assets/apple-touch-icon.png`
- Modify: `index.html`

**Interfaces:**
- Consumes: `static/assets/favicon-master.png`
- Produces: browser-tab and mobile shortcut icons referenced by the homepage

- [ ] **Step 1: Export standard icon sizes**

Create a multi-resolution ICO containing 16, 32, 48, and 64 px variants and a 180 px PNG touch icon.

- [ ] **Step 2: Link the touch icon**

Add this line next to the existing favicon link in `index.html`:

```html
<link rel="apple-touch-icon" sizes="180x180" href="static/assets/apple-touch-icon.png">
```

- [ ] **Step 3: Verify generated assets**

Run:

```bash
file static/assets/favicon.ico static/assets/apple-touch-icon.png
```

Expected: a multi-image Windows icon and a 180 × 180 PNG.

- [ ] **Step 4: Verify the page reference**

Run:

```bash
rg -n "favicon|apple-touch-icon" index.html
```

Expected: both the ICO favicon and the PNG touch icon are present.

- [ ] **Step 5: Commit the favicon change**

```bash
git add index.html static/assets/favicon.ico static/assets/favicon-master.png static/assets/apple-touch-icon.png
git commit -m "feat: add portrait favicon"
```
