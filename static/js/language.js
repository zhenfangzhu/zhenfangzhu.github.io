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

        document.querySelectorAll(".language-toggle").forEach((button) => {
            const label = nextLanguage === "zh" ? "Switch to English" : "切换到中文";
            button.setAttribute("aria-label", label);
            button.title = label;
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
        document.querySelectorAll(".language-toggle").forEach((button) => {
            button.addEventListener("click", () => {
                const nextLanguage = currentLanguage() === "zh" ? "en" : "zh";
                applyLanguage(nextLanguage, true);
            });
        });
    });
}());
