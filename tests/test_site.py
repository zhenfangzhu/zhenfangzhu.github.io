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
    def test_custom_domain_is_canonical_everywhere(self):
        index = read("index.html")
        about = read("about/index.html")
        sitemap = read("sitemap.xml")
        self.assertTrue((ROOT / "CNAME").is_file(), "CNAME must exist for GitHub Pages")
        cname = read("CNAME")
        self.assertEqual(cname.strip(), "zhuzhenfang.com")
        self.assertIn('<link rel="canonical" href="https://zhuzhenfang.com/">', index)
        self.assertIn('<link rel="canonical" href="https://zhuzhenfang.com/about/">', about)
        self.assertIn('content="https://zhuzhenfang.com/"', index)
        self.assertIn("<loc>https://zhuzhenfang.com/</loc>", sitemap)
        self.assertNotIn("zhuzhenfangx.github.io", index + sitemap)

    def test_page_has_semantic_accessible_landmarks(self):
        index = read("index.html")
        for fragment in ('href="#main-content"', "<main", "</main>", '<nav', '<footer'):
            self.assertIn(fragment, index)
        self.assertRegex(index, r'<img[^>]+alt="Portrait of Zhu Zhenfang"')
        self.assertEqual(index.count("<h1"), 1)
        self.assertIn('aria-label="Primary navigation"', index)
        self.assertIn('class="profile-intro"', index)
        self.assertIn('class="contact-strip"', index)
        self.assertIn('lang="zh-CN"', index)
        self.assertRegex(index, r'<img[^>]+width="[0-9]+"[^>]+height="[0-9]+"')

    def test_navigation_and_sections_match_new_information_architecture(self):
        index = read("index.html")
        for section_id in ("about", "interests", "education", "contact"):
            self.assertIn(f'id="{section_id}"', index)
        self.assertIn('href="/about/"', index)
        for section_id in ("interests", "education", "contact"):
            self.assertIn(f'href="#{section_id}"', index)
        self.assertIn('href="/founder-dna/"', index)
        for legacy_id in ("focus", "highlights", "publications", "awards"):
            self.assertNotIn(f'id="{legacy_id}"', index)

    def test_content_has_no_placeholders_or_empty_links(self):
        index = read("index.html")
        content = "\n".join(read(path) for path in (
            "contents/home.md",
            "contents/publications.md",
            "contents/awards.md",
        ))
        visible_text = re.sub(r"</?span(?:\s+[^>]*)?>", "", index + content)
        self.assertNotRegex(content, r"\[List your|href=[\"']#[\"']")
        for phrase in (
            "I graduated from the University of Science and Technology of China",
            "我毕业于中国科学技术大学",
            "Software Systems / 软件系统",
            "Language Model Applications / 语言模型应用",
            "Developer Tools &amp; Open Source / 开发者工具与开源",
            "2019–2023",
            "Bachelor of Science",
            "理学学士",
        ):
            self.assertIn(phrase, visible_text)

    def test_about_page_has_searchable_identity_and_education(self):
        about = read("about/index.html")
        for phrase in (
            "朱振方",
            "Zhu Zhenfang",
            "中国科学技术大学",
            "University of Science and Technology of China",
            "2019",
            "2023",
            "理学学士",
            "Bachelor of Science",
        ):
            self.assertIn(phrase, about)
        self.assertIn('"@type": "Person"', about)
        self.assertIn('"hasCredential"', about)
        self.assertNotIn("Xavier", read("index.html") + about)
        self.assertIn("目前从事AI创业", read("index.html"))
        self.assertIn("目前从事AI创业", about)
        self.assertIn('"jobTitle": ["AI Entrepreneur", "Software Engineer"]', about)

    def test_copy_is_factual_and_not_marketing_style(self):
        home = read("contents/home.md")
        text = "\n".join((
            read("index.html"),
            home,
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
        self.assertLessEqual(len(re.findall(r"\bai\b", text)), 12)
        self.assertIn("Contact details are below.", home)
        self.assertIn("联系方式见下方。", home)

    def test_external_links_are_safe_and_email_is_preserved(self):
        home = read("contents/home.md")
        index = read("index.html")
        combined = index + "\n" + home
        contact_strip = re.search(r'<div class="contact-strip">(.*?)</div>', index, re.DOTALL)
        self.assertIsNotNone(contact_strip)
        self.assertEqual(combined.count('href="mailto:zhuzhenfang@ustc.edu"'), 1)
        self.assertEqual(combined.count('href="https://github.com/zhuzhenfangx"'), 1)
        self.assertIn('href="mailto:zhuzhenfang@ustc.edu"', contact_strip.group(1))
        self.assertIn('href="https://github.com/zhuzhenfangx"', contact_strip.group(1))
        self.assertIn("<span>zhuzhenfang@ustc.edu</span>", index)
        for tag in re.findall(r'<a\s+[^>]*target="_blank"[^>]*>', combined):
            self.assertIn('rel="noopener noreferrer"', tag)

    def test_dynamic_markdown_marks_chinese_fragments_with_language(self):
        home = read("contents/home.md")
        interests = read("contents/publications.md")
        self.assertIn('## About / <span lang="zh-CN">关于</span>', home)
        for label in ("软件系统", "语言模型应用", "开发者工具与开源"):
            self.assertIn(f'/ <span lang="zh-CN">{label}</span></strong>', interests)
        self.assertEqual(interests.count('<span lang="zh-CN">'), 3)

    def test_interest_supporting_copy_selector_only_targets_direct_spans(self):
        css = read("static/css/main.css")
        self.assertIn(".interest-row > span", css)
        self.assertNotRegex(css, r"\.interest-row\s+span\s*\{")

    def test_inter_font_request_matches_site_typography(self):
        index = read("index.html")
        self.assertIn("family=Inter:wght@400;500;600;700&amp;display=swap", index)
        self.assertNotIn("Mulish", index)
        self.assertNotIn("Newsreader", index)

    def test_theme_color_matches_paper_surface(self):
        index = read("index.html")
        self.assertIn('<meta name="theme-color" content="#f7f8fa">', index)

    def test_redundant_hidden_contact_copy_is_absent(self):
        awards = read("contents/awards.md")
        css = read("static/css/main.css")
        self.assertNotIn("contact-closing", awards)
        self.assertNotIn(".contact-closing", css)

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

    def test_navigation_uses_opaque_surface_and_accessible_brand_target(self):
        css = read("static/css/main.css")
        nav = re.search(r"\.site-nav\s*\{([^}]*)\}", css, re.DOTALL)
        brand = re.search(r"\.navbar-brand\s*\{([^}]*)\}", css, re.DOTALL)
        self.assertIsNotNone(nav)
        self.assertIsNotNone(brand)
        self.assertIn("background: var(--color-paper)", nav.group(1))
        self.assertNotIn("backdrop-filter", nav.group(1))
        for rule in ("display: inline-flex", "align-items: center", "min-height: 44px"):
            self.assertIn(rule, brand.group(1))

    def test_single_mathjax_runtime(self):
        index = read("index.html")
        self.assertLessEqual(index.count("MathJax-script"), 1)

    def test_founder_dna_is_deployable_and_keeps_data_local(self):
        app = read("founder-dna/index.html")
        sitemap = read("sitemap.xml")
        self.assertIn("Founder DNA 创始人禀赋测试", app)
        self.assertIn('<link rel="canonical" href="https://zhuzhenfang.com/founder-dna/">', app)
        self.assertIn("localStorage.getItem(STORAGE_KEY)", app)
        self.assertIn("localStorage.setItem(STORAGE_KEY", app)
        self.assertNotIn("fetch(", app)
        self.assertNotIn("XMLHttpRequest", app)
        self.assertNotIn("WebSocket", app)
        self.assertIn('href="/" aria-label="返回朱振方个人主页"', app)
        self.assertIn("<loc>https://zhuzhenfang.com/founder-dna/</loc>", sitemap)

    def test_mutable_assets_use_cache_busting_versions(self):
        index = read("index.html")
        scripts = read("static/js/scripts.js")
        self.assertRegex(index, r'static/css/main\.css\?v=\d{8,}')
        self.assertRegex(index, r'static/js/scripts\.js\?v=\d{8,}')
        self.assertIn("const CONTENT_VERSION", scripts)
        self.assertIn("?v=${CONTENT_VERSION}", scripts)

    def test_mutable_assets_refresh_atomically_for_final_profile_release(self):
        index = read("index.html")
        scripts = read("static/js/scripts.js")
        version = "2026071604"
        self.assertIn(f'static/css/main.css?v={version}', index)
        self.assertIn(f'static/js/scripts.js?v={version}', index)
        self.assertIn(f"const CONTENT_VERSION = '{version}'", scripts)

    def test_portrait_keeps_vertical_composition(self):
        css = read("static/css/main.css")
        self.assertIn("object-fit: contain", css)
        self.assertNotIn("aspect-ratio: 1", css)


if __name__ == "__main__":
    unittest.main()
