(() => {
    const cards = [...document.querySelectorAll('.echo-card')];
    const input = document.querySelector('#echo-search');
    if (!input) return;
    const tools = document.querySelector('.echoes-tools');
    const toggle = document.querySelector('#echo-search-toggle');
    const field = document.querySelector('#echo-search-field');
    const language = () => document.documentElement.dataset.language === 'en' ? 'en' : 'zh';
    const text = (zh, en) => language() === 'en' ? en : zh;
    const haystacks = new Map(cards.map(card => [card, card.textContent.toLocaleLowerCase()]));
    tools.hidden = false;
    function update() {
        const query = input.value.trim().toLocaleLowerCase();
        cards.forEach(card => { card.hidden = !haystacks.get(card).includes(query); });
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
    toggle.addEventListener('click', () => setSearchOpen(field.hidden, true));
    tools.addEventListener('keydown', event => {
        if (event.key === 'Escape' && !event.isComposing && !field.hidden) {
            event.preventDefault();
            setSearchOpen(false, true);
        }
    });
    input.addEventListener('input', update);
    function revealHash() {
        const id = location.hash.slice(1);
        const card = cards.find(card => card.id === id);
        if (!card) return;
        input.value = '';
        update();
        requestAnimationFrame(() => card.scrollIntoView({ block: 'start', behavior: 'instant' }));
    }
    window.addEventListener('hashchange', revealHash);
    window.addEventListener('pageshow', () => {
        if (input.value.trim()) setSearchOpen(true);
        else update();
    });
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-language'] });
    update();
    revealHash();
})();
