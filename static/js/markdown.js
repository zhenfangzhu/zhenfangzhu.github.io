(function () {
    "use strict";

    const STORAGE_KEY = "zhu-markdown-lab-draft-v1";
    const THEME_KEY = "zhu-markdown-lab-theme-v1";
    const DEFAULT_DOCUMENT = `# Markdown Lab

> 一个打开即用、草稿只保存在本机的 Markdown 编辑器。

## 快速开始

在左侧输入内容，右侧会实时生成预览。

- **加粗文字** 与 *斜体文字*
- [添加链接](https://zhuzhenfang.com/)
- 使用 \`行内代码\`
- 创建任务清单

- [x] 打开编辑器
- [ ] 写下你的想法
- [ ] 下载 Markdown 或打印成 PDF

## 代码块

\`\`\`javascript
function hello(name) {
    return \`Hello, \${name}!\`;
}

console.log(hello("Markdown"));
\`\`\`

## 表格

| 功能 | 状态 |
| --- | --- |
| 实时预览 | 已启用 |
| 自动保存 | 仅保存在本机 |
| HTML 安全过滤 | 已启用 |

---

开始编辑吧。`;

    const editor = document.getElementById("editor");
    const preview = document.getElementById("preview");
    const saveStatus = document.getElementById("save-status");
    const stats = document.getElementById("document-stats");
    const cursorPosition = document.getElementById("cursor-position");
    const toast = document.getElementById("toast");
    const workspace = document.querySelector(".workspace");
    const themeToggle = document.getElementById("theme-toggle");
    let saveTimer;
    let toastTimer;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add("is-visible");
        clearTimeout(toastTimer);
        toastTimer = window.setTimeout(() => toast.classList.remove("is-visible"), 2400);
    }

    function countWords(text) {
        const latinWords = text.match(/[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g) || [];
        const chineseCharacters = text.match(/[\u3400-\u9fff]/g) || [];
        return latinWords.length + chineseCharacters.length;
    }

    function updateStats() {
        const value = editor.value;
        stats.textContent = `${countWords(value).toLocaleString("zh-CN")} 字 · ${value.length.toLocaleString("zh-CN")} 字符`;

        const beforeCursor = value.slice(0, editor.selectionStart);
        const lines = beforeCursor.split("\n");
        cursorPosition.textContent = `Ln ${lines.length}, Col ${lines[lines.length - 1].length + 1}`;
    }

    function render() {
        const unsafeHtml = marked.parse(editor.value, {
            gfm: true,
            breaks: false
        });
        preview.innerHTML = DOMPurify.sanitize(unsafeHtml, {
            USE_PROFILES: { html: true }
        });
        preview.querySelectorAll("pre code").forEach((block) => {
            hljs.highlightElement(block);
        });
        updateStats();
    }

    function saveDraft() {
        localStorage.setItem(STORAGE_KEY, editor.value);
        saveStatus.textContent = `已保存 ${new Date().toLocaleTimeString("zh-CN", {
            hour: "2-digit",
            minute: "2-digit"
        })}`;
    }

    function scheduleSave() {
        saveStatus.textContent = "正在保存…";
        clearTimeout(saveTimer);
        saveTimer = window.setTimeout(saveDraft, 320);
    }

    function replaceSelection(prefix, suffix = prefix, placeholder = "文字") {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const selected = editor.value.slice(start, end) || placeholder;
        editor.setRangeText(`${prefix}${selected}${suffix}`, start, end, "end");
        editor.focus();
        render();
        scheduleSave();
    }

    function prefixLines(prefix) {
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const lineStart = editor.value.lastIndexOf("\n", start - 1) + 1;
        const selected = editor.value.slice(lineStart, end) || "内容";
        const replacement = selected
            .split("\n")
            .map((line) => `${prefix}${line}`)
            .join("\n");
        editor.setRangeText(replacement, lineStart, end, "select");
        editor.focus();
        render();
        scheduleSave();
    }

    function insertBlock(content) {
        const start = editor.selectionStart;
        const prefix = start > 0 && editor.value[start - 1] !== "\n" ? "\n\n" : "";
        editor.setRangeText(`${prefix}${content}`, start, editor.selectionEnd, "end");
        editor.focus();
        render();
        scheduleSave();
    }

    function runCommand(command) {
        const commands = {
            heading: () => prefixLines("## "),
            bold: () => replaceSelection("**", "**"),
            italic: () => replaceSelection("*", "*"),
            link: () => replaceSelection("[", "](https://)", "链接文字"),
            code: () => replaceSelection("`", "`", "code"),
            codeblock: () => insertBlock("```javascript\n// code\n\n```"),
            quote: () => prefixLines("> "),
            list: () => prefixLines("- "),
            task: () => prefixLines("- [ ] "),
            table: () => insertBlock("| 标题一 | 标题二 |\n| --- | --- |\n| 内容 | 内容 |")
        };
        commands[command]?.();
    }

    async function copyText(text, successMessage) {
        await navigator.clipboard.writeText(text);
        showToast(successMessage);
    }

    async function copyHtml() {
        const html = preview.innerHTML;
        try {
            if (window.ClipboardItem && navigator.clipboard.write) {
                await navigator.clipboard.write([
                    new ClipboardItem({
                        "text/html": new Blob([html], { type: "text/html" }),
                        "text/plain": new Blob([preview.innerText], { type: "text/plain" })
                    })
                ]);
            } else {
                await navigator.clipboard.writeText(html);
            }
            showToast("HTML 已复制");
        } catch (error) {
            console.error(error);
            showToast("复制失败，请检查浏览器权限");
        }
    }

    function downloadMarkdown() {
        const blob = new Blob([editor.value], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "document.md";
        anchor.click();
        URL.revokeObjectURL(url);
        showToast("Markdown 文件已下载");
    }

    function setTheme(theme) {
        document.documentElement.dataset.theme = theme;
        themeToggle.textContent = theme === "dark" ? "LIGHT" : "DARK";
        themeToggle.setAttribute("aria-label", theme === "dark" ? "切换到明亮主题" : "切换到深色主题");
        localStorage.setItem(THEME_KEY, theme);
    }

    document.querySelectorAll("[data-command]").forEach((button) => {
        button.addEventListener("click", () => runCommand(button.dataset.command));
    });

    document.querySelectorAll("[data-view]").forEach((button) => {
        button.addEventListener("click", () => {
            const view = button.dataset.view;
            workspace.dataset.mobileView = view;
            document.querySelectorAll("[data-view]").forEach((tab) => {
                tab.setAttribute("aria-pressed", String(tab === button));
            });
        });
    });

    editor.addEventListener("input", () => {
        render();
        scheduleSave();
    });
    editor.addEventListener("click", updateStats);
    editor.addEventListener("keyup", updateStats);

    editor.addEventListener("keydown", (event) => {
        if (event.key === "Tab") {
            event.preventDefault();
            editor.setRangeText("    ", editor.selectionStart, editor.selectionEnd, "end");
            render();
            scheduleSave();
            return;
        }

        if (!(event.metaKey || event.ctrlKey)) return;
        const key = event.key.toLowerCase();
        if (key === "b") {
            event.preventDefault();
            runCommand("bold");
        } else if (key === "i") {
            event.preventDefault();
            runCommand("italic");
        } else if (key === "k") {
            event.preventDefault();
            runCommand("link");
        } else if (key === "s") {
            event.preventDefault();
            saveDraft();
            showToast("草稿已保存在本机");
        }
    });

    document.getElementById("copy-markdown-button").addEventListener("click", async () => {
        try {
            await copyText(editor.value, "Markdown 已复制");
        } catch (error) {
            console.error(error);
            showToast("复制失败，请检查浏览器权限");
        }
    });
    document.getElementById("copy-html-button").addEventListener("click", copyHtml);
    document.getElementById("download-button").addEventListener("click", downloadMarkdown);
    document.getElementById("print-button").addEventListener("click", () => window.print());

    document.getElementById("sample-button").addEventListener("click", () => {
        if (editor.value && editor.value !== DEFAULT_DOCUMENT && !window.confirm("载入示例会覆盖当前草稿，确定继续吗？")) return;
        editor.value = DEFAULT_DOCUMENT;
        render();
        saveDraft();
        showToast("示例文档已载入");
    });

    document.getElementById("clear-button").addEventListener("click", () => {
        if (!editor.value || !window.confirm("确定清空当前文档吗？清空后仍可立即撤销。")) return;
        const previous = editor.value;
        editor.value = "";
        render();
        saveDraft();
        showToast("文档已清空；按 Ctrl / ⌘ + Z 可撤销");
        editor.addEventListener("keydown", function restoreOnce(event) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z" && !editor.value) {
                event.preventDefault();
                editor.value = previous;
                render();
                saveDraft();
                editor.removeEventListener("keydown", restoreOnce);
            }
        });
    });

    themeToggle.addEventListener("click", () => {
        setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark");
    });

    const savedTheme = localStorage.getItem(THEME_KEY);
    setTheme(savedTheme === "light" ? "light" : "dark");
    editor.value = localStorage.getItem(STORAGE_KEY) || DEFAULT_DOCUMENT;
    render();
}());
