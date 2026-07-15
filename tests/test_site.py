from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


def read(relative_path: str) -> str:
    return (ROOT / relative_path).read_text(encoding="utf-8")


def relative_luminance(hex_color: str) -> float:
    channels = [int(hex_color[index:index + 2], 16) / 255 for index in (1, 3, 5)]
    linear = [value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4 for value in channels]
    return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]


def contrast_ratio(first: str, second: str) -> float:
    light, dark = sorted((relative_luminance(first), relative_luminance(second)), reverse=True)
    return (light + 0.05) / (dark + 0.05)


def css_variable(css: str, name: str) -> str:
    match = re.search(rf"{re.escape(name)}:\s*(#[0-9a-fA-F]{{6}})", css)
    if not match:
        raise AssertionError(f"Missing CSS variable {name}")
    return match.group(1)


class SiteContractTests(unittest.TestCase):
    def test_active_github_pages_domain_is_canonical_everywhere(self):
        index = read("index.html")
        sitemap = read("sitemap.xml")
        self.assertIn('<link rel="canonical" href="https://zhuzhenfangx.github.io/">', index)
        self.assertIn('content="https://zhuzhenfangx.github.io/"', index)
        self.assertIn("<loc>https://zhuzhenfangx.github.io/</loc>", sitemap)
        self.assertNotIn("https://zhuzhenfang.github.io/", index + sitemap)

    def test_page_has_semantic_accessible_landmarks(self):
        index = read("index.html")
        for fragment in ('href="#main-content"', "<main", "</main>", '<nav', '<footer'):
            self.assertIn(fragment, index)
        self.assertRegex(index, r'<img[^>]+alt="Portrait of Zhu Zhenfang"')
        self.assertEqual(index.count("<h1"), 1)
        self.assertIn('aria-label="Primary navigation"', index)

    def test_navigation_and_sections_match_new_information_architecture(self):
        index = read("index.html")
        for section_id in ("about", "focus", "highlights"):
            self.assertIn(f'id="{section_id}"', index)
            self.assertIn(f'href="#{section_id}"', index)
        self.assertNotIn('href="#publications"', index)
        self.assertNotIn('href="#awards"', index)

    def test_content_has_no_placeholders_or_empty_links(self):
        content = "\n".join(read(path) for path in (
            "contents/home.md",
            "contents/publications.md",
            "contents/awards.md",
        ))
        self.assertNotRegex(content, r"\[List your|href=[\"']#[\"']")
        for phrase in (
            "Research × Engineering × Entrepreneurship",
            "AI Infrastructure",
            "LLM Systems",
            "Open-source Engineering",
            "University of Science and Technology of China",
        ):
            self.assertIn(phrase, content)

    def test_external_links_are_safe_and_email_is_preserved(self):
        home = read("contents/home.md")
        index = read("index.html")
        self.assertIn("mailto:zhuzhenfang@ustc.edu", home)
        self.assertIn("<span>zhuzhenfang@ustc.edu</span>", index)
        self.assertEqual(index.count('href="https://github.com/zhuzhenfangx"'), 2)
        for tag in re.findall(r'<a\s+[^>]*target="_blank"[^>]*>', index + home):
            self.assertIn('rel="noopener noreferrer"', tag)

    def test_text_and_focus_colors_meet_wcag_contrast(self):
        css = read("static/css/main.css")
        muted = css_variable(css, "--color-muted")
        paper = css_variable(css, "--color-paper")
        tint = css_variable(css, "--color-tint")
        focus = css_variable(css, "--color-focus")

        self.assertGreaterEqual(contrast_ratio(muted, paper), 4.5)
        self.assertGreaterEqual(contrast_ratio(muted, tint), 4.5)
        self.assertGreaterEqual(contrast_ratio(focus, paper), 3.0)
        self.assertIn("outline: 3px solid var(--color-focus)", css)
        self.assertRegex(css, r"\.site-footer\s+:focus-visible\s*\{[^}]*outline-color:\s*#fff")

    def test_css_contains_accessibility_and_responsive_contracts(self):
        css = read("static/css/main.css")
        for rule in (
            ".skip-link",
            ":focus-visible",
            "scroll-margin-top",
            "@media (max-width: 767.98px)",
            "@media (prefers-reduced-motion: reduce)",
            "max-width: 70ch",
        ):
            self.assertIn(rule, css)

    def test_single_mathjax_runtime(self):
        index = read("index.html")
        self.assertLessEqual(index.count("MathJax-script"), 1)

    def test_mutable_assets_use_cache_busting_versions(self):
        index = read("index.html")
        scripts = read("static/js/scripts.js")
        self.assertRegex(index, r'static/css/main\.css\?v=\d{8,}')
        self.assertRegex(index, r'static/js/scripts\.js\?v=\d{8,}')
        self.assertIn("const CONTENT_VERSION", scripts)
        self.assertIn("?v=${CONTENT_VERSION}", scripts)

    def test_portrait_is_shifted_left_on_desktop(self):
        css = read("static/css/main.css")
        self.assertIn("transform: translateX(-20px)", css)


if __name__ == "__main__":
    unittest.main()
