"""Offline contracts for the Echoes directory and its complete static articles."""

import json
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urljoin, urlsplit
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
ORIGIN = "https://" + (ROOT / "CNAME").read_text(encoding="utf-8").strip()
DIRECTORY_URL = ORIGIN + "/echoes/"


def normalized(value):
    return " ".join(value.split())


class Element:
    def __init__(self, tag, attrs=()):
        self.tag = tag
        self.attrs = dict(attrs)
        self.content = []

    @property
    def children(self):
        return [part for part in self.content if isinstance(part, Element)]

    def walk(self):
        yield self
        for child in self.children:
            yield from child.walk()

    def has_class(self, name):
        return name in self.attrs.get("class", "").split()

    def text(self, readable=True):
        if readable and (self.tag in {"script", "style", "template"}
                         or "hidden" in self.attrs
                         or self.attrs.get("aria-hidden") == "true"):
            return ""
        return "".join(part.text(readable) if isinstance(part, Element) else part for part in self.content)


class Page(HTMLParser):
    VOID_TAGS = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"}

    def __init__(self, path):
        super().__init__(convert_charrefs=True)
        self.path = path
        self.root = Element("document")
        self.stack = [self.root]
        self.feed(path.read_text(encoding="utf-8"))

    def handle_starttag(self, tag, attrs):
        element = Element(tag, attrs)
        self.stack[-1].content.append(element)
        if tag not in self.VOID_TAGS:
            self.stack.append(element)

    def handle_startendtag(self, tag, attrs):
        self.stack[-1].content.append(Element(tag, attrs))

    def handle_endtag(self, tag):
        for index in range(len(self.stack) - 1, 0, -1):
            if self.stack[index].tag == tag:
                self.stack = self.stack[:index]
                break

    def handle_data(self, data):
        self.stack[-1].content.append(data)

    def elements(self, tag=None, **attrs):
        return [element for element in self.root.walk()
                if (tag is None or element.tag == tag)
                and all(element.attrs.get(key) == value for key, value in attrs.items())]

    def structured_nodes(self):
        def objects(value):
            if isinstance(value, dict):
                yield value
                for child in value.values():
                    yield from objects(child)
            elif isinstance(value, list):
                for child in value:
                    yield from objects(child)

        nodes = []
        for script in self.elements("script", type="application/ld+json"):
            nodes.extend(objects(json.loads(script.text(readable=False))))
        return nodes


def is_type(node, expected):
    value = node.get("@type", [])
    return expected in (value if isinstance(value, list) else [value])


def reference_url(value):
    if isinstance(value, str):
        return value
    if isinstance(value, dict):
        return value.get("url") or value.get("@id")
    return None


class EchoesPublicationTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.entries = [json.loads(path.read_text(encoding="utf-8"))
                       for path in sorted((ROOT / "echoes/content").glob("*.json"))]
        cls.published = [entry for entry in cls.entries if entry["status"] == "published"]
        cls.directory = Page(ROOT / "echoes/index.html")
        cls.articles = {entry["id"]: Page(ROOT / "echoes" / entry["id"] / "index.html") for entry in cls.published}

    def article_url(self, entry):
        return DIRECTORY_URL + entry["id"] + "/"

    def body_fragments(self, entry):
        for section in entry["sections"]:
            for item in section["items"]:
                for field in ("text", "note"):
                    if item.get(field):
                        yield item[field]

    def assert_one(self, values, message):
        self.assertEqual(len(values), 1, message)
        return values[0]

    def test_directory_links_to_every_published_article_once_with_stable_anchors(self):
        self.assertTrue(self.published, "The published catalog must not silently become empty")
        source_ids = [entry["id"] for entry in self.entries]
        self.assertEqual(len(source_ids), len(set(source_ids)), "Content IDs must be unique")
        cards = [element for element in self.directory.root.walk() if element.has_class("echo-card")]
        card_ids = [card.attrs.get("id") for card in cards]
        self.assertEqual(len(card_ids), len(set(card_ids)), "Directory anchors must be unique")
        self.assertTrue(set(card_ids).issubset(source_ids), "Directory entries must come from the content files")
        for entry in self.published:
            with self.subTest(entry=entry["id"]):
                card = self.assert_one([card for card in cards if card.attrs.get("id") == entry["id"]], "Published article missing or duplicated")
                link = self.assert_one([child for child in card.children if child.tag == "a" and child.has_class("echo-card-link")], "A directory card needs one direct article link")
                self.assertEqual(link.attrs.get("href"), f'/echoes/{entry["id"]}/')
                self.assertIn(normalized(entry["title"]), normalized(link.text()))
                self.assertIn(normalized(entry["summary"]), normalized(link.text()))
                self.assertTrue((ROOT / "echoes" / entry["id"] / "index.html").is_file())

    def test_directory_does_not_embed_full_notes_or_accordion_controls(self):
        self.assertFalse(self.directory.elements("details"))
        self.assertFalse(self.directory.elements("summary"))
        self.assertFalse(self.directory.elements(id="echo-toggle-all"))
        for entry in self.published:
            with self.subTest(entry=entry["id"]):
                card = self.assert_one(self.directory.elements(id=entry["id"]), "The article needs a directory card")
                text = normalized(card.text(readable=False))
                metadata = normalized(" ".join(entry.get(key, "") for key in ("title", "summary", "source", "source_short", "type", "date")))
                for fragment in self.body_fragments(entry):
                    # A future summary may intentionally quote a body sentence; that is still a summary.
                    if normalized(fragment) not in metadata:
                        self.assertNotIn(normalized(fragment), text, "Full note text belongs on the article page")

    def test_article_html_preserves_every_text_and_note_without_javascript(self):
        for entry in self.published:
            with self.subTest(entry=entry["id"]):
                page = self.articles[entry["id"]]
                article = self.assert_one(page.elements("article"), "The page must contain one complete article")
                body = normalized(article.text())
                for fragment in self.body_fragments(entry):
                    self.assertIn(normalized(fragment), body, f"Missing static article text: {fragment}")
                dates = [time.attrs.get("datetime") for time in article.walk() if time.tag == "time"]
                self.assertIn(entry["date"], dates, "Keep the existing visible note date")

    def test_article_identity_and_metadata_match_the_content_source(self):
        for entry in self.published:
            with self.subTest(entry=entry["id"]):
                page = self.articles[entry["id"]]
                heading = self.assert_one(page.elements("h1"), "Each article needs exactly one h1")
                title = self.assert_one(page.elements("title"), "Each article needs exactly one title")
                description = self.assert_one(page.elements("meta", name="description"), "Each article needs one description")
                canonical = self.assert_one(page.elements("link", rel="canonical"), "Each article needs one canonical URL")
                self.assertEqual(normalized(heading.text()), normalized(entry["title"]))
                self.assertIn(entry["title"], title.text())
                self.assertEqual(description.attrs.get("content"), entry["summary"])
                self.assertEqual(canonical.attrs.get("href"), self.article_url(entry))
                for name, expected in (("og:title", entry["title"]), ("og:description", entry["summary"]), ("og:url", self.article_url(entry)), ("og:type", "article")):
                    meta = self.assert_one(page.elements("meta", property=name), f"Expected one {name}")
                    self.assertEqual(meta.attrs.get("content"), expected)

    def test_article_return_routes_and_available_source_urls_are_preserved(self):
        for entry in self.published:
            with self.subTest(entry=entry["id"]):
                page = self.articles[entry["id"]]
                links = page.elements("a")
                hrefs = [link.attrs.get("href", "") for link in links]
                self.assertIn(f'/echoes/#{entry["id"]}', hrefs, "The return link should preserve the directory position")
                self.assertIn("/echoes/", hrefs, "Keep a link back to the complete directory")
                for source_url in re.findall(r"https?://[^\s]+", entry["source"]):
                    self.assertIn(source_url, hrefs, "Do not discard an available original-source link")
                for href in hrefs:
                    url = urlsplit(urljoin(self.article_url(entry), href))
                    if url.netloc != urlsplit(ORIGIN).netloc:
                        continue
                    destination = ROOT / unquote(url.path).lstrip("/")
                    if destination.is_dir():
                        destination /= "index.html"
                    self.assertTrue(destination.is_file(), f"Broken local article link: {href}")
                    if url.fragment:
                        target = self.directory if url.path == "/echoes/" else Page(destination)
                        self.assertTrue(target.elements(id=unquote(url.fragment)), f"Missing return anchor: {href}")

    def test_article_and_breadcrumb_structured_data_match_the_visible_article(self):
        for entry in self.published:
            with self.subTest(entry=entry["id"]):
                nodes = self.articles[entry["id"]].structured_nodes()
                article = self.assert_one([node for node in nodes if is_type(node, "Article")], "Expected one Article structured-data node")
                self.assertEqual(article.get("headline"), entry["title"])
                self.assertEqual(article.get("description"), entry["summary"])
                self.assertEqual(reference_url(article.get("url")), self.article_url(entry))
                self.assertEqual(reference_url(article.get("mainEntityOfPage")), self.article_url(entry))
                breadcrumbs = self.assert_one([node for node in nodes if is_type(node, "BreadcrumbList")], "Expected one breadcrumb trail")
                items = breadcrumbs.get("itemListElement", [])
                self.assertTrue(items)
                self.assertEqual([item.get("position") for item in items], list(range(1, len(items) + 1)))
                self.assertIn(DIRECTORY_URL, [reference_url(item.get("item")) for item in items])
                last = items[-1]
                self.assertEqual(reference_url(last.get("item")), self.article_url(entry))
                last_name = last.get("name") or (last.get("item", {}).get("name") if isinstance(last.get("item"), dict) else None)
                self.assertEqual(last_name, entry["title"])

    def test_collection_itemlist_matches_the_published_directory(self):
        nodes = self.directory.structured_nodes()
        collection = self.assert_one([node for node in nodes if is_type(node, "CollectionPage")], "Expected one CollectionPage")
        self.assertEqual(collection.get("url"), DIRECTORY_URL)
        item_list = collection.get("mainEntity")
        if isinstance(item_list, dict) and not is_type(item_list, "ItemList"):
            item_list = next((node for node in nodes if node.get("@id") == item_list.get("@id") and is_type(node, "ItemList")), None)
        self.assertIsInstance(item_list, dict)
        self.assertTrue(is_type(item_list, "ItemList"))
        items = item_list.get("itemListElement", [])
        urls = [reference_url(item.get("item")) or reference_url(item) for item in items]
        expected = [self.article_url(entry) for entry in self.published]
        self.assertCountEqual(urls, expected, "Structured data must list each published article exactly once")
        if "numberOfItems" in item_list:
            self.assertEqual(item_list["numberOfItems"], len(expected))
        if all("position" in item for item in items):
            self.assertEqual([item["position"] for item in items], list(range(1, len(items) + 1)))

    def test_sitemap_contains_each_published_article_exactly_once(self):
        tree = ET.parse(ROOT / "sitemap.xml")
        urls = [element.text for element in tree.findall(".//{*}loc")]
        self.assertEqual(urls.count(DIRECTORY_URL), 1)
        for entry in self.published:
            with self.subTest(entry=entry["id"]):
                self.assertEqual(urls.count(self.article_url(entry)), 1)
                self.assertTrue((ROOT / "echoes" / entry["id"] / "index.html").is_file())


if __name__ == "__main__":
    unittest.main()
