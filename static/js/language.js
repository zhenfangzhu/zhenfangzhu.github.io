(function () {
    "use strict";

    const STORAGE_KEY = "site-language";
    const MODE_STORAGE_KEY = "site-reading-mode";
    const supportedLanguages = new Set(["zh", "en"]);
    const supportedModes = new Set(["dream", "reality"]);

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

    function currentReadingMode() {
        const mode = document.documentElement.dataset.readingMode;
        return supportedModes.has(mode) ? mode : "dream";
    }

    function applyReadingMode(mode, remember) {
        const nextMode = supportedModes.has(mode) ? mode : "dream";
        document.documentElement.dataset.readingMode = nextMode;

        document.querySelectorAll("[data-set-mode]").forEach((button) => {
            button.setAttribute("aria-pressed", String(button.dataset.setMode === nextMode));
        });

        if (remember) {
            try {
                window.localStorage.setItem(MODE_STORAGE_KEY, nextMode);
            } catch (error) {
                // The mode still changes when browser storage is unavailable.
            }
        }
    }

    function transitionReadingMode(mode) {
        const nextMode = supportedModes.has(mode) ? mode : "dream";
        if (nextMode === currentReadingMode()) return;

        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            applyReadingMode(nextMode, true);
            return;
        }

        document.documentElement.classList.add("is-mode-changing");
        window.setTimeout(() => {
            applyReadingMode(nextMode, true);
            window.requestAnimationFrame(() => {
                document.documentElement.classList.remove("is-mode-changing");
            });
        }, 100);
    }

    window.addEventListener("DOMContentLoaded", () => {
        applyLanguage(currentLanguage(), false);
        applyReadingMode(currentReadingMode(), false);
        document.querySelectorAll(".language-toggle").forEach((button) => {
            button.addEventListener("click", () => {
                const nextLanguage = currentLanguage() === "zh" ? "en" : "zh";
                applyLanguage(nextLanguage, true);
            });
        });

        document.querySelectorAll("[data-set-mode]").forEach((button) => {
            button.addEventListener("click", () => transitionReadingMode(button.dataset.setMode));
        });
    });
}());
