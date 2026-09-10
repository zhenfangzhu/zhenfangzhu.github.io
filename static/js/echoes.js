(() => {
    const cards = [...document.querySelectorAll('.echo-card')];
    const input = document.querySelector('#echo-search');
    if (!input) return;
    const toggle = document.querySelector('#echo-toggle-all');
    const language = () => document.documentElement.dataset.language === 'en' ? 'en' : 'zh';
    const text = (zh, en) => language() === 'en' ? en : zh;
    const haystacks = new Map(cards.map(card => [card, card.textContent.toLocaleLowerCase()]));
    document.querySelector('.echoes-tools').hidden = false;
    document.querySelectorAll('.echo-close').forEach(button => {
        button.hidden = false;
        button.addEventListener('click', () => {
            const card = button.closest('details');
            card.open = false;
            card.querySelector('summary').focus({ preventScroll: true });
            card.scrollIntoView({ block: 'start', behavior: 'instant' });
        });
    });
    function update() {
        const query = input.value.trim().toLocaleLowerCase();
        cards.forEach(card => { card.hidden = !haystacks.get(card).includes(query); });
        const visible = cards.filter(card => !card.hidden);
        const readable = visible.filter(card => card.matches('details'));
        const allOpen = readable.length > 0 && readable.every(card => card.open);
        toggle.disabled = readable.length === 0;
        toggle.textContent = allOpen ? text('收起全部', 'Collapse all') : text('展开全部', 'Expand all');
        document.querySelector('#echo-count').textContent = text(`${visible.length} 条记录 · ${readable.length} 篇笔记`, `${visible.length} entries · ${readable.length} notes`);
        document.querySelector('#echo-empty').hidden = visible.length > 0;
        input.placeholder = text('标题、人物或正文', 'Title, person or text');
    }
    input.addEventListener('input', update);
    cards.filter(card => card.matches('details')).forEach(card => card.addEventListener('toggle', update));
    toggle.addEventListener('click', () => {
        const visible = cards.filter(card => !card.hidden && card.matches('details'));
        const open = !visible.every(card => card.open);
        visible.forEach(card => { card.open = open; });
        update();
    });
    function openHash() {
        const id = location.hash.slice(1);
        const card = cards.find(card => card.id === id);
        if (!card) return;
        input.value = '';
        update();
        if (card.matches('details')) card.open = true;
        requestAnimationFrame(() => card.scrollIntoView({ block: 'start', behavior: 'instant' }));
    }
    window.addEventListener('hashchange', openHash);
    new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['data-language'] });
    update();
    openHash();
})();
