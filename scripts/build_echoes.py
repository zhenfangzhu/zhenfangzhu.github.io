"""Build the static Echoes accordion from content/*.json (Python stdlib only)."""
import argparse
import datetime
import json
import re
from html import escape
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def bilingual(zh, en):
    return f'<span data-lang="zh">{zh}</span><span data-lang="en">{en}</span>'


def render(entry):
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
        sections.append(f'<section class="echo-section"><h3 class="echo-section-title">{e(section["title"])}</h3><ul class="echo-quote-list">{"".join(items)}</ul></section>')
    rating = entry.get('rating')
    assert rating is None or type(rating) is int and 1 <= rating <= 5
    extra = f'<p class="echo-source">{e(entry["source"])}</p>' if entry.get('source_short') else ''
    if rating:
        extra += f'<p class="echo-date" aria-label="{rating}/5">{"★" * rating}</p>'
    actions = f'<div class="echo-reading-actions"><a href="#{slug}">{bilingual("本条链接", "Link to note")}</a><button type="button" class="echo-close" hidden>{bilingual("收起笔记 ↑", "Collapse note ↑")}</button></div>'
    return f'<details class="echo-card" id="{slug}"><summary>{heading}<span class="echo-chevron" aria-hidden="true"></span></summary><div class="echo-body">{extra}{"".join(sections)}{actions}</div></details>'


def build(check=False):
    entries = [json.loads(p.read_text()) for p in sorted((ROOT / 'echoes/content').glob('*.json'))]
    ids = [entry['id'] for entry in entries]
    assert len(ids) == len(set(ids)), 'Duplicate ids'
    entries.sort(key=lambda entry: entry['date'], reverse=True)
    result = (ROOT / 'echoes/template.html').read_text().replace('{{ENTRIES}}', '\n'.join(render(entry) for entry in entries))
    output = ROOT / 'echoes/index.html'
    if check:
        assert output.read_text() == result, 'Run python3 scripts/build_echoes.py'
    else:
        output.write_text(result)
    print(f'Validated {len(entries)} notes; ' + ('output is current.' if check else 'built echoes/index.html.'))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--check', action='store_true')
    build(parser.parse_args().check)
