(() => {
    "use strict";

    const STORAGE_KEY = "site-language";
    const SUPPORTED = new Set(["zh", "en"]);
    const originalText = new WeakMap();
    const originalAttributes = new WeakMap();
    let observer;

    function storedLanguage() {
        try {
            const stored = window.localStorage.getItem(STORAGE_KEY);
            if (SUPPORTED.has(stored)) return stored;
        } catch (error) {
            // Continue with the page default when storage is unavailable.
        }
        return SUPPORTED.has(document.documentElement.dataset.language)
            ? document.documentElement.dataset.language
            : "zh";
    }

    function text(key, fallback) {
        const language = currentLanguage();
        return window.SITE_I18N?.[language]?.[key]
            ?? window.SITE_I18N?.zh?.[key]
            ?? fallback
            ?? key;
    }

    function currentLanguage() {
        return document.documentElement.dataset.language === "en" ? "en" : "zh";
    }

    function translateElement(element) {
        const key = element.dataset.i18n;
        if (key) element.textContent = text(key, element.textContent);

        const datasetKeys = { placeholder: "i18nPlaceholder", title: "i18nTitle", "aria-label": "i18nAriaLabel" };
        ["placeholder", "title", "aria-label"].forEach((attribute) => {
            const attributeKey = element.dataset[datasetKeys[attribute]];
            if (attributeKey) element.setAttribute(attribute, text(attributeKey, element.getAttribute(attribute)));
        });
    }

    function translate(root = document) {
        if (root.nodeType === Node.ELEMENT_NODE && root.matches?.("[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]")) {
            translateElement(root);
        }
        root.querySelectorAll?.("[data-i18n], [data-i18n-placeholder], [data-i18n-title], [data-i18n-aria-label]").forEach(translateElement);
        translateTextNodes(root);
    }

    function translatedText(source) {
        const trimmed = source.trim();
        const exact = window.SITE_TEXT_TRANSLATIONS?.[trimmed];
        if (exact) return source.replace(trimmed, exact);
        const rules = window.SITE_TEXT_TRANSLATION_RULES || [];
        return rules.reduce((value, [pattern, replacement]) => value.replace(pattern, replacement), source);
    }

    function translateTextNodes(root) {
        if (!window.SITE_TEXT_TRANSLATIONS) return;
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode(node) {
                const parent = node.parentElement;
                if (!parent || parent.closest("script, style, textarea, input, [data-no-translate]")) return NodeFilter.FILTER_REJECT;
                return node.nodeValue.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        const nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach((node) => {
            if (!originalText.has(node)) originalText.set(node, node.nodeValue);
            const source = originalText.get(node);
            node.nodeValue = currentLanguage() === "en" ? translatedText(source) : source;
        });
        root.querySelectorAll?.("[placeholder], [title], [aria-label]").forEach((element) => {
            let sources = originalAttributes.get(element);
            if (!sources) {
                sources = {};
                originalAttributes.set(element, sources);
            }
            ["placeholder", "title", "aria-label"].forEach((attribute) => {
                if (!element.hasAttribute(attribute) || element.hasAttribute(`data-i18n-${attribute}`)) return;
                if (!(attribute in sources)) sources[attribute] = element.getAttribute(attribute);
                const source = sources[attribute];
                element.setAttribute(attribute, currentLanguage() === "en" ? translatedText(source) : source);
            });
        });
    }

    function updatePicker() {
        const button = document.querySelector(".site-language-toggle");
        if (!button) return;
        const language = currentLanguage();
        button.textContent = language === "zh" ? "EN" : "中文";
        const label = language === "zh" ? "Switch to English" : "切换到中文";
        button.setAttribute("aria-label", label);
        button.title = label;
    }

    function applyLanguage(language, remember = true) {
        const next = SUPPORTED.has(language) ? language : "zh";
        document.documentElement.dataset.language = next;
        document.documentElement.lang = next === "zh" ? "zh-CN" : "en";
        translate();
        updatePicker();

        const title = next === "zh" ? document.body?.dataset.titleZh : document.body?.dataset.titleEn;
        if (title) document.title = title;

        if (remember) {
            try { window.localStorage.setItem(STORAGE_KEY, next); } catch (error) {}
        }
        window.dispatchEvent(new CustomEvent("site-language-change", { detail: { language: next } }));
    }

    function injectPicker() {
        if (document.querySelector(".language-picker, .site-language-picker")) return;
        const wrapper = document.createElement("div");
        wrapper.className = "site-language-picker";
        wrapper.innerHTML = '<button class="site-language-toggle" type="button"></button>';
        wrapper.querySelector("button").addEventListener("click", () => {
            applyLanguage(currentLanguage() === "zh" ? "en" : "zh");
        });
        document.body.appendChild(wrapper);
    }

    window.siteLanguage = { apply: applyLanguage, current: currentLanguage, text, translate };

    document.addEventListener("DOMContentLoaded", () => {
        injectPicker();
        applyLanguage(storedLanguage(), false);
        if (window.SITE_TEXT_TRANSLATIONS) {
            observer = new MutationObserver((mutations) => {
                if (currentLanguage() !== "en") return;
                mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) translate(node);
                }));
            });
            observer.observe(document.body, { childList: true, subtree: true });
        }
    });
})();
