(() => {
    const cards = [...document.querySelectorAll('.echo-card')];
    const input = document.querySelector('#echo-search');
    if (!input) return;
    const tools = document.querySelector('.echoes-tools');
    const toggle = document.querySelector('#echo-search-toggle');
    const field = document.querySelector('#echo-search-field');
    const language = () => document.documentElement.dataset.language === 'en' ? 'en' : 'zh';
    const text = (zh, en) => language() === 'en' ? en : zh;
    const normalize = value => value.normalize('NFKC').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
    const haystacks = new Map(cards.map(card => [card, normalize(`${card.textContent} ${card.dataset.searchText || ''}`)]));
    const stateKey = 'echoesDirectory';
    const returnKey = id => `echoes:return:${id}`;
    let scrollFrame;
    tools.hidden = false;
    function update() {
        const terms = normalize(input.value).split(' ').filter(Boolean);
        cards.forEach(card => { card.hidden = !terms.every(term => haystacks.get(card).includes(term)); });
        const visible = cards.filter(card => !card.hidden);
        const readable = visible.filter(card => card.querySelector('a[href]'));
        const pending = visible.length - readable.length;
        document.querySelector('#echo-count').textContent = text(`${readable.length} 篇笔记${pending ? ` · ${pending} 篇待整理` : ''}`, `${readable.length} ${readable.length === 1 ? 'note' : 'notes'}${pending ? ` · ${pending} pending` : ''}`);
        document.querySelector('#echo-empty').hidden = visible.length > 0;
        input.placeholder = text('搜索回声', 'Search echoes');
        const label = field.hidden ? text('搜索回声', 'Search echoes') : text('关闭搜索', 'Close search');
        toggle.setAttribute('aria-label', label);
        toggle.title = label;
    }
    function setSearchOpen(open, focus = false) {
        field.hidden = !open;
        toggle.setAttribute('aria-expanded', String(open));
        if (!open) input.value = '';
        update();
        if (focus) (open ? input : toggle).focus();
    }
    function saveState(articleId) {
        const state = { query: input.value, open: !field.hidden, scrollY: window.scrollY, hash: location.hash };
        try { history.replaceState({ ...history.state, [stateKey]: state }, ''); } catch (_) {}
        if (articleId) {
            try { sessionStorage.setItem(returnKey(articleId), JSON.stringify(state)); } catch (_) {}
        }
    }
    function validState(state) {
        return state && typeof state.query === 'string' && typeof state.open === 'boolean'
            && Number.isFinite(state.scrollY) && state.scrollY >= 0;
    }
    function articleReturnState() {
        const id = location.hash.slice(1);
        if (!cards.some(card => card.id === id)) return null;
        try {
            const referrer = new URL(document.referrer);
            // Only a return from this article may restore its previous search.
            // Fresh directory visits and shared anchors keep their normal behavior.
            if (referrer.origin !== location.origin || referrer.pathname !== `/echoes/${id}/`) return null;
            const state = JSON.parse(sessionStorage.getItem(returnKey(id)));
            return validState(state) ? state : null;
        } catch (_) { return null; }
    }
    function restorePage() {
        cancelAnimationFrame(scrollFrame);
        const saved = history.state?.[stateKey];
        const state = validState(saved) && saved.hash === location.hash ? saved : articleReturnState();
        if (state) {
            input.value = state.query;
            setSearchOpen(state.open || Boolean(state.query.trim()));
            scrollFrame = requestAnimationFrame(() => {
                window.scrollTo({ top: state.scrollY, behavior: 'instant' });
                saveState();
            });
            return;
        }
        const card = cards.find(card => card.id === location.hash.slice(1));
        if (card) setSearchOpen(false);
        else update();
        scrollFrame = requestAnimationFrame(() => {
            if (card) card.scrollIntoView({ block: 'start', behavior: 'instant' });
            saveState();
        });
    }
    toggle.addEventListener('click', () => {
        setSearchOpen(field.hidden, true);
        saveState();
    });
    tools.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.isComposing && !field.hidden) {
            event.preventDefault();
            setSearchOpen(false, true);
            saveState();
        }
    });
    input.addEventListener('input', () => {
        update();
        saveState();
    });
    cards.forEach(card => {
        const link = card.querySelector('a[href]');
        if (!link) return;
        link.addEventListener('click', () => saveState(card.id));
        link.addEventListener('auxclick', () => saveState(card.id));
    });
    window.addEventListener('pagehide', () => saveState());
    window.addEventListener('pageshow', restorePage);
    window.addEventListener('popstate', restorePage);
    window.addEventListener('hashchange', restorePage);
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-language'] });
    restorePage();
})();
