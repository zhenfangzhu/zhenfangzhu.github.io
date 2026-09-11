# 回声内容维护

每篇笔记是 `content/` 下的一个 JSON 文件。页面由 `template.html` 和共享样式生成，不要直接编辑 `index.html`。

## 新增或补全文本

1. 复制下方格式为 `content/英文短名.json`，填写标题、日期、来源和正文。
2. `pending` 表示待整理，只显示摘要；有正文后改为 `published`，页面自动提供展开和收起。
3. 执行 `python3 scripts/build_echoes.py`（在仓库根目录）。
4. 执行 `python3 scripts/build_echoes.py --check` 检查生成文件是否同步。
5. 预览 `/echoes/`，确认后提交数据、模板变更和生成的 HTML。

```json
{
  "id": "example-note",
  "date": "2026-09-10",
  "title": "笔记标题",
  "type": "视频",
  "source": "节目或文章的完整名称",
  "status": "published",
  "summary": "用于分享卡片的简短摘要",
  "sections": [
    {
      "title": "这一部分的主题",
      "items": [
        { "text": "摘录或要点", "note": "自己的批注；不需要时留空" }
      ]
    }
  ]
}
```

`source_short` 可选，用于折叠状态的短来源；`rating` 可选，整数 1–5。`sections` 可以有多节，每节可以有多条，文字里的换行写成 `\n`。内容按纯文本转义，不执行 HTML。`id` 必须唯一且保持稳定，分享地址为 `/echoes/example-note/`，旧锚点 `/echoes/#example-note` 仍可定位展开。

所有已发布笔记同时生成独立页面、1200×630 PNG 封面与站点地图条目；主题页继续折叠阅读。提交文本给 Codex 时只需提供标题、日期、来源和正文，Codex 可整理为此格式。

## 交互约定

- 所有笔记默认折叠，可以同时展开多篇，避免阅读时其他内容突然收起。
- 原生 `details/summary` 支持键盘，JavaScript 不可用时也可阅读。
- 搜索匹配标题、来源和全文；清空搜索后保留原来的展开状态。
- 展开全部仅作用于当前搜索结果；底部收起按钮返回本条标题。
- 带锚点访问时自动展开对应笔记；待整理条目没有假的展开按钮。
- 新内容自动进入搜索和计数，不需要修改交互脚本。

分节 `title` 可留空或省略，正文会直接呈现；不要添加“手记”等占位标题。

构建依赖 Pillow 和中文字体。此机器可使用 `/Users/hitler/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3` 执行上述命令；其他环境安装 Pillow，并用 `ECHO_COVER_FONT` 指定中文 TTF/TTC 字体。封面生成器在 `scripts/build_echo_covers.py`。`--check` 会验证主题页、所有独立页、封面和站点地图。
