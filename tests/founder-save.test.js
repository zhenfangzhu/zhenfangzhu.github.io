const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const html = readFileSync(join(__dirname, "../founder-dna/index.html"), "utf8");
const source = [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)]
    .map(match => match[1]).find(script => script.includes("const STORAGE_KEY='founder-dna-v2'"));
assert.ok(source, "The application inline script must be present");
const storageKey = "founder-dna-v2";
const decode = value => value.replace(/&(?:amp|lt|gt|quot|#39);/g, entity => ({
    "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'"
}[entity]));
const camel = value => value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());

// Only DOM APIs used by this application are modeled. All rendering and event handlers run unmodified.
class MemoryElement {
    constructor(tag, document) {
        this.tagName = tag.toUpperCase();
        this.ownerDocument = document;
        this.attributes = new Map();
        this.dataset = {};
        this.childNodes = [];
        this.listeners = new Map();
        this.parentNode = null;
        this.hidden = false;
        this.disabled = false;
        this.checked = false;
        this.value = "";
        this.classList = {
            add: name => this.attributes.set("class", [...new Set([...this.classes(), name])].join(" ")),
            remove: name => this.attributes.set("class", this.classes().filter(value => value !== name).join(" ")),
            toggle: (name, force) => (force ?? !this.classes().includes(name)) ? this.classList.add(name) : this.classList.remove(name),
            contains: name => this.classes().includes(name)
        };
    }

    classes() { return (this.attributes.get("class") || "").split(/\s+/).filter(Boolean); }
    get children() { return this.childNodes.filter(node => node instanceof MemoryElement); }
    get textContent() { return this.childNodes.map(node => typeof node === "string" ? node : node.textContent).join(""); }
    set textContent(value) { this.childNodes = [String(value)]; }
    set innerHTML(value) { this.childNodes = []; this.insertAdjacentHTML("beforeend", value); }
    setAttribute(name, value) {
        value = String(value);
        this.attributes.set(name, value);
        if (name.startsWith("data-")) this.dataset[camel(name.slice(5))] = value;
        if (["hidden", "disabled", "checked"].includes(name)) this[name] = true;
        if (["id", "value", "name", "type"].includes(name)) this[name] = value;
    }
    getAttribute(name) { return name.startsWith("data-") ? this.dataset[camel(name.slice(5))] : this.attributes.get(name); }
    removeAttribute(name) {
        this.attributes.delete(name);
        if (name.startsWith("data-")) delete this.dataset[camel(name.slice(5))];
        if (["hidden", "disabled", "checked"].includes(name)) this[name] = false;
    }
    matches(selector) {
        const tag = selector.match(/^[\w-]+/)?.[0];
        if (tag && this.tagName !== tag.toUpperCase()) return false;
        const id = selector.match(/#([\w-]+)/)?.[1];
        if (id && this.id !== id) return false;
        for (const [, name] of selector.matchAll(/\.([\w-]+)/g)) if (!this.classes().includes(name)) return false;
        for (const [, name, expected] of selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']*)["']?)?\]/g)) {
            const value = this.getAttribute(name);
            if (value === undefined || (expected !== undefined && value !== expected)) return false;
        }
        return true;
    }
    querySelectorAll(selector) {
        const selectors = selector.split(",").map(value => value.trim());
        const result = [];
        const visit = node => {
            for (const child of node.children) {
                if (selectors.some(value => {
                    const parts = value.split(/\s+(?=[.#\[])/);
                    if (!child.matches(parts.pop())) return false;
                    let parent = child.parentNode;
                    while (parts.length) {
                        const part = parts.pop();
                        while (parent && !parent.matches(part)) parent = parent.parentNode;
                        if (!parent) return false;
                        parent = parent.parentNode;
                    }
                    return true;
                })) result.push(child);
                visit(child);
            }
        };
        visit(this);
        return result;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    appendChild(node) { node.remove(); node.parentNode = this; this.childNodes.push(node); return node; }
    append(...nodes) { nodes.forEach(node => this.appendChild(node)); }
    remove() {
        if (this.parentNode) this.parentNode.childNodes = this.parentNode.childNodes.filter(node => node !== this);
        this.parentNode = null;
    }
    insertAdjacentHTML(position, value) {
        assert.equal(position, "beforeend");
        const stack = [this];
        for (const token of value.matchAll(/<\/?([a-z][\w:-]*)\b([^>]*?)>|([^<]+)/gi)) {
            if (token[3] !== undefined) { stack.at(-1).childNodes.push(decode(token[3])); continue; }
            const tag = token[1].toLowerCase();
            if (token[0].startsWith("</")) {
                const node = stack.pop();
                if (["textarea", "option"].includes(tag)) node.value = node.textContent;
                continue;
            }
            const node = new MemoryElement(tag, this.ownerDocument);
            for (const [, name, double, single, bare] of token[2].matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
                node.setAttribute(name, decode(double ?? single ?? bare ?? ""));
            }
            stack.at(-1).appendChild(node);
            if (!["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"].includes(tag) && !token[0].endsWith("/>")) stack.push(node);
        }
    }
    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
    }
    emit(type, event = {}) {
        event.target ||= this;
        event.preventDefault ||= () => { event.defaultPrevented = true; };
        this[`on${type}`]?.(event);
        (this.listeners.get(type) || []).forEach(listener => listener(event));
        return event;
    }
    click() {
        if (this.disabled) return;
        if (this.tagName === "A" && this.download) this.ownerDocument.downloads.push({ name: this.download, blob: this.ownerDocument.blobs.get(this.href) });
        else this.emit("click");
    }
    focus() { this.ownerDocument.activeElement = this; }
    scrollIntoView() {}
}

let initialFixture;

function setup(options = {}) {
    const initial = initialFixture;
    const storage = {
        value: Object.hasOwn(options, "storedValue") ? options.storedValue : initial,
        attempts: [], readError: options.readError || null, writeError: null,
        getItem(key) { assert.equal(key, storageKey); if (this.readError) throw this.readError; return this.value; },
        setItem(key, value) {
            assert.equal(key, storageKey);
            this.attempts.push(value);
            if (this.writeError) throw this.writeError;
            this.value = value;
        }
    };
    const document = new MemoryElement("document");
    document.ownerDocument = document;
    document.blobs = new Map();
    document.downloads = [];
    document.documentElement = new MemoryElement("html", document);
    document.documentElement.dataset.language = "zh";
    document.appendChild(document.documentElement);
    document.body = new MemoryElement("body", document);
    document.documentElement.appendChild(document.body);
    document.body.innerHTML = '<div id="app"></div><div id="toast"></div><input id="file-import" type="file">';
    document.getElementById = id => document.querySelector(`#${id}`);
    document.createElement = tag => new MemoryElement(tag, document);
    const timers = new Map();
    let nextTimer = 0;
    const window = new MemoryElement("window", document);
    window.scrollTo = () => {};
    window.print = () => {};
    window.siteLanguage = { translate() {}, current: () => document.documentElement.dataset.language };
    const setTimeout = (fn, delay) => { const id = ++nextTimer; timers.set(id, { fn, delay }); return id; };
    const clearTimeout = id => timers.delete(id);
    window.setTimeout = setTimeout;
    window.clearTimeout = clearTimeout;
    const confirmations = [];
    const context = vm.createContext({
        window, document, localStorage: storage, Blob, setTimeout, clearTimeout,
        URL: { createObjectURL(blob) { const url = `blob:memory-${document.blobs.size}`; document.blobs.set(url, blob); return url; }, revokeObjectURL(url) { document.blobs.delete(url); } },
        matchMedia: () => ({ matches: false, addEventListener() {} }),
        confirm(message) { confirmations.push(message); return options.confirmResult ?? false; },
        FileReader: class { readAsText(file) { this.result = file.contents; this.onload(); } },
        fetch() { throw new Error("Network access is forbidden in these tests"); }
    });
    vm.runInContext(source, context);
    const get = selector => {
        const element = document.querySelector(selector);
        assert.ok(element, `Missing UI element: ${selector}`);
        return element;
    };
    return {
        document, window, storage, initial, timers, confirmations, get,
        click(selector) { get(selector).click(); },
        input(selector, value) { const element = get(selector); element.value = value; element.emit("input"); },
        change(selector, value) { const element = get(selector); element.value = value; element.emit("change"); },
        import(contents) { const element = get("#file-import"); element.files = [{ contents }]; element.emit("change"); },
        state() { return get("#save-state").dataset.state; },
        leave() { return window.emit("beforeunload", { defaultPrevented: false }); },
        tick() { const scheduled = [...timers.values()]; timers.clear(); scheduled.forEach(timer => timer.fn()); },
        async export() {
            this.click('[data-nav="settings"]');
            this.click('[data-action="export-json"]');
            const exported = document.downloads.at(-1);
            assert.ok(exported?.name.endsWith(".json"), "Export must create a JSON download");
            return JSON.parse(await exported.blob.text());
        }
    };
}

function storageError(name) { const error = new Error(name); error.name = name; return error; }

test.before(async () => {
    const app = setup({ storedValue: null });
    app.click('[data-founder-id="C"] [data-welcome-remove]');
    app.input("#welcome-project", "Formal original");
    app.input("#welcome-founder-a", "Alice");
    app.input("#welcome-founder-b", "Bob");
    app.click('[data-welcome="formal"]');
    initialFixture = JSON.stringify(await app.export());
});

for (const errorName of ["QuotaExceededError", "SecurityError"]) {
    test(`${errorName} preserves edits in memory and keeps the failure visible after navigation`, async () => {
        const app = setup();
        app.storage.writeError = storageError(errorName);
        app.click('[data-nav="tasks"]');
        app.click('[data-eval="A-A"]');
        assert.doesNotThrow(() => app.change('[data-answer="explore-1"][value="5"]', "5"));
        assert.equal(app.state(), "error");
        app.click('[data-nav="dashboard"]');
        assert.equal(app.state(), "error");
        assert.equal(app.get("#save-warning").hidden, false);
        assert.equal(app.leave().defaultPrevented, true);
        const exported = await app.export();
        assert.equal(exported.formal.evaluations.find(evaluation => evaluation.id === "A-A").answers["explore-1"], 5);
        assert.equal(app.storage.value, app.initial);
    });
}

test("manual retry saves the latest in-memory root after storage recovers", async () => {
    const app = setup();
    app.storage.writeError = storageError("QuotaExceededError");
    app.click('[data-nav="settings"]');
    app.input('[data-project="type"]', "First unsaved title");
    app.change('[data-project="type"]', "First unsaved title");
    app.input('[data-project="type"]', "Latest unsaved title");
    app.change('[data-project="type"]', "Latest unsaved title");
    app.tick();
    assert.equal(app.state(), "error");
    app.storage.writeError = null;
    app.click('[data-action="retry-save"]');
    assert.equal(JSON.parse(app.storage.value).formal.project.type, "Latest unsaved title");
    assert.equal(app.state(), "saved");
    assert.equal(app.leave().defaultPrevented, false);
});

test("JSON export works while every storage write fails and contains the latest input", async () => {
    const app = setup();
    app.storage.writeError = storageError("SecurityError");
    app.click('[data-nav="calibration"]');
    app.input('[data-cal="consensus"]', "Final words typed just before export");
    const exported = await app.export();
    assert.equal(exported.formal.calibration.consensus, "Final words typed just before export");
    assert.equal(app.storage.value, app.initial);
    assert.equal(app.leave().defaultPrevented, true);
});

test("an event's final keystrokes survive immediate navigation and export without advancing timers", async () => {
    const app = setup();
    app.click('[data-nav="tasks"]');
    app.click('[data-eval="A-A"]');
    app.click('[data-step="9"]');
    app.input('[data-event-field="context"]', "Situation typed immediately before leaving");
    app.input('[data-event-field="action"]', "Latest action");
    app.input('[data-event-field="result"]', "Latest result");
    const exported = await app.export();
    const event = exported.formal.evaluations.find(evaluation => evaluation.id === "A-A").events[0];
    assert.equal(event.context, "Situation typed immediately before leaving");
    assert.equal(event.action, "Latest action");
    assert.equal(event.result, "Latest result");
});

test("calibration consensus and experiment text survive immediate navigation without advancing timers", async () => {
    const app = setup();
    app.click('[data-nav="calibration"]');
    app.input('[data-cal="consensus"]', "Latest consensus");
    app.input('[data-cal-founder="A"] [data-cal-experiment]', "Latest 30-day experiment");
    const exported = await app.export();
    assert.equal(exported.formal.calibration.consensus, "Latest consensus");
    assert.equal(exported.formal.calibration.founders.A.experiment, "Latest 30-day experiment");
});

test("leaving flushes pending input and prompts only if that save fails", () => {
    const app = setup();
    app.click('[data-nav="calibration"]');
    app.input('[data-cal="consensus"]', "Saved during leave");
    assert.equal(app.state(), "unsaved");
    assert.equal(app.leave().defaultPrevented, false);
    assert.equal(JSON.parse(app.storage.value).formal.calibration.consensus, "Saved during leave");
    app.storage.writeError = storageError("QuotaExceededError");
    app.input('[data-cal="consensus"]', "Kept after canceled leave");
    assert.equal(app.leave().defaultPrevented, true);
    assert.equal(app.get('[data-cal="consensus"]').value, "Kept after canceled leave");
    assert.equal(app.state(), "error");
});

test("normal saves keep formal and Demo data separate across mode switches", async () => {
    const app = setup();
    app.click('[data-nav="settings"]');
    app.input('[data-project="type"]', "Formal updated");
    app.change('[data-project="type"]', "Formal updated");
    app.tick();
    app.click('[data-action="switch-mode"]');
    app.click('[data-nav="settings"]');
    app.input('[data-project="type"]', "Demo updated");
    app.change('[data-project="type"]', "Demo updated");
    app.tick();
    app.click('[data-action="switch-mode"]');
    const stored = JSON.parse(app.storage.value);
    assert.equal(stored.activeMode, "formal");
    assert.equal(stored.formal.project.type, "Formal updated");
    assert.equal(stored.demo.project.type, "Demo updated");
    assert.equal(app.state(), "saved");
    assert.equal(app.leave().defaultPrevented, false);
});

test("a failed initial read cannot silently overwrite unknown existing storage", async () => {
    const app = setup({ readError: storageError("SecurityError") });
    assert.equal(app.state(), "read-error");
    assert.equal(app.document.querySelector("#welcome"), null);
    app.click('[data-nav="settings"]');
    app.input('[data-project="type"]', "Temporary in-memory team");
    assert.equal(app.storage.value, app.initial);
    const exported = await app.export();
    assert.equal(exported.formal.project.type, "Temporary in-memory team");
    assert.equal(app.storage.attempts.length, 0);
    app.storage.readError = null;
    app.click('[data-action="retry-save"]');
    assert.equal(app.storage.value, app.initial, "Existing data must remain until the user explicitly chooses replacement");
    assert.equal(app.leave().defaultPrevented, true);
});

test("retry can save a temporary draft when a recovered read confirms storage is empty", async () => {
    const app = setup({ readError: storageError("SecurityError"), storedValue: null });
    app.click('[data-nav="settings"]');
    app.click('[data-action="switch-mode"]');
    assert.equal(app.state(), "read-error");
    assert.equal(app.storage.attempts.length, 0);
    app.storage.readError = null;
    app.click('[data-action="retry-save"]');
    assert.equal(JSON.parse(app.storage.value).activeMode, "demo");
    assert.equal(app.state(), "saved");
    assert.equal(app.leave().defaultPrevented, false);
});

test("malformed stored data is treated as an unreadable backup and is not replaced", async () => {
    const malformed = '{"version":2,"formal":';
    const app = setup({ storedValue: malformed });
    assert.equal(app.state(), "read-error");
    app.click('[data-action="export-stored"]');
    assert.equal(await app.document.downloads.at(-1).blob.text(), malformed);
    app.click('[data-nav="settings"]');
    app.click('[data-action="switch-mode"]');
    const exported = await app.export();
    assert.equal(exported.activeMode, "demo");
    app.click('[data-action="retry-save"]');
    assert.equal(app.storage.attempts.length, 0);
    assert.equal(app.storage.value, malformed);
    assert.equal(app.state(), "read-error");
});

for (const invalidName of ["Alice", ""]) {
    test(`an invalid name ${invalidName ? "matching another founder" : "left blank"} restores the committed name after partial input was saved`, async () => {
        const app = setup();
        app.click('[data-nav="settings"]');
        const partials = invalidName ? ["A", "Al", "Ali", "Alic"] : ["B", "Bo", "Bobby"];
        for (const partial of partials) {
            app.input('[data-founder-name="B"]', partial);
            app.tick();
            assert.equal(JSON.parse(app.storage.value).formal.founders.find(founder => founder.id === "B").name, partial);
        }
        app.input('[data-founder-name="B"]', invalidName);
        app.change('[data-founder-name="B"]', invalidName);
        assert.equal(app.get('[data-founder-name="B"]').value, "Bob");
        assert.equal(JSON.parse(app.storage.value).formal.founders.find(founder => founder.id === "B").name, "Bob");
        assert.equal((await app.export()).formal.founders.find(founder => founder.id === "B").name, "Bob");
        assert.equal(app.state(), "saved");
    });
}

test("retrying a failed read without edits reloads the original data without writing", async () => {
    const app = setup({ readError: storageError("SecurityError") });
    assert.equal(app.document.querySelector("#welcome"), null);
    assert.equal(app.get("#save-warning").hidden, false);
    app.storage.readError = null;
    app.click('[data-action="retry-save"]');
    assert.equal(app.state(), "saved");
    assert.equal(app.get("#save-warning").hidden, true);
    assert.deepEqual(await app.export(), JSON.parse(app.initial));
    assert.equal(app.storage.attempts.length, 0);
    assert.equal(app.storage.value, app.initial);
    assert.equal(app.leave().defaultPrevented, false);
});

test("invalid imported backup structures cannot replace the current memory or stored data", async () => {
    const app = setup({ confirmResult: true });
    const invalidCandidates = [JSON.parse(app.initial), JSON.parse(app.initial)];
    invalidCandidates[0].formal.calibration = null;
    invalidCandidates[1].formal.evaluations[0].answers["explore-1"] = 6;
    for (const candidate of invalidCandidates) {
        app.import(JSON.stringify(candidate));
        assert.match(app.get("#toast").textContent, /导入失败/);
        assert.equal(app.storage.value, app.initial);
        assert.equal(app.storage.attempts.length, 0);
        assert.deepEqual(await app.export(), JSON.parse(app.initial));
    }
    assert.equal(app.confirmations.length, 0, "Invalid data must be rejected before any replacement confirmation");
});
