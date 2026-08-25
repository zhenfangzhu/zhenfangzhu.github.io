(function () {
    "use strict";

    const STORAGE_KEY = "site-language";
    const supportedLanguages = new Set(["zh", "en"]);

    function currentLanguage() {
        const language = document.documentElement.dataset.language;
        return supportedLanguages.has(language) ? language : "en";
    }

    function applyLanguage(language, remember) {
        const nextLanguage = supportedLanguages.has(language) ? language : "en";
        document.documentElement.dataset.language = nextLanguage;
        document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";

        const title = nextLanguage === "zh" ? document.body.dataset.titleZh : document.body.dataset.titleEn;
        if (title) document.title = title;

        document.querySelectorAll(".language-select, [data-language-select]").forEach((select) => {
            select.value = nextLanguage;
        });

        if (remember) {
            try {
                window.localStorage.setItem(STORAGE_KEY, nextLanguage);
            } catch (error) {
                // The language still changes when browser storage is unavailable.
            }
        }
    }

    window.addEventListener("DOMContentLoaded", () => {
        applyLanguage(currentLanguage(), false);
        document.querySelectorAll(".language-select, [data-language-select]").forEach((select) => {
            select.addEventListener("change", () => applyLanguage(select.value, true));
        });
    });
}());
