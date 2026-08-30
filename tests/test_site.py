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
        for fragment in ('href="#main-content"', "<main", "</main>", '<footer'):
            self.assertIn(fragment, index)
        self.assertRegex(index, r'<img[^>]+alt="Portrait of Zhenfang Zhu"')
        self.assertEqual(index.count("<h1"), 1)
        self.assertNotIn('aria-label="Primary navigation"', index)
        self.assertIn("profile-intro", index)
        self.assertIn("contact-strip", index)
        self.assertIn('lang="zh-CN"', index)
        self.assertRegex(index, r'<img[^>]+width="[0-9]+"[^>]+height="[0-9]+"')

    def test_navigation_and_sections_match_new_information_architecture(self):
        index = read("index.html")
        for section_id in ("about", "education", "tools", "contact"):
            self.assertIn(f'id="{section_id}"', index)
        self.assertNotIn('id="interests"', index)
        for section_id in ("reality", "dreams"):
            self.assertIn(f'id="{section_id}"', index)
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
        board_i18n = read("static/js/board-i18n.js")
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
        self.assertIn("这个 PIN 已被使用，请换一个。", board_i18n)
        self.assertIn('tr("status.pinUsed")', board_js)
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
            "I am Zhenfang Zhu (Chinese: 朱振方). I earned my bachelor's degree from the University of Science and Technology of China",
            "我是朱振方，本科毕业于中国科学技术大学",
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
            "Zhenfang Zhu",
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

    def test_homepage_search_title_contains_both_names(self):
        index = read("index.html")
        localized_homepages = index + read("en/index.html") + read("zh/index.html")

        self.assertIn('<title id="title">Zhenfang Zhu｜朱振方</title>', index)
        self.assertIn('<meta property="og:title" content="Zhenfang Zhu｜朱振方">', index)
        self.assertIn('<meta property="og:site_name" content="Zhenfang Zhu｜朱振方">', index)
        self.assertIn('data-title-en="Zhenfang Zhu｜朱振方" data-title-zh="Zhenfang Zhu｜朱振方"', index)
        self.assertIn('"name": "Zhenfang Zhu｜朱振方"', index)
        self.assertIn('"alternateName": ["朱振方", "zhuzhenfang", "@zhuzhenfang", "zhenfangzhu"]', index)
        self.assertIn('"@type": "WebSite"', index)
        self.assertEqual(localized_homepages.count('<title id="title">Zhenfang Zhu｜朱振方</title>'), 3)
        self.assertEqual(localized_homepages.count('<h1 class="site-title" id="profile-name">Zhenfang Zhu｜朱振方</h1>'), 3)
        self.assertNotIn('Zhu Zhenfang', localized_homepages + read("about/index.html"))
        self.assertIn('"familyName": "朱"', index)
        self.assertIn('"givenName": "振方"', index)
        self.assertIn('<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1">', index)
        self.assertNotIn("Personal Website", index)

    def test_homepage_exposes_name_and_language_specific_urls(self):
        index = read("index.html")
        sitemap = read("sitemap.xml")

        self.assertIn('<h1 class="site-title" id="profile-name">Zhenfang Zhu｜朱振方</h1>', index)
        self.assertNotIn("site-handle", index + read("en/index.html") + read("zh/index.html"))
        for language, path in (("en", "en"), ("zh-CN", "zh")):
            self.assertIn(
                f'<link rel="alternate" hreflang="{language}" href="https://zhuzhenfang.com/{path}/">',
                index,
            )
            self.assertIn(f"<loc>https://zhuzhenfang.com/{path}/</loc>", sitemap)

        for localized_path, canonical in (("en/index.html", "/en/"), ("zh/index.html", "/zh/")):
            localized = read(localized_path)
            self.assertIn(f'<link rel="canonical" href="https://zhuzhenfang.com{canonical}">', localized)
            self.assertIn('hreflang="x-default" href="https://zhuzhenfang.com/"', localized)

        self.assertNotIn('data-lang="zh"', read("en/index.html"))
        self.assertNotIn('data-lang="en"', read("zh/index.html"))

    def test_homepage_uses_responsive_optimized_portrait(self):
        index = read("index.html")

        for image in ("photo-600.webp", "photo-1200.webp", "photo-1200.jpg"):
            self.assertTrue((ROOT / "static/assets/img" / image).is_file())
            self.assertIn(image, index)
        self.assertIn('width="1171" height="1200"', index)
        self.assertNotIn('src="static/assets/img/photo.jpg"', index)

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
        contact_strip = re.search(r'<div class="[^"]*contact-strip[^"]*">(.*?)</div>', index, re.DOTALL)
        self.assertIsNotNone(contact_strip)
        self.assertEqual(combined.count('href="mailto:zhuzhenfang@ustc.edu"'), 1)
        self.assertEqual(combined.count('href="https://github.com/zhenfangzhu"'), 1)
        self.assertIn('href="mailto:zhuzhenfang@ustc.edu"', contact_strip.group(1))
        self.assertIn('href="https://github.com/zhenfangzhu"', contact_strip.group(1))
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

    def test_homepage_uses_reference_editorial_typography_without_webfonts(self):
        index = read("index.html")
        css = read("static/css/home.css")
        self.assertNotIn("fonts.googleapis.com", index)
        self.assertIn('"Iowan Old Style"', css)
        self.assertIn('"Palatino Linotype"', css)
        self.assertNotIn("Mulish", index)
        self.assertNotIn("Newsreader", index)

    def test_theme_color_matches_editorial_surface(self):
        index = read("index.html")
        self.assertIn('<meta name="theme-color" content="#ffffff">', index)

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

    def test_homepage_matches_editorial_reference_contract(self):
        css = read("static/css/home.css")
        for rule in (
            "--ink: #282828",
            "--nav: #676767",
            "width: min(100%, 600px)",
            "grid-template-columns: minmax(500px, 600px) minmax(320px, 469px)",
            ".home-visual",
            "font-size: 19px",
            "object-fit: cover",
        ):
            self.assertIn(rule, css.lower())

    def test_homepage_places_language_control_in_the_top_corner(self):
        index = read("index.html")
        css = read("static/css/home.css")
        self.assertIn('class="bio-view-controls"', index)
        self.assertIn('class="language-picker language-picker--corner"', index)
        self.assertIn('class="language-menu"', index)
        self.assertIn('data-language-option="en"', index)
        self.assertIn('data-language-option="zh"', index)
        self.assertNotIn('class="language-bar"', index)
        self.assertNotIn('class="compact-index"', index)
        self.assertNotIn('href="#reality"', index)
        self.assertNotIn('href="#dreams"', index)
        self.assertNotIn("Primary navigation", index)
        self.assertNotIn(">Index<", index)
        self.assertNotIn(">索引<", index)
        self.assertNotIn('class="site-nav', index)
        self.assertNotIn("navbar", index)
        self.assertIn("min-height: 44px", css)
        self.assertIn(".language-picker--corner", css)
        self.assertLess(index.index("language-picker--corner"), index.index('class="home-copy"'))

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
        self.assertIn("Wakefulness is a long loading screen for that 1% of sleep.", index)
        self.assertIn('<h2 class="dream-section-title" id="dreams-title">', index)
        self.assertIn('aria-labelledby="dreams-title"', index)
        self.assertNotIn("Waking life leaves credentials", index)
        self.assertNotIn("清醒时留下履历、作品、关系和时间", index)
        self.assertNotIn(">Archive<", index)
        self.assertNotIn(">档案<", index)
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
        self.assertIn("公开 4 条", dreams)
        self.assertIn('<span data-lang="zh">全部</span>', dreams)
        self.assertIn('<span data-lang="zh">未公开</span>', dreams)
        self.assertIn("2024年10月19日 午觉", entry)
        self.assertIn("清醒梦", entry)
        self.assertIn("困惑", entry)
        self.assertIn("妈妈你杀了爸爸", entry)
        self.assertIn("https://zhuzhenfang.com/dreams/2024-10-19/", sitemap)
        self.assertNotIn("bbs-post__author", entry)
        self.assertNotIn("1楼", entry)
        self.assertNotIn("只看楼主", entry)
        self.assertNotRegex(entry, r"<p>记录 00[1-4]</p>")
        self.assertNotIn("bbs-topbar", dreams + entry)
        self.assertNotIn("bbs-breadcrumb", dreams + entry)
        self.assertNotIn("<strong>朱振方</strong>", entry)
        self.assertNotIn(">朱振方的主页<", dreams + entry)
        self.assertRegex(dreams, r'<span data-lang="zh">全部</span>.*?<span>326</span>')
        self.assertRegex(dreams, r'<span data-lang="zh">未公开</span>.*?<b>322</b>')
        self.assertNotIn("bbs-board-stats", dreams)
        for dream_page in (
            dreams,
            entry,
            read("dreams/2025-01-08/index.html"),
            read("dreams/2025-05-04/index.html"),
            read("dreams/2025-06-12/index.html"),
        ):
            self.assertNotIn("bbs-footer", dream_page)

    def test_tools_share_one_persistent_language_setting(self):
        language = read("static/js/site-language.js")
        board = read("board/index.html")
        dreams = read("dreams/index.html")
        founder = read("founder-dna/index.html")

        self.assertIn('const STORAGE_KEY = "site-language"', language)
        self.assertIn("window.localStorage.setItem(STORAGE_KEY, next)", language)
        for page in (board, dreams, founder):
            self.assertIn("site-language.js", page)
            self.assertIn("site-language.css", page)
        self.assertNotIn("bbs-notice", dreams)
        self.assertIn("Founder Profiles", read("static/js/founder-i18n.js"))

    def test_dream_filters_use_text_state_without_active_underline(self):
        dreams = read("dreams/index.html")
        css = read("static/css/dream-forum.css")

        self.assertIn('dream-forum.css?v=2026082705', dreams)
        self.assertIn('.bbs-categories a.is-active { border-bottom: 0; }', css)
        self.assertRegex(css, r"\.bbs-categories a\.is-active \{ color: var\(--bbs-text\); \}")
        self.assertRegex(css, r"\.bbs-categories \{[^}]*border-bottom: 0;")
        self.assertRegex(css, r"\.bbs-topic-list \{[^}]*border-top: 0;")
        self.assertNotIn("dream-entry-row::after", read("static/css/home.css"))

    def test_mutable_assets_use_cache_busting_versions(self):
        index = read("index.html")
        self.assertRegex(index, r'static/css/home\.css\?v=\d{8,}')
        self.assertRegex(index, r'static/js/language\.js\?v=\d{8,}')

    def test_homepage_uses_current_editorial_release_assets(self):
        index = read("index.html")
        css = read("static/css/home.css")
        self.assertIn('static/css/home.css?v=2026083001', index)
        self.assertIn('static/js/language.js?v=2026082711', index)
        self.assertIn('--cjk-reading-font: "PingFang SC"', css)
        self.assertIn('html[data-language="zh"] .bio-view-panel [data-lang="zh"]', css)

    def test_homepage_dream_archive_is_clearly_labeled_as_navigation(self):
        for path, label, action in (
            ("index.html", "另一边", "进入 →"),
            ("en/index.html", "The Other Side", "Enter →"),
            ("zh/index.html", "另一边", "进入 →"),
        ):
            page = read(path)
            self.assertIn('class="dream-section-title"', page)
            self.assertIn(label, page)
            self.assertIn(action, page)
            self.assertIn('aria-labelledby="dreams-title"', page)

    def test_make_it_exist_note_is_bilingual_and_linked_from_every_homepage(self):
        note = read("notes/make-it-exist/index.html")
        sitemap = read("sitemap.xml")

        for path, title in (
            ("index.html", "让它存在"),
            ("zh/index.html", "让它存在"),
            ("en/index.html", "Make It Exist"),
        ):
            homepage = read(path)
            self.assertIn('href="/notes/make-it-exist/"', homepage)
            self.assertIn(title, homepage)

        for phrase in (
            "把原本不存在的东西，带到这个世界里。",
            "Creator.",
            "Bringing something that did not exist into this world.",
            "I want to see how many things that did not exist",
        ):
            self.assertIn(phrase, note)

        self.assertIn('<link rel="canonical" href="https://zhuzhenfang.com/notes/make-it-exist/">', note)
        self.assertIn('data-title-en="Make It Exist | Zhenfang Zhu"', note)
        self.assertIn("site-language.js", note)
        self.assertIn("<loc>https://zhuzhenfang.com/notes/make-it-exist/</loc>", sitemap)
        self.assertIn('class="essay-byline"', note)
        self.assertIn('--essay-cjk-serif: "Songti SC"', note)
        self.assertEqual(note.count('class="essay-pair"'), 4)
        self.assertNotIn('<strong>Creator.</strong>', note)

    def test_things_i_believe_is_the_shipping_manifesto(self):
        note = read("notes/things-i-believe/index.html")

        for phrase in (
            "Shipping fast beats the best strategy.",
            "后来我发现恰恰相反。",
            "很多问题只有把东西交到真实的人手里才会出现。",
            "Ship 不是执行的最后一步。Ship 本身就是思考的一部分",
            "Shipping is not the final step of execution.",
        ):
            self.assertIn(phrase, note)

        for removed_copy in (
            "赚钱第一性原理",
            "逻辑链条",
            "Total Wealth",
            "Value Growth Formula",
            "MathJax-script",
        ):
            self.assertNotIn(removed_copy, note)

        self.assertIn('class="belief-byline"', note)
        self.assertIn('src="../../static/assets/img/photo-600.webp"', note)
        self.assertIn('--belief-cjk-serif: "Songti SC"', note)
        self.assertNotIn('class="belief-card"', note)
        self.assertNotIn('class="belief-kicker"', note)
        self.assertIn('data-title-zh="我所相信的事 ｜ 朱振方"', note)

    def test_homepage_has_busuanzi_site_stats(self):
        index = read("index.html")
        css = read("static/css/home.css")
        self.assertIn(
            'src="https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"',
            index,
        )
        self.assertIn('id="busuanzi_container_site_pv"', index)
        self.assertIn('id="busuanzi_value_site_pv"', index)
        self.assertIn('id="busuanzi_container_site_uv"', index)
        self.assertIn('id="busuanzi_value_site_uv"', index)
        self.assertIn(".footer-stats", css)

    def test_dream_pages_have_busuanzi_site_stats(self):
        dreams_css = read("static/css/dream-forum.css")
        self.assertIn(".dream-footer", dreams_css)
        self.assertIn(".footer-stats", dreams_css)
        for path in (
            "dreams/index.html",
            "dreams/2024-10-19/index.html",
            "dreams/2025-01-08/index.html",
            "dreams/2025-05-04/index.html",
            "dreams/2025-06-12/index.html",
        ):
            page = read(path)
            self.assertIn(
                'src="https://busuanzi.ibruce.info/busuanzi/2.3/busuanzi.pure.mini.js"',
                page,
            )
            self.assertIn('id="busuanzi_container_site_pv"', page)
            self.assertIn('id="busuanzi_value_site_pv"', page)
            self.assertIn('id="busuanzi_container_site_uv"', page)
            self.assertIn('id="busuanzi_value_site_uv"', page)
            self.assertIn('class="dream-footer"', page)

    def test_contact_section_uses_editorial_index_rows(self):
        index = read("index.html")
        css = read("static/css/home.css")
        self.assertIn("profile-contact", index)
        self.assertIn('href="mailto:zhuzhenfang@ustc.edu"', index)
        self.assertIn('href="https://github.com/zhenfangzhu"', index)
        self.assertIn("grid-template-columns: minmax(0, 1fr) auto", css)
        self.assertNotIn("For relevant technical or product conversations", index)
        self.assertNotIn("欢迎就相关技术或产品问题与我交流", index)

    def test_language_switcher_changes_and_remembers_the_ui_language(self):
        index = read("index.html")
        about = read("about/index.html")
        css = read("static/css/home.css")
        language_js = read("static/js/language.js")
        self.assertIn('class="language-toggle"', index)
        self.assertIn('class="language-toggle"', about)
        self.assertIn('aria-haspopup="menu"', index)
        self.assertNotIn('class="language-select"', about)
        self.assertIn('data-lang="en"', index)
        self.assertIn('data-lang="zh"', index)
        self.assertIn('html[data-language="en"] [data-lang="zh"]', css)
        self.assertIn('html[data-language="zh"] [data-lang="en"]', css)
        self.assertIn('window.localStorage.setItem(STORAGE_KEY, nextLanguage)', language_js)
        self.assertIn('document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en"', language_js)
        self.assertIn('option.dataset.languageOption', language_js)
        self.assertIn('setLanguageMenuOpen', language_js)

    def test_homepage_uses_the_reduced_content_order_without_a_mode_switch(self):
        index = read("index.html")
        css = read("static/css/home.css")
        language_js = read("static/js/language.js")

        self.assertNotIn("data-reading-mode", index)
        self.assertNotIn("data-set-mode", index)
        self.assertNotIn("data-mode", index)
        self.assertNotIn("reading-mode-switch", css)
        self.assertNotIn("site-reading-mode", language_js)
        self.assertIn('id="reality"', index)
        self.assertIn('id="dreams"', index)
        for label in ("实用工具", "教育经历", "联系方式"):
            self.assertIn(label, index)
        homepage_body = index.split("<body", 1)[1]
        for removed_copy in ("现实</span>", "关注方向", "Software Systems", "软件系统"):
            self.assertNotIn(removed_copy, homepage_body)
        self.assertLess(index.index('id="dreams"'), index.index('id="education"'))
        self.assertLess(index.index('id="education"'), index.index('id="tools"'))
        self.assertLess(index.index('id="tools"'), index.index('id="contact"'))

    def test_homepage_uses_the_new_bilingual_default_bio_and_preserves_the_dream_long_view(self):
        index = read("index.html")
        default_panel = re.search(r'id="bio-default".*?id="bio-long"', index, re.DOTALL)
        long_panel = re.search(r'id="bio-long".*?</section>', index, re.DOTALL)
        self.assertIsNotNone(default_panel)
        self.assertIsNotNone(long_panel)
        for phrase in (
            "我是朱振方，本科毕业于中国科学技术大学。",
            "现在，我在做 AI Agent Coding 方向的创业。",
            "2026 年暑假，我见过几百个孩子",
            "从少数人的能力，变成每个人都能拥有的可能。",
            "从软件的使用者，变成软件的创造者。",
            "最后只剩下一个问题——你到底想做什么？",
            "I am Zhenfang Zhu (Chinese: 朱振方). I earned my bachelor's degree from the University of Science and Technology of China.",
            "I am now building a startup focused on AI Agent Coding.",
            "During the summer of 2026, I watched hundreds of children",
            "a possibility open to everyone.",
            "what do you actually want to build?",
        ):
            self.assertIn(phrase, default_panel.group(0))
            self.assertNotIn(phrase, long_panel.group(0))
        for phrase in (
            "我越来越不相信，现实只发生在清醒的时候。",
            "真正重要的是，一段经历有没有改变之后的你。",
            "如果一个梦让我十年后仍然恐惧、怀念或者做出不同的选择",
            "所以我开始记录两边。",
            "这里不是我的个人主页。",
            "我只是此刻，站在这一边记录。",
            "下一次醒来，我也许就在另一边。",
        ):
            self.assertIn(phrase, long_panel.group(0))
            self.assertNotIn(phrase, default_panel.group(0))

        self.assertIn('role="tablist"', index)
        self.assertIn('data-bio-view="default"', index)
        self.assertIn('data-bio-view="long"', index)
        self.assertIn('id="bio-long" role="tabpanel"', index)
        self.assertIn('<span data-lang="en">Long</span>', index)
        self.assertIn('class="bio-thesis"', default_panel.group(0))
        self.assertIn('class="bio-closing"', default_panel.group(0))
        self.assertIn("What truly matters is whether an experience changes who you become afterward.", long_panel.group(0))
        self.assertIn("So I began recording both sides.", long_panel.group(0))
        self.assertIn("activateBioView", read("static/js/language.js"))

    def test_portrait_is_a_compact_right_column(self):
        css = read("static/css/home.css")
        index = read("index.html")
        self.assertIn('class="home-visual"', index)
        self.assertIn('class="home-visual-image"', index)
        self.assertNotIn('class="profile-avatar"', index)
        self.assertRegex(css, r"\.home-copy\s*\{[^}]*grid-column:\s*1")
        self.assertRegex(css, r"\.home-visual\s*\{[^}]*grid-column:\s*2")
        self.assertIn("minmax(320px, 469px)", css)
        self.assertIn("height: min(760px", css)
        self.assertIn("margin-top: 134px", css)
        self.assertIn("object-fit: cover", css)
        self.assertIn("object-position: 70% center", css)
        self.assertIn("border-radius: 8px", css)

    def test_portrait_has_a_mobile_editorial_crop(self):
        for path in ("index.html", "en/index.html", "zh/index.html"):
            page = read(path)
            self.assertIn('class="mobile-profile-visual"', page)
            self.assertIn('srcset="/static/assets/img/photo-600.webp 600w, /static/assets/img/photo-1200.webp 1200w"', page)

        css = read("static/css/home.css")
        self.assertRegex(css, r"\.mobile-profile-visual\s*\{[^}]*aspect-ratio:\s*4 / 3")
        self.assertRegex(css, r"@media \(min-width: 1100px\)[\s\S]*?\.mobile-profile-visual\s*\{[^}]*display:\s*none")


if __name__ == "__main__":
    unittest.main()
