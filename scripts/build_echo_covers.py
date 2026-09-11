"""Generate 1200×630 PNG sharing covers. Requires Pillow and a CJK font."""
import io
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont


def cover(entry):
    font_path = os.environ.get('ECHO_COVER_FONT', '/System/Library/Fonts/STHeiti Light.ttc')
    if not Path(font_path).exists():
        raise RuntimeError('Set ECHO_COVER_FONT to a Chinese-capable TTF/TTC font.')
    image = Image.new('RGB', (1200, 630), '#faf9f6')
    draw = ImageDraw.Draw(image)
    def font(size): return ImageFont.truetype(font_path, size)
    def lines(text, size, width):
        result, line = [], ''
        for char in text:
            if draw.textlength(line + char, font=font(size)) > width:
                result.append(line); line = char
            else: line += char
        if line: result.append(line)
        return result
    draw.text((80, 62), 'Echoes / 回声', font=font(24), fill='#6b6964')
    draw.text((80, 143), entry['date'].replace('-', '/') + '  ·  ' + entry['type'], font=font(21), fill='#6b6964')
    for i, line in enumerate(lines(entry['title'], 48, 1040)):
        draw.text((78, 206 + i * 70), line, font=font(48), fill='#292925')
    for i, line in enumerate(lines(entry['summary'], 24, 1030)[:2]):
        draw.text((80, 389 + i * 38), line, font=font(24), fill='#67655f')
    draw.line((80, 528, 1120, 528), fill='#dbd8d0', width=1)
    draw.text((80, 556), '朱振方 · zhuzhenfang.com', font=font(21), fill='#6b6964')
    output = io.BytesIO(); image.save(output, format='PNG')
    return output.getvalue()
