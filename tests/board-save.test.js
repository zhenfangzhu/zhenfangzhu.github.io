const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { join } = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const root = join(__dirname, "..");
const html = readFileSync(join(root, "board/index.html"), "utf8");
const source = readFileSync(join(root, "static/js/board.js"), "utf8");
const translations = readFileSync(join(root, "static/js/board-i18n.js"), "utf8");
const timestamp = "2026-09-12T12:00:00.000Z";

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((done, fail) => { resolve = done; reject = fail; });
    return { promise, resolve, reject };
}

class Element {
    constructor(attributes = "") {
        this.value = "";
        this.textContent = "";
        this.hidden = /\bhidden\b/.test(attributes);
        this.disabled = /\bdisabled\b/.test(attributes);
        this.readOnly = false;
        this.dataset = {};
        this.listeners = new Map();
        this.classList = { toggle() {} };
        for (const [, name, value] of attributes.matchAll(/data-([\w-]+)="([^"]*)"/g)) {
            this.dataset[name.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
        }
    }

    addEventListener(type, listener) {
        if (!this.listeners.has(type)) this.listeners.set(type, []);
        this.listeners.get(type).push(listener);
    }

    emit(type, event = { preventDefault() {} }) {
        return Promise.all((this.listeners.get(type) || []).map(listener => listener(event)));
    }

    setAttribute(name, value) { this[name] = value; }
    focus() { this.focused = true; }
    select() { this.selected = true; }
    reset() {}
}

async function setup() {
    const elements = new Map();
    for (const [, attributes] of html.matchAll(/<[a-z][\w-]*\b([^>]*)>/gi)) {
        const id = attributes.match(/\bid="([^"]+)"/)?.[1];
        if (id) elements.set(id, new Element(attributes));
    }
    const get = id => {
        assert.ok(elements.has(id), `Missing HTML element: ${id}`);
        return elements.get(id);
    };
    const tabs = [get("public-tab"), get("private-tab")];
    const timers = new Map();
    let nextTimer = 0;
    let language = "zh";
    let realtime;
    const windowEvents = new Element();
    const publicWrites = [];
    const privateWrites = [];
    const clipboard = [];
    const record = {
        ciphertext: Buffer.from(JSON.stringify({ version: 1, content: "Private A" })).toString("base64"),
        iv: Buffer.alloc(12).toString("base64"),
        salt: Buffer.from("zhuzhenfang.com/pin-room/v1").toString("base64"),
        updated_at: timestamp,
        expires_at: "2026-10-12T12:00:00.000Z"
    };
    const service = {
        readPrivate: async () => ({ data: record, error: null }),
        savePublic: async content => ({ data: { content, updated_at: timestamp }, error: null }),
        savePrivate: async () => ({ data: record.expires_at, error: null }),
        encryptError: null
    };
    const client = {
        from(table) {
            assert.equal(table, "public_boards");
            let update;
            return {
                update(value) { update = value; return this; },
                select() { return this; },
                eq() { return this; },
                single() {
                    if (!update) return Promise.resolve({ data: { content: "Public A", updated_at: timestamp }, error: null });
                    publicWrites.push(update.content);
                    return service.savePublic(update.content);
                }
            };
        },
        rpc(name, parameters) {
            if (name === "read_private_board") return { maybeSingle: () => service.readPrivate(parameters) };
            assert.equal(name, "save_private_board");
            privateWrites.push(parameters);
            return service.savePrivate(parameters);
        },
        channel() {
            return {
                on(type, filter, listener) { realtime = listener; return this; },
                subscribe() {}
            };
        }
    };
    const window = {
        BOARD_CONFIG: { supabaseUrl: "https://offline.invalid", supabaseAnonKey: "test-only", boardId: "public" },
        supabase: { createClient: () => client },
        history: { replaceState() {} },
        addEventListener: (...args) => windowEvents.addEventListener(...args),
        setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
        navigator: { clipboard: { writeText: async value => { clipboard.push(value); } } },
        btoa: value => Buffer.from(value, "binary").toString("base64"),
        atob: value => Buffer.from(value, "base64").toString("binary"),
        // Crypto is an in-memory transport stub. These tests cover save ordering and UI state, not cryptography.
        crypto: {
            getRandomValues: bytes => bytes.fill(7),
            subtle: {
                importKey: async () => ({}),
                deriveBits: async () => new Uint8Array(64).fill(17).buffer,
                encrypt: async (algorithm, key, bytes) => {
                    if (service.encryptError) throw service.encryptError;
                    return bytes;
                },
                decrypt: async (algorithm, key, bytes) => bytes
            }
        }
    };
    for (const name of ["localStorage", "sessionStorage"]) {
        Object.defineProperty(window, name, { get() { throw new Error(`Unexpected persistent storage: ${name}`); } });
    }
    const context = vm.createContext({
        window,
        document: { getElementById: get, querySelectorAll: selector => selector === ".mode-tab" ? tabs : [] },
        clearTimeout: id => timers.delete(id),
        TextEncoder,
        TextDecoder,
        Uint8Array,
        fetch() { throw new Error("Network access is forbidden in these tests"); }
    });
    vm.runInContext(translations, context);
    window.siteLanguage = { text: key => window.SITE_I18N[language][key], current: () => language };
    vm.runInContext(source, context);
    const flush = () => new Promise(resolve => setImmediate(resolve));
    await flush();

    return {
        get, window, service, record, publicWrites, privateWrites, clipboard, timers, flush,
        async tick() {
            const callbacks = [...timers.values()];
            timers.clear();
            callbacks.forEach(callback => { callback(); });
            await flush();
        },
        input(id, value) {
            const element = get(id);
            assert.equal(element.disabled || element.readOnly, false, "Editor must be editable");
            element.value = value;
            return element.emit("input");
        },
        click(id) { return get(id).disabled ? Promise.resolve() : get(id).emit("click"); },
        leave() {
            const event = { defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
            windowEvents.emit("beforeunload", event);
            return event;
        },
        remote(content) { realtime({ new: { content, updated_at: timestamp } }); },
        async language(value) {
            language = value;
            await windowEvents.emit("site-language-change");
        },
        async openPrivate() {
            await this.click("private-tab");
            get("private-room-password").value = "123456";
            await get("private-room-form").emit("submit");
            assert.equal(get("private-board-editor").value, "Private A");
        },
        savedPrivateText(index) {
            return JSON.parse(Buffer.from(privateWrites[index].p_ciphertext, "base64").toString()).content;
        }
    };
}

test("public edit reverted before saving accepts later realtime updates", async () => {
    const board = await setup();
    board.input("board-editor", "Temporary edit");
    board.input("board-editor", "Public A");
    assert.equal(board.leave().defaultPrevented, false);
    board.remote("Someone else's update");
    assert.equal(board.get("board-editor").value, "Someone else's update");
    await board.tick();
    assert.deepEqual(board.publicWrites, []);
});

test("canceling the leave prompt keeps public and private autosave timers active", async () => {
    const board = await setup();
    await board.openPrivate();
    board.input("board-editor", "Public B");
    board.input("private-board-editor", "Private B");
    const timerCount = board.timers.size;
    assert.equal(board.leave().defaultPrevented, true);
    assert.equal(board.timers.size, timerCount);
    await board.tick();
    assert.deepEqual(board.publicWrites, ["Public B"]);
    assert.equal(board.savedPrivateText(0), "Private B");
    assert.equal(board.leave().defaultPrevented, false);
});

for (const failure of ["error response", "rejected promise"]) {
    test(`public ${failure} retains a copyable draft and can retry without another edit`, async () => {
        const board = await setup();
        board.service.savePublic = async () => {
            if (failure === "rejected promise") throw new Error("Offline");
            return { error: { message: "Offline" } };
        };
        board.input("board-editor", "Public unsaved");
        await board.tick();
        assert.equal(board.get("board-editor").value, "Public unsaved");
        assert.equal(board.get("public-save-recovery").hidden, false);
        assert.equal(board.leave().defaultPrevented, true);
        await board.click("copy-public-draft");
        assert.deepEqual(board.clipboard, ["Public unsaved"]);
        await board.language("en");
        assert.match(board.get("status-text").textContent, /Save failed/);
        assert.equal(board.get("public-copy-status").textContent, "Current text copied.");
        board.service.savePublic = async content => ({ data: { content, updated_at: timestamp } });
        await board.click("retry-public-save");
        assert.deepEqual(board.publicWrites, ["Public unsaved", "Public unsaved"]);
        assert.equal(board.get("public-save-recovery").hidden, true);
        assert.equal(board.leave().defaultPrevented, false);
    });
}

for (const latest of ["Public C", "Public A"]) {
    test(`public writes are serialized and drain the latest text: ${latest}`, async () => {
        const board = await setup();
        const first = deferred();
        board.service.savePublic = content => board.publicWrites.length === 1
            ? first.promise : Promise.resolve({ data: { content, updated_at: timestamp } });
        board.input("board-editor", "Public B");
        await board.tick();
        board.input("board-editor", latest);
        await board.tick();
        assert.deepEqual(board.publicWrites, ["Public B"]);
        assert.equal(board.leave().defaultPrevented, true);
        board.remote("Must not overwrite pending text");
        assert.equal(board.get("board-editor").value, latest);
        first.resolve({ data: { content: "Public B", updated_at: timestamp } });
        await board.flush();
        assert.deepEqual(board.publicWrites, ["Public B", latest]);
        assert.equal(board.leave().defaultPrevented, false);
    });
}

for (const failure of ["error response", "rejected promise", "encryption failure"]) {
    test(`private ${failure} cancels locking, keeps credentials and text, then retries`, async () => {
        const board = await setup();
        await board.openPrivate();
        if (failure === "encryption failure") board.service.encryptError = new Error("Encryption unavailable");
        else board.service.savePrivate = async () => {
            if (failure === "rejected promise") throw new Error("Offline");
            return { error: { message: "Offline" } };
        };
        board.input("private-board-editor", "Private unsaved");
        await board.click("public-tab");
        assert.equal(board.get("public-mode").hidden, true);
        assert.equal(board.get("private-workspace").hidden, false);
        assert.equal(board.get("private-board-editor").value, "Private unsaved");
        assert.equal(board.get("private-board-editor").readOnly, false);
        assert.equal(board.get("lock-private-room").disabled, false);
        assert.equal(board.get("private-save-recovery").hidden, false);
        assert.equal(board.leave().defaultPrevented, true);
        await board.click("copy-private-draft");
        assert.deepEqual(board.clipboard, ["Private unsaved"]);
        await board.language("en");
        assert.match(board.get("private-save-status").textContent, /Save failed/);
        board.service.encryptError = null;
        board.service.savePrivate = async () => ({ data: board.record.expires_at });
        await board.click("retry-private-save");
        assert.equal(board.savedPrivateText(board.privateWrites.length - 1), "Private unsaved");
        assert.equal(board.get("private-save-recovery").hidden, true);
        assert.equal(board.leave().defaultPrevented, false);
        await board.click("lock-private-room");
        assert.equal(board.get("private-workspace").hidden, true);
        assert.equal(board.get("private-board-editor").value, "");
    });
}

test("locking waits for all in-flight private revisions and temporarily prevents further edits", async () => {
    const board = await setup();
    await board.openPrivate();
    const first = deferred();
    const second = deferred();
    board.service.savePrivate = () => board.privateWrites.length === 1 ? first.promise : second.promise;
    board.input("private-board-editor", "Private B");
    await board.tick();
    board.input("private-board-editor", "Private C");
    const locking = board.click("lock-private-room");
    await board.flush();
    assert.equal(board.get("private-board-editor").readOnly, true);
    assert.equal(board.get("public-tab").disabled, true);
    assert.equal(board.get("lock-private-room").disabled, true);
    await board.tick();
    assert.equal(board.privateWrites.length, 1);
    first.resolve({ data: board.record.expires_at });
    await board.flush();
    assert.equal(board.savedPrivateText(1), "Private C");
    assert.equal(board.get("private-workspace").hidden, false);
    assert.equal(board.get("private-board-editor").value, "Private C");
    assert.equal(board.leave().defaultPrevented, true);
    second.resolve({ data: board.record.expires_at });
    await locking;
    assert.equal(board.get("private-workspace").hidden, true);
    assert.equal(board.get("private-board-editor").value, "");
    assert.equal(board.get("private-board-editor").readOnly, false);
    assert.equal(board.get("public-tab").disabled, false);
    assert.equal(board.leave().defaultPrevented, false);
});

test("failed initial creation keeps text entered while the first save was pending", async () => {
    const board = await setup();
    board.service.readPrivate = async () => ({ data: null });
    const first = deferred();
    board.service.savePrivate = () => first.promise;
    await board.click("private-tab");
    await board.click("show-create-room");
    board.get("new-room-password").value = "123456";
    board.get("confirm-room-password").value = "123456";
    const creating = board.get("create-room-form").emit("submit");
    await board.flush();
    assert.equal(board.get("private-workspace").hidden, false);
    assert.equal(board.get("public-tab").disabled, true);
    board.input("private-board-editor", "Typed during creation");
    await board.tick();
    assert.equal(board.privateWrites.length, 1);
    first.resolve({ error: { message: "Offline" } });
    await creating;
    assert.equal(board.get("private-board-editor").value, "Typed during creation");
    assert.equal(board.get("private-workspace").hidden, false);
    assert.equal(board.get("private-save-recovery").hidden, false);
    assert.equal(board.get("public-tab").disabled, false);
    assert.equal(board.leave().defaultPrevented, true);
    board.service.savePrivate = async () => ({ data: board.record.expires_at });
    await board.click("retry-private-save");
    assert.equal(board.savedPrivateText(1), "Typed during creation");
    assert.equal(board.leave().defaultPrevented, false);
});

test("entering a room cannot save blank text or exit while its read is pending", async () => {
    const board = await setup();
    const reading = deferred();
    board.service.readPrivate = () => reading.promise;
    await board.click("private-tab");
    board.get("private-room-password").value = "123456";
    const entering = board.get("private-room-form").emit("submit");
    await board.flush();
    assert.equal(board.get("public-tab").disabled, true);
    // Forced dispatch also exercises guards rather than relying only on the disabled buttons.
    await board.get("public-tab").emit("click");
    await board.get("lock-private-room").emit("click");
    await board.get("retry-private-save").emit("click");
    assert.equal(board.privateWrites.length, 0);
    reading.resolve({ data: board.record });
    await entering;
    assert.equal(board.get("private-board-editor").value, "Private A");
    assert.equal(board.get("private-workspace").hidden, false);
    assert.equal(board.get("public-tab").disabled, false);
    assert.equal(board.privateWrites.length, 0);
});

test("clipboard rejection selects the draft for manual copying", async () => {
    const board = await setup();
    board.service.savePublic = async () => ({ error: { message: "Offline" } });
    board.window.navigator.clipboard.writeText = async () => { throw new Error("Clipboard denied"); };
    board.input("board-editor", "Copy me manually");
    await board.tick();
    await board.click("copy-public-draft");
    assert.equal(board.get("board-editor").selected, true);
    assert.equal(board.get("board-editor").value, "Copy me manually");
    assert.match(board.get("public-copy-status").textContent, /⌘C \/ Ctrl\+C/);
    assert.equal(board.leave().defaultPrevented, true);
});
