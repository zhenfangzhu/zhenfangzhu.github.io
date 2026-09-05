(() => {
    "use strict";

    const filters = [...document.querySelectorAll("[data-dream-filter]")];
    const entries = [...document.querySelectorAll("[data-dream-category]")];

    function applyFilter() {
        const requested = window.location.hash.slice(1);
        const category = filters.some(link => link.dataset.dreamFilter === requested) ? requested : "all";
        let visible = 0;
        entries.forEach(entry => {
            entry.hidden = category !== "all" && entry.dataset.dreamCategory !== category;
            if (!entry.hidden) visible += 1;
        });
        filters.forEach(link => {
            const active = link.dataset.dreamFilter === category;
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
        });
        document.querySelectorAll("[data-dream-count]").forEach(count => {
            count.textContent = String(visible);
        });
    }

    if (filters.length) {
        applyFilter();
        window.addEventListener("hashchange", applyFilter);
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    function canUseFallback() {
        return !("startViewTransition" in document) && !reduceMotion.matches;
    }

    document.addEventListener("click", (event) => {
        const link = event.target.closest("a[data-dream-link]");

        if (!link || event.defaultPrevented || event.button !== 0 ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey ||
            link.target || link.download || link.origin !== window.location.origin ||
            !canUseFallback()) {
            return;
        }

        event.preventDefault();
        document.documentElement.classList.add("dream-is-leaving");

        window.setTimeout(() => {
            window.location.assign(link.href);
        }, 160);
    });
})();
