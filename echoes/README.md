# 回声内容维护

每篇笔记是 `content/` 下的一个 JSON 文件。页面由 `template.html` 和共享样式生成，不要直接编辑 `index.html`。

## 新增或补全文本

1. 复制下方格式为 `content/英文短名.json`，填写标题、日期、来源和正文。
2. `pending` 表示待整理，只在目录显示信息；有正文后改为 `published`，自动生成独立文章并添加目录链接。
3. 执行 `python3 scripts/build_echoes.py`（在仓库根目录）。
4. 执行 `python3 scripts/build_echoes.py --check` 检查生成文件是否同步。
5. 预览 `/echoes/`，点击标题检查对应文章，确认后提交数据、模板变更和生成的 HTML。

```json
{
  "id": "example-note",
  "date": "2026-09-10",
  "title": "笔记标题",
  "type": "视频",
  "source": "节目或文章的完整名称",
  "status": "published",
  "summary": "用于目录、搜索描述与分享卡片的简短摘要",
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

`source_short` 与 `rating` 保留为可选内容字段，评分为整数 1–5；页面不展示星级，完整来源在文章末尾显示。`sections` 可以有多节，每节可以有多条，文字里的换行写成 `\n`。内容按纯文本转义，不执行 HTML。`id` 必须唯一且保持稳定，文章地址为 `/echoes/example-note/`，旧锚点 `/echoes/#example-note` 仍可定位目录条目。

所有已发布笔记同时生成独立页面、1200×630 PNG 封面与站点地图条目。目录只展示日期、标题和摘要；完整正文只放在文章页。每篇文章有自己的标题、描述、canonical 地址和 Article / BreadcrumbList 结构化数据；目录生成 CollectionPage / ItemList。现有日期是笔记日期，不推断为发布时间。提交文本给 Codex 时只需提供标题、日期、来源和正文，Codex 可整理为此格式。

## 交互约定

- 点击目录标题进入独立文章；原生链接支持键盘、复制网址和在新标签页打开。
- JavaScript 不可用时，完整目录和文章仍可阅读、导航。
- 搜索匹配目录中的标题、日期、摘要等可见文字；不加载所有文章全文。
- 搜索默认只显示放大镜，点击后展开并聚焦；按 Esc 或再次点击放大镜会清空筛选、收起输入框。
- 文章顶部返回原目录条目，底部可回到全部回声。
- 带锚点访问时定位对应目录条目；待整理条目没有文章链接。
- 新内容自动进入搜索和计数，不需要修改交互脚本。

分节 `title` 可留空或省略，正文会直接呈现；不要添加“手记”等占位标题。

构建依赖 Pillow 和中文字体。此机器可使用 `/Users/hitler/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/bin/python3` 执行上述命令；其他环境安装 Pillow，并用 `ECHO_COVER_FONT` 指定中文 TTF/TTC 字体。封面生成器在 `scripts/build_echo_covers.py`。`--check` 会验证主题页、所有独立页、封面和站点地图。
