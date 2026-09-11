"""Build the static Echoes accordion and sharing pages from content/*.json (Pillow required)."""
import argparse
import datetime
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def bilingual(zh, en):
    return f'<span data-lang="zh">{zh}</span><span data-lang="en">{en}</span>'


def render(entry, standalone=False):
    e = escape
    slug = entry['id']
    assert re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', slug), 'Invalid id'
    datetime.date.fromisoformat(entry['date'])
    assert entry['status'] in ('published', 'pending')
    for field in ('title', 'source', 'type'):
        assert isinstance(entry[field], str) and entry[field].strip(), field
    ready = entry['status'] == 'published'
    assert not ready or entry['sections'], 'Published notes need content'
    meta = f'<span class="echo-meta"><time class="echo-date" datetime="{entry["date"]}">{entry["date"].replace("-", "/")}</time><span class="echo-tag">{e(entry["type"])}</span>'
    if not ready:
        meta += '<span class="echo-pending">' + bilingual('待整理', 'Notes pending') + '</span>'
    rating = entry.get('rating')
    assert rating is None or type(rating) is int and 1 <= rating <= 5
    if rating:
        meta += f'<span class="echo-rating" aria-label="{rating}/5">{"★" * rating}</span>'
    meta += '</span>'
    heading = f'{meta}<h2 class="echo-title">{e(entry["title"])}</h2><span class="echo-source">{e(entry.get("source_short", entry["source"]))}</span>'
    if not ready:
        return f'<article class="echo-card echo-card-pending" id="{slug}">{heading}</article>'
    sections = []
    for section in entry['sections']:
        assert section['items'], 'Empty section'
        items = []
        for item in section['items']:
            assert isinstance(item['text'], str) and item['text'].strip()
            note = f'<p class="echo-note-body">{e(item["note"])}</p>' if item.get('note') else ''
            items.append(f'<li class="echo-quote"><p class="echo-note-title">{e(item["text"])}</p>{note}</li>')
        section_title = re.sub(r'^[^\w\u4e00-\u9fff]+', '', section.get('title', '')).strip()
        section_heading = f'<h3 class="echo-section-title">{e(section_title)}</h3>' if section_title else ''
        sections.append(f'<section class="echo-section">{section_heading}<ul class="echo-quote-list">{"".join(items)}</ul></section>')
    source_url = re.search(r'https?://[^\s]+', entry['source'])
    source_title = entry['source'][:source_url.start()].strip() if source_url else entry['source']
    source_link = f'<a href="{e(source_url.group(), quote=True)}" target="_blank" rel="noopener noreferrer">{bilingual("查看原始内容 ↗", "View source ↗")}</a>' if source_url else ''
    source = f'<aside class="echo-source-detail"><p class="echo-source-label">{bilingual("来源", "Source")}</p><p>{e(source_title)}</p>{source_link}</aside>'
    actions = f'<div class="echo-reading-actions"><a href="/echoes/{slug}/">{bilingual("本条链接", "Link to note")}</a><button type="button" class="echo-close" hidden>{bilingual("收起笔记 ↑", "Collapse note ↑")}</button></div>'
    if standalone:
        heading = heading.replace('<h2 ', '<h1 ').replace('</h2>', '</h1>')
        body = ''.join(sections).replace('<h3 ', '<h2 ').replace('</h3>', '</h2>')
        return f'<article class="echo-entry echo-standalone"><header>{heading}</header><div class="echo-body">{body}{source}</div></article>'
    return f'<details class="echo-card" id="{slug}"><summary>{heading}<span class="echo-chevron" aria-hidden="true"></span></summary><div class="echo-body">{"".join(sections)}{source}{actions}</div></details>'


def share_page(entry, template):
    url = 'https://zhuzhenfang.com/echoes/' + entry['id'] + '/'
    image = 'https://zhuzhenfang.com/static/assets/echoes/' + entry['id'] + '.png'
    title, summary = escape(entry['title'], quote=True), escape(entry['summary'], quote=True)
    head = template.split('<body')[0]
    head = re.sub(r'<title>.*?</title>', f'<title>{title}｜回声</title>', head)
    head = re.sub(r'    <(?:meta (?:name="description"|property="og:[^"]+")[^>]*|link rel="canonical"[^>]*)>\n', '', head)
    head = re.sub(r'    <script defer src="/static/js/echoes.js[^>]*></script>\n', '', head)
    metadata = f'''    <meta name="description" content="{summary}">
    <link rel="canonical" href="{url}">
    <meta property="og:type" content="article">
    <meta property="og:site_name" content="朱振方 · 回声">
    <meta property="og:title" content="{title}">
    <meta property="og:description" content="{summary}">
    <meta property="og:url" content="{url}">
    <meta property="og:image" content="{image}">
    <meta property="og:image:width" content="1200">
    <meta property="og:image:height" content="630">
    <meta property="og:image:alt" content="{title} — {summary}">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="{title}">
    <meta name="twitter:description" content="{summary}">
    <meta name="twitter:image" content="{image}">
'''
    nav = bilingual('← 返回回声', '← Back to Echoes')
    return head.replace('</head>', metadata + '</head>') + f'''<body>
    <header class="site-chrome"><a class="site-return" href="/echoes/#{entry['id']}">{nav}</a></header>
    <main class="echoes-page" id="echoes-content">
        <header class="echoes-heading"><p>Echoes<span data-lang="zh">｜回声</span></p></header>
        {render(entry, standalone=True)}
    </main>
</body>
</html>
'''


def build(check=False):
    entries = [json.loads(p.read_text()) for p in sorted((ROOT / 'echoes/content').glob('*.json'))]
    ids = [entry['id'] for entry in entries]
    assert len(ids) == len(set(ids)), 'Duplicate ids'
    entries.sort(key=lambda entry: entry['date'], reverse=True)
    result = (ROOT / 'echoes/template.html').read_text().replace('{{ENTRIES}}', '\n'.join(render(entry) for entry in entries))
    output = ROOT / 'echoes/index.html'
    from build_echo_covers import cover
    outputs = {output: result.encode()}
    for entry in entries:
        if entry['status'] != 'published':
            continue
        assert entry.get('summary'), 'Published notes need a summary'
        outputs[ROOT / 'echoes' / entry['id'] / 'index.html'] = share_page(entry, (ROOT / 'echoes/template.html').read_text()).encode()
        outputs[ROOT / 'static/assets/echoes' / (entry['id'] + '.png')] = cover(entry)
    sitemap = ROOT / 'sitemap.xml'
    xml = sitemap.read_text()
    for entry in entries:
        if entry['status'] != 'published':
            continue
        url = 'https://zhuzhenfang.com/echoes/' + entry['id'] + '/'
        if '<loc>' + url + '</loc>' not in xml:
            xml = xml.replace('</urlset>', f'  <url>\n    <loc>{url}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.6</priority>\n  </url>\n</urlset>')
    outputs[sitemap] = xml.encode()
    for path, data in outputs.items():
        if check:
            assert path.exists() and path.read_bytes() == data, f'Outdated: {path}'
        else:
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    print(f'Validated {len(entries)} notes and all share pages/covers; output is current.' if check else f'Built {len(entries)} notes and share pages/covers.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
