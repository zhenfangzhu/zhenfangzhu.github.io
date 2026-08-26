const CONTENT_DIRECTORY = 'contents/';
const CONTENT_VERSION = '2026082606';
const SECTIONS = [
    { file: 'publications.md', target: 'publications-md' },
    { file: 'awards.md', target: 'awards-md' },
];

async function fetchText(path) {
    const response = await fetch(`${path}?v=${CONTENT_VERSION}`);
    if (!response.ok) {
        throw new Error(`Unable to load ${path} (${response.status})`);
    }
    return response.text();
}

function showLoadError(targetId) {
    const target = document.getElementById(targetId);
    if (target) {
        target.innerHTML = '<p class="content-error" role="status"><span data-lang="en">This section could not be loaded. Please refresh the page.</span><span data-lang="zh">这部分内容暂时没加载出来，请刷新页面。</span></p>';
    }
}

async function loadConfig() {
    try {
        const yaml = await fetchText(`${CONTENT_DIRECTORY}config.yml`);
        const config = jsyaml.load(yaml);
        Object.entries(config).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.innerHTML = value;
            }
        });
    } catch (error) {
        console.error(error);
    }
}

async function loadSection({ file, target }) {
    try {
        const markdown = await fetchText(`${CONTENT_DIRECTORY}${file}`);
        document.getElementById(target).innerHTML = marked.parse(markdown);
    } catch (error) {
        console.error(error);
        showLoadError(target);
    }
}

function initializeNavigation() {
    const mainNav = document.getElementById('mainNav');
    if (mainNav) {
        bootstrap.ScrollSpy.getOrCreateInstance(document.body, {
            target: '#mainNav',
            rootMargin: '-20% 0px -70%',
            smoothScroll: false,
        });
    }

    const toggler = document.querySelector('.navbar-toggler');
    document.querySelectorAll('#navbarResponsive .nav-link').forEach((link) => {
        link.addEventListener('click', () => {
            if (toggler && window.getComputedStyle(toggler).display !== 'none') {
                bootstrap.Collapse.getOrCreateInstance('#navbarResponsive').hide();
            }
        });
    });
}

window.addEventListener('DOMContentLoaded', async () => {
    marked.use({ mangle: false, headerIds: false });

    await Promise.all([loadConfig(), ...SECTIONS.map(loadSection)]);

    document.querySelectorAll('#current-year').forEach((element) => {
        element.textContent = new Date().getFullYear();
    });

    if (window.MathJax?.typesetPromise) {
        await window.MathJax.typesetPromise();
    }

    initializeNavigation();
});
