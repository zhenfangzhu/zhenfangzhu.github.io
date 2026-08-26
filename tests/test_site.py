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
        for section_id in ("about", "interests", "education", "tools", "contact"):
            self.assertIn(f'id="{section_id}"', index)
        for section_id in ("interests", "education", "tools", "contact"):
            self.assertIn(f'href="#{section_id}"', index)
        self.assertIn('href="/founder-dna/"', index)
        self.assertIn('href="/board/"', index)
        for legacy_id in ("focus", "highlights", "publications", "awards"):
            self.assertNotIn(f'id="{legacy_id}"', index)

    def test_public_board_has_durable_shared_storage_contract(self):
        board = read("board/index.html")
        board_js = read("static/js/board.js")
        config = read("static/js/board-config.js")
        schema = read("supabase/board.sql")
        sitemap = read("sitemap.xml")

        self.assertIn('<link rel="canonical" href="https://zhuzhenfang.com/board/">', board)
        self.assertIn('id="board-editor"', board)
        self.assertIn('maxlength="20000"', board)
        self.assertIn("supabase.co", config)
        self.assertIn("sb_publishable_", config)
        self.assertNotIn("sb_secret_", config)
        self.assertIn('.from("public_boards")', board_js)
        self.assertIn('"postgres_changes"', board_js)
        self.assertIn("enable row level security", schema.lower())
        self.assertIn("Anyone can read the public board", schema)
        self.assertIn("Anyone can update the public board", schema)
        self.assertIn("<loc>https://zhuzhenfang.com/board/</loc>", sitemap)

    def test_private_boards_are_password_derived_and_not_publicly_listable(self):
        board = read("board/index.html")
        board_js = read("static/js/board.js")
        schema = read("supabase/private-boards.sql")

        for fragment in (
            'id="private-mode"',
            'id="private-room-form"',
            'id="private-room-password"',
            'pattern="[0-9]{4}"',
            'id="private-create-panel"',
            'id="create-room-form"',
            'id="private-workspace"',
            'id="private-board-editor"',
            'id="lock-private-room"',
        ):
            self.assertIn(fragment, board)

        self.assertNotIn('id="private-room-code"', board)
        self.assertNotIn('id="new-room-code"', board)

        for crypto_contract in (
            '"PBKDF2"',
            '"SHA-256"',
            '"AES-GCM"',
            "1000000",
            "deriveRoomCredentials",
            "PIN_PATTERN",
            "PIN_ROOM_CONTEXT",
            "window.crypto.subtle.encrypt",
            "window.crypto.subtle.decrypt",
        ):
            self.assertIn(crypto_contract, board_js)

        self.assertIn("deriveRoomCredentials(pin)", board_js)
        self.assertIn("window.crypto.subtle.deriveBits", board_js)
        self.assertIn('["deriveBits"]', board_js)
        self.assertNotIn('["deriveKey"]', board_js)
        self.assertIn('window.history.replaceState(null, "", "/board/")', board_js)
        self.assertIn("这个 PIN 已被使用，请换一个。", board_js)
        self.assertIn('.rpc("save_private_board"', board_js)
        self.assertIn('.rpc("read_private_board"', board_js)
        self.assertNotIn("p_password", board_js)
        self.assertNotIn("localStorage", board_js)
        self.assertNotIn("sessionStorage", board_js)
        self.assertNotIn("location.hash", board_js)
        self.assertNotIn("location.search", board_js)
        self.assertNotIn("console.", board_js)

        self.assertIn("enable row level security", schema.lower())
        self.assertIn(
            "revoke all on table public.private_boards from public, anon, authenticated",
            schema.lower(),
        )
        self.assertNotIn("create policy", schema.lower())
        self.assertIn("security definer", schema.lower())
        self.assertIn("p_ttl_days not in (1, 7, 30)", schema)
        self.assertNotIn("password", schema.lower())

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
            "BSc, University of Science and Technology of China",
            "中国科学技术大学理学学士",
            "Software Systems",
            "软件系统",
            "Language Model Applications",
            "语言模型应用",
            "Developer Tools &amp; Open Source",
            "开发者工具与开源",
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

    def test_homepage_search_title_is_only_the_chinese_name(self):
        index = read("index.html")

        self.assertIn('<title id="title">朱振方</title>', index)
        self.assertIn('<meta property="og:title" content="朱振方">', index)
        self.assertIn('<meta property="og:site_name" content="朱振方">', index)
        self.assertIn('data-title-en="朱振方" data-title-zh="朱振方"', index)
        self.assertIn('"name": "朱振方"', index)
        self.assertNotIn("Personal Website", index)

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

    def test_dynamic_content_has_separate_language_variants(self):
        home = read("contents/home.md")
        interests = read("contents/publications.md")
        education = read("contents/awards.md")
        self.assertIn('<div data-lang="en">', home)
        self.assertIn('<div data-lang="zh" lang="zh-CN">', home)
        for label in ("软件系统", "语言模型应用", "开发者工具与开源"):
            self.assertIn(f'<strong>{label}</strong>', interests)
        self.assertIn('class="interest-list" data-lang="en"', interests)
        self.assertIn('class="interest-list" data-lang="zh"', interests)
        self.assertIn('class="education-list" data-lang="en"', education)
        self.assertIn('class="education-list" data-lang="zh"', education)

    def test_interest_supporting_copy_selector_only_targets_direct_spans(self):
        css = read("static/css/main.css")
        self.assertIn(".interest-row > span", css)
        self.assertNotRegex(css, r"\.interest-row\s+span\s*\{")

    def test_forum_typography_uses_fast_system_fonts(self):
        index = read("index.html")
        css = read("static/css/main.css")
        self.assertNotIn("fonts.googleapis.com", index)
        self.assertIn('--font-body: Arial, "Microsoft YaHei"', css)
        self.assertNotIn("Mulish", index)
        self.assertNotIn("Newsreader", index)

    def test_theme_color_matches_forum_header(self):
        index = read("index.html")
        self.assertIn('<meta name="theme-color" content="#2c5f8f">', index)

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

    def test_bilingual_dream_archive_visual_contract(self):
        css = read("static/css/main.css")
        for rule in (
            "--color-paper: #e9eef3",
            "--color-heading: #222b33",
            "--color-accent: #205b91",
            'grid-template-columns: 170px minmax(0, 1fr)',
            ".archive-titlebar",
            ".archive-stats",
            ".reading-mode-switch",
            ".contact-strip",
            ".interest-row",
            ".education-row",
            "object-fit: cover",
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

    def test_dream_archive_is_public_and_linked_from_the_homepage(self):
        index = read("index.html")
        dreams = read("dreams/index.html")
        css = read("static/css/dream-forum.css")
        sitemap = read("sitemap.xml")
        self.assertIn('href="/dreams/"', index)
        self.assertIn("清醒是漫长的加载，为了那 1% 的睡眠。", index)
        self.assertIn("Loading… 99%", dreams)
        self.assertIn("清醒是漫长的加载，为了那 1% 的睡眠。", dreams)
        self.assertIn('id="topic-list"', dreams)
        self.assertIn("清醒梦", dreams)
        self.assertIn("层叠梦", dreams)
        self.assertIn("假醒梦", dreams)
        self.assertIn(".bbs-topic-list", css)
        self.assertIn(".bbs-topic-columns", css)
        self.assertIn("<loc>https://zhuzhenfang.com/dreams/</loc>", sitemap)

    def test_dream_entries_use_smooth_progressive_navigation(self):
        dreams = read("dreams/index.html")
        css = read("static/css/dream-forum.css")
        navigation = read("static/js/dream-navigation.js")

        self.assertIn("dream-navigation.js", dreams)
        self.assertIn("@view-transition", css)
        self.assertIn("prefers-reduced-motion: reduce", css)
        self.assertIn("a[data-dream-link]", navigation)
        self.assertIn("event.metaKey", navigation)

    def test_first_lucid_dream_is_published_as_a_full_entry(self):
        dreams = read("dreams/index.html")
        entry = read("dreams/2024-10-19/index.html")
        sitemap = read("sitemap.xml")

        self.assertIn('href="/dreams/2024-10-19/"', dreams)
        self.assertIn('data-dream-link', dreams)
        self.assertIn("共 4 个主题", dreams)
        self.assertIn("2024年10月19日 午觉", entry)
        self.assertIn("清醒梦", entry)
        self.assertIn("困惑", entry)
        self.assertIn("妈妈，你杀了爸爸。", entry)
        self.assertIn("https://zhuzhenfang.com/dreams/2024-10-19/", sitemap)
        self.assertIn("bbs-post__author", entry)
        self.assertIn("1楼", entry)
        self.assertNotIn("<strong>朱振方</strong>", entry)
        self.assertNotIn(">朱振方的主页<", dreams + entry)
        self.assertIn("<dt>状态</dt><dd>公开</dd>", dreams)

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
        version = "2026082606"
        self.assertIn(f'static/css/main.css?v={version}', index)
        self.assertIn(f'static/js/scripts.js?v={version}', index)
        self.assertIn(f"const CONTENT_VERSION = '{version}'", scripts)

    def test_homepage_has_busuanzi_site_stats(self):
        index = read("index.html")
        css = read("static/css/main.css")
        self.assertIn(
            'src="https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"',
            index,
        )
        self.assertIn('id="busuanzi_container_site_pv"', index)
        self.assertIn('id="busuanzi_value_site_pv"', index)
        self.assertIn('id="busuanzi_container_site_uv"', index)
        self.assertIn('id="busuanzi_value_site_uv"', index)
        self.assertIn(".footer-stats", css)

    def test_contact_section_uses_forum_contact_rows(self):
        index = read("index.html")
        css = read("static/css/main.css")
        self.assertIn('class="profile-contact"', index)
        self.assertIn('class="bi bi-envelope-fill"', index)
        self.assertIn('class="bi bi-github"', index)
        self.assertIn("grid-template-columns: repeat(2, minmax(0, 1fr))", css)
        self.assertNotIn("For relevant technical or product conversations", index)
        self.assertNotIn("欢迎就相关技术或产品问题与我交流", index)

    def test_language_switcher_changes_and_remembers_the_ui_language(self):
        index = read("index.html")
        about = read("about/index.html")
        css = read("static/css/main.css")
        language_js = read("static/js/language.js")
        self.assertIn('class="language-toggle"', index)
        self.assertIn('class="language-toggle"', about)
        self.assertNotIn('class="language-select"', index)
        self.assertNotIn('class="language-select"', about)
        self.assertIn('data-lang="en"', index)
        self.assertIn('data-lang="zh"', index)
        self.assertIn('html[data-language="en"] [data-lang="zh"]', css)
        self.assertIn('html[data-language="zh"] [data-lang="en"]', css)
        self.assertIn('window.localStorage.setItem(STORAGE_KEY, nextLanguage)', language_js)
        self.assertIn('document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en"', language_js)
        self.assertIn('currentLanguage() === "zh" ? "en" : "zh"', language_js)

    def test_dream_and_reality_modes_share_one_factual_page(self):
        index = read("index.html")
        css = read("static/css/main.css")
        language_js = read("static/js/language.js")

        self.assertIn("document.documentElement.dataset.readingMode = readingMode === 'reality' ? 'reality' : 'dream'", index)
        self.assertIn('data-set-mode="dream"', index)
        self.assertIn('data-set-mode="reality"', index)
        self.assertIn("如果人生是一场漫长的梦，这里只是我从遗忘里留下的一小部分。", index)
        self.assertIn("正在发生的梦", index)
        self.assertIn("已经醒来的梦", index)
        self.assertIn("梦的产物", index)
        self.assertIn("唤醒方式", index)
        self.assertIn('html[data-reading-mode="dream"] [data-mode="reality"]', css)
        self.assertIn("prefers-reduced-motion: reduce", language_js)
        self.assertIn('window.localStorage.setItem(MODE_STORAGE_KEY, nextMode)', language_js)

    def test_portrait_keeps_vertical_composition(self):
        css = read("static/css/main.css")
        self.assertIn("object-fit: contain", css)
        self.assertNotIn("aspect-ratio: 1", css)


if __name__ == "__main__":
    unittest.main()
