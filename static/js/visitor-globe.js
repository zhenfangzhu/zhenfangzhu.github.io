(() => {
    const globe = document.querySelector('.visitor-globe');
    const button = document.querySelector('.visitor-pause');
    if (!globe || !button) return;
    const labelGlobe = () => {
        const link = globe.querySelector('#mmvst_a');
        if (!link) return;
        link.setAttribute('aria-label', globe.getAttribute('aria-label'));
        observer.disconnect();
    };
    const observer = new MutationObserver(labelGlobe);
    observer.observe(globe, { childList: true, subtree: true });
    labelGlobe();
    button.addEventListener('click', () => {
        const paused = !globe.classList.contains('is-paused');
        if (paused) {
            globe.querySelectorAll('.mmvst_map_f, .mmvst_map_b, .mmvst_dots').forEach(layer => {
                layer.style.setProperty('--paused-transform', getComputedStyle(layer).transform);
            });
        }
        globe.classList.toggle('is-paused', paused);
        button.setAttribute('aria-pressed', String(paused));
        button.querySelectorAll('[data-lang]').forEach(label => {
            label.textContent = label.dataset.lang === 'zh'
                ? (paused ? '继续旋转' : '暂停旋转')
                : (paused ? 'Resume rotation' : 'Pause rotation');
        });
    });
})();
