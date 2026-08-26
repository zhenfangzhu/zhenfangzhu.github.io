(() => {
    "use strict";

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
