(function () {
    "use strict";

    const STORAGE_KEY = "site-language";
    const supportedLanguages = new Set(["zh", "en"]);

    function currentLanguage() {
        const language = document.documentElement.dataset.language;
        return supportedLanguages.has(language) ? language : "en";
    }

    function activateBioView(view) {
        const nextView = view === "long" ? "long" : "default";
        document.querySelectorAll("[data-bio-view]").forEach((button) => {
            const selected = button.dataset.bioView === nextView;
            button.setAttribute("aria-selected", String(selected));
            button.tabIndex = selected ? 0 : -1;
        });
        document.querySelectorAll(".bio-view-panel").forEach((panel) => {
            panel.hidden = panel.id !== `bio-${nextView}`;
        });
    }

    function applyLanguage(language, remember) {
        const nextLanguage = supportedLanguages.has(language) ? language : "en";
        document.documentElement.dataset.language = nextLanguage;
        document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";

        const title = nextLanguage === "zh" ? document.body.dataset.titleZh : document.body.dataset.titleEn;
        if (title) document.title = title;

        document.querySelectorAll(".language-toggle").forEach((button) => {
            const label = nextLanguage === "zh" ? "选择语言" : "Choose language";
            button.setAttribute("aria-label", label);
            button.title = label;
        });
        document.querySelectorAll("[data-language-option]").forEach((option) => {
            option.setAttribute("aria-checked", String(option.dataset.languageOption === nextLanguage));
        });

        if (remember) {
            try {
                window.localStorage.setItem(STORAGE_KEY, nextLanguage);
            } catch (error) {
                // The language still changes when browser storage is unavailable.
            }
        }
    }

    function setLanguageMenuOpen(picker, open) {
        const toggle = picker.querySelector(".language-toggle");
        const menu = picker.querySelector(".language-menu");
        if (!toggle || !menu) return;
        toggle.setAttribute("aria-expanded", String(open));
        menu.hidden = !open;
    }

    window.addEventListener("DOMContentLoaded", () => {
        applyLanguage(currentLanguage(), false);
        document.querySelectorAll(".language-toggle").forEach((button) => {
            const picker = button.closest(".language-picker");
            if (picker) {
                button.addEventListener("click", (event) => {
                    event.stopPropagation();
                    const shouldOpen = button.getAttribute("aria-expanded") !== "true";
                    document.querySelectorAll(".language-picker").forEach((item) => setLanguageMenuOpen(item, false));
                    setLanguageMenuOpen(picker, shouldOpen);
                });
                return;
            }
            button.addEventListener("click", () => {
                const nextLanguage = currentLanguage() === "zh" ? "en" : "zh";
                applyLanguage(nextLanguage, true);
            });
        });
        document.querySelectorAll("[data-language-option]").forEach((option) => {
            option.addEventListener("click", () => {
                applyLanguage(option.dataset.languageOption, true);
                const picker = option.closest(".language-picker");
                if (picker) {
                    setLanguageMenuOpen(picker, false);
                    picker.querySelector(".language-toggle")?.focus();
                }
            });
        });
        document.querySelectorAll(".language-picker").forEach((picker) => {
            picker.addEventListener("keydown", (event) => {
                if (event.key !== "Escape") return;
                setLanguageMenuOpen(picker, false);
                picker.querySelector(".language-toggle")?.focus();
            });
        });
        document.addEventListener("click", () => {
            document.querySelectorAll(".language-picker").forEach((picker) => setLanguageMenuOpen(picker, false));
        });
        document.querySelectorAll("[data-bio-view]").forEach((button) => {
            button.addEventListener("click", () => activateBioView(button.dataset.bioView));
            button.addEventListener("keydown", (event) => {
                if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
                event.preventDefault();
                const nextView = button.dataset.bioView === "default" ? "long" : "default";
                const nextButton = document.querySelector(`[data-bio-view="${nextView}"]`);
                if (nextButton && !nextButton.hidden) {
                    activateBioView(nextView);
                    nextButton.focus();
                }
            });
        });
    });
}());
