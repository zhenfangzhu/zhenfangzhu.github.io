(function () {
    "use strict";

    const editor = document.getElementById("board-editor");
    const status = document.getElementById("board-status");
    const statusText = document.getElementById("status-text");
    const updatedAt = document.getElementById("updated-at");
    const characterCount = document.getElementById("character-count");
    const config = window.BOARD_CONFIG || {};
    const modeTabs = Array.from(document.querySelectorAll(".mode-tab"));
    const publicMode = document.getElementById("public-mode");
    const privateMode = document.getElementById("private-mode");
    const privateGate = document.getElementById("private-gate");
    const privateCreatePanel = document.getElementById("private-create-panel");
    const privateWorkspace = document.getElementById("private-workspace");
    const privateRoomForm = document.getElementById("private-room-form");
    const privateRoomPassword = document.getElementById("private-room-password");
    const roomMessage = document.getElementById("room-message");
    const enterRoomButton = document.getElementById("enter-room-button");
    const showCreateRoomButton = document.getElementById("show-create-room");
    const createRoomForm = document.getElementById("create-room-form");
    const newRoomPassword = document.getElementById("new-room-password");
    const confirmRoomPassword = document.getElementById("confirm-room-password");
    const newRoomExpiry = document.getElementById("new-room-expiry");
    const createRoomMessage = document.getElementById("create-room-message");
    const createRoomButton = document.getElementById("create-room-button");
    const backToJoin = document.getElementById("back-to-join");
    const privateRoomExpiryText = document.getElementById("private-room-expiry-text");
    const privateBoardEditor = document.getElementById("private-board-editor");
    const privateSaveStatus = document.getElementById("private-save-status");
    const privateBoardCharacterCount = document.getElementById("private-board-character-count");
    const lockPrivateRoomButton = document.getElementById("lock-private-room");
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const PBKDF2_ITERATIONS = 1000000;
    const PIN_PATTERN = /^[0-9]{6}$/;
    const PIN_ROOM_CONTEXT = "zhuzhenfang.com/pin-room/v1";

    let client;
    let saveTimer;
    let localRevision = 0;
    let lastSavedContent = "";
    let localDirty = false;
    let privateSaveTimer;
    let privateRevision = 0;
    let privateLastSavedContent = "";
    let privateDirty = false;
    let privateRoomId = "";
    let privateRoomKey = null;
    let privateRoomSalt = null;
    let privateTtlDays = 30;
    let privateRoomExists = false;

    function tr(key, values = {}) {
        let value = window.siteLanguage?.text(key, key) || key;
        Object.entries(values).forEach(([name, replacement]) => {
            value = value.replace(`{${name}}`, replacement);
        });
        return value;
    }

    function locale() {
        return window.siteLanguage?.current() === "en" ? "en-US" : "zh-CN";
    }

    function translationKey(value) {
        const catalogs = Object.values(window.SITE_I18N || {});
        for (const catalog of catalogs) {
            const match = Object.entries(catalog).find(([, text]) => text === value);
            if (match) return match[0];
        }
        return "";
    }

    function setStatus(state, text) {
        status.dataset.state = state;
        statusText.textContent = text;
        statusText.dataset.messageKey = translationKey(text);
    }

    function setFormMessage(text, state) {
        roomMessage.textContent = text;
        roomMessage.dataset.state = state || "";
        roomMessage.dataset.messageKey = translationKey(text);
    }

    function setCreateMessage(text, state) {
        createRoomMessage.textContent = text;
        createRoomMessage.dataset.state = state || "";
        createRoomMessage.dataset.messageKey = translationKey(text);
    }

    function setPrivateSaveStatus(key) {
        privateSaveStatus.dataset.messageKey = key;
        privateSaveStatus.textContent = tr(key);
    }

    function setMode(mode) {
        const isPrivate = mode === "private";
        publicMode.hidden = isPrivate;
        privateMode.hidden = !isPrivate;

        modeTabs.forEach((tab) => {
            const isActive = tab.dataset.mode === mode;
            tab.classList.toggle("is-active", isActive);
            tab.setAttribute("aria-selected", String(isActive));
            tab.tabIndex = isActive ? 0 : -1;
        });
    }

    function formatTime(value) {
        if (!value) return tr("status.unsaved");
        const date = new Intl.DateTimeFormat(locale(), {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }).format(new Date(value));
        return tr("status.updated", { date });
    }

    function formatExpiry(value) {
        if (!value) return tr("status.encryptHint");
        const date = new Intl.DateTimeFormat(locale(), {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date(value));
        return tr("status.expires", { date });
    }

    function updateCount() {
        characterCount.textContent = editor.value.length.toLocaleString(locale());
    }

    function updatePrivateCount() {
        privateBoardCharacterCount.textContent = privateBoardEditor.value.length.toLocaleString(locale());
    }

    function bytesToBase64(bytes) {
        let binary = "";
        const chunkSize = 8192;

        for (let index = 0; index < bytes.length; index += chunkSize) {
            binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }

        return window.btoa(binary);
    }

    function base64ToBytes(value) {
        const binary = window.atob(value);
        return Uint8Array.from(binary, (character) => character.charCodeAt(0));
    }

    function bytesToHex(bytes) {
        return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    function sameBytes(first, second) {
        if (first.length !== second.length) return false;
        let difference = 0;

        for (let index = 0; index < first.length; index += 1) {
            difference |= first[index] ^ second[index];
        }

        return difference === 0;
    }

    function ttlFromRecord(record) {
        const duration = new Date(record.expires_at) - new Date(record.updated_at);
        const days = duration / 86400000;
        return [1, 7, 30].reduce((nearest, option) => (
            Math.abs(option - days) < Math.abs(nearest - days) ? option : nearest
        ), 30);
    }

    async function deriveRoomCredentials(pin) {
        if (!PIN_PATTERN.test(pin)) {
            throw new Error("Invalid room credentials");
        }

        const salt = encoder.encode(PIN_ROOM_CONTEXT);
        const pinKey = await window.crypto.subtle.importKey(
            "raw",
            encoder.encode(pin),
            "PBKDF2",
            false,
            ["deriveBits"]
        );
        const material = new Uint8Array(await window.crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt,
                iterations: PBKDF2_ITERATIONS,
                hash: "SHA-256"
            },
            pinKey,
            512
        ));
        const roomId = bytesToHex(material.slice(0, 32));
        const keyBytes = material.slice(32, 64);
        const key = await window.crypto.subtle.importKey(
            "raw",
            keyBytes,
            { name: "AES-GCM" },
            false,
            ["encrypt", "decrypt"]
        );
        material.fill(0);
        keyBytes.fill(0);

        return {
            roomId,
            key,
            salt
        };
    }

    async function encryptPrivateContent(content) {
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const plaintext = encoder.encode(JSON.stringify({
            version: 1,
            content
        }));
        const ciphertext = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv
            },
            privateRoomKey,
            plaintext
        );

        return {
            ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
            iv: bytesToBase64(iv),
            salt: bytesToBase64(privateRoomSalt)
        };
    }

    async function decryptPrivateContent(record) {
        const storedSalt = base64ToBytes(record.salt);
        if (!sameBytes(storedSalt, privateRoomSalt)) {
            throw new Error("Invalid encrypted payload");
        }

        const plaintext = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv: base64ToBytes(record.iv)
            },
            privateRoomKey,
            base64ToBytes(record.ciphertext)
        );
        const payload = JSON.parse(decoder.decode(plaintext));

        if (payload.version !== 1 || typeof payload.content !== "string") {
            throw new Error("Unsupported encrypted board");
        }

        return payload.content;
    }

    function openPrivateWorkspace(content, expiresAt, exists) {
        privateRoomExists = exists;
        privateLastSavedContent = content;
        privateDirty = false;
        privateBoardEditor.value = content;
        updatePrivateCount();
        privateGate.hidden = true;
        privateCreatePanel.hidden = true;
        privateWorkspace.hidden = false;
        privateRoomExpiryText.dataset.timestamp = expiresAt || "";
        privateRoomExpiryText.textContent = formatExpiry(expiresAt);
        setPrivateSaveStatus(exists ? "status.localDecrypted" : "status.creating");
        privateBoardEditor.focus();
    }

    function showJoinPanel() {
        privateCreatePanel.hidden = true;
        privateWorkspace.hidden = true;
        privateGate.hidden = false;
        privateRoomForm.hidden = false;
        setCreateMessage("");
        privateRoomPassword.focus();
    }

    function showCreatePanel() {
        privateGate.hidden = true;
        privateWorkspace.hidden = true;
        privateCreatePanel.hidden = false;
        createRoomForm.reset();
        newRoomExpiry.value = "30";
        setCreateMessage("");
        newRoomPassword.focus();
    }

    function clearPrivateCredentials() {
        privateRoomId = "";
        privateRoomKey = null;
        if (privateRoomSalt) privateRoomSalt.fill(0);
        privateRoomSalt = null;
        privateRoomExists = false;
    }

    function clearPrivateSession() {
        clearTimeout(privateSaveTimer);
        privateRevision = 0;
        privateLastSavedContent = "";
        privateDirty = false;
        clearPrivateCredentials();
        privateBoardEditor.value = "";
        updatePrivateCount();
        privateWorkspace.hidden = true;
        privateCreatePanel.hidden = true;
        privateRoomForm.reset();
        createRoomForm.reset();
        setFormMessage("");
        setCreateMessage("");
        showJoinPanel();
    }

    async function savePrivateBoard(revision) {
        if (!privateRoomKey || !privateRoomId) return false;

        const content = privateBoardEditor.value;
        if (privateRoomExists && content === privateLastSavedContent) {
            privateDirty = false;
            setPrivateSaveStatus("status.savedEncrypted");
            return true;
        }

        setPrivateSaveStatus("status.encrypting");

        try {
            const encrypted = await encryptPrivateContent(content);
            setPrivateSaveStatus("status.savingEncrypted");

            const { data, error } = await client.rpc("save_private_board", {
                p_room_id: privateRoomId,
                p_ciphertext: encrypted.ciphertext,
                p_iv: encrypted.iv,
                p_salt: encrypted.salt,
                p_ttl_days: privateTtlDays
            });

            if (error) throw error;

            if (revision === privateRevision) {
                privateRoomExists = true;
                privateLastSavedContent = content;
                privateDirty = false;
                setPrivateSaveStatus("status.savedEncrypted");
                privateRoomExpiryText.dataset.timestamp = data || "";
                privateRoomExpiryText.textContent = formatExpiry(data);
            }

            return true;
        } catch (error) {
            setPrivateSaveStatus("status.saveFailed");
            return false;
        }
    }

    function schedulePrivateSave() {
        privateRevision += 1;
        const revision = privateRevision;
        clearTimeout(privateSaveTimer);
        setPrivateSaveStatus("status.waitEncrypt");
        privateSaveTimer = window.setTimeout(() => savePrivateBoard(revision), 700);
    }

    async function lockPrivateRoom(saveFirst) {
        clearTimeout(privateSaveTimer);
        if (saveFirst && privateDirty) {
            await savePrivateBoard(privateRevision);
        }
        clearPrivateSession();
    }

    async function enterPrivateRoom(event) {
        event.preventDefault();

        const pin = privateRoomPassword.value;

        if (!PIN_PATTERN.test(pin)) {
            setFormMessage(tr("status.pinInvalid"), "error");
            privateRoomPassword.focus();
            return;
        }

        if (!client || !window.crypto || !window.crypto.subtle) {
            setFormMessage(tr("status.privateUnsupported"), "error");
            return;
        }

        enterRoomButton.disabled = true;
        setFormMessage(tr("status.verifying"));

        try {
            const credentials = await deriveRoomCredentials(pin);
            privateRoomPassword.value = "";
            privateRoomId = credentials.roomId;
            privateRoomKey = credentials.key;
            privateRoomSalt = credentials.salt;
            const { data, error } = await client
                .rpc("read_private_board", { p_room_id: privateRoomId })
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                clearPrivateCredentials();
                setFormMessage(tr("status.roomMissing"), "error");
                return;
            }

            try {
                const content = await decryptPrivateContent(data);
                privateTtlDays = ttlFromRecord(data);
                setFormMessage("");
                openPrivateWorkspace(content, data.expires_at, true);
            } catch (error) {
                clearPrivateCredentials();
                setFormMessage(tr("status.pinWrong"), "error");
                privateRoomPassword.focus();
            }
        } catch (error) {
            clearPrivateCredentials();
            setFormMessage(tr("status.joinFailed"), "error");
        } finally {
            enterRoomButton.disabled = false;
        }
    }

    async function createNewPrivateRoom(event) {
        event.preventDefault();

        const pin = newRoomPassword.value;
        const confirmation = confirmRoomPassword.value;

        if (!PIN_PATTERN.test(pin)) {
            setCreateMessage(tr("status.pinInvalid"), "error");
            newRoomPassword.focus();
            return;
        }

        if (pin !== confirmation) {
            setCreateMessage(tr("status.pinMismatch"), "error");
            confirmRoomPassword.focus();
            return;
        }

        createRoomButton.disabled = true;
        setCreateMessage(tr("status.creatingRoom"));

        try {
            const credentials = await deriveRoomCredentials(pin);
            newRoomPassword.value = "";
            confirmRoomPassword.value = "";

            const { data: existing, error: lookupError } = await client
                .rpc("read_private_board", { p_room_id: credentials.roomId })
                .maybeSingle();

            if (lookupError) throw lookupError;
            if (existing) {
                credentials.salt.fill(0);
                setCreateMessage(tr("status.pinUsed"), "error");
                newRoomPassword.focus();
                return;
            }

            privateRoomId = credentials.roomId;
            privateRoomKey = credentials.key;
            privateRoomSalt = credentials.salt;
            privateTtlDays = Number(newRoomExpiry.value);
            privateRevision = 1;
            privateDirty = true;
            openPrivateWorkspace("", null, false);

            const saved = await savePrivateBoard(privateRevision);
            if (!saved) {
                clearPrivateSession();
                showCreatePanel();
                setCreateMessage(tr("status.createFailed"), "error");
            }
        } catch (error) {
            clearPrivateCredentials();
            setCreateMessage(tr("status.createFailed"), "error");
        } finally {
            createRoomButton.disabled = false;
        }
    }

    async function saveBoard(revision) {
        const content = editor.value;
        if (content === lastSavedContent) {
            setStatus("saved", tr("status.saved"));
            return;
        }

        setStatus("saving", tr("status.saving"));
        const { data, error } = await client
            .from("public_boards")
            .update({ content })
            .eq("id", config.boardId)
            .select("content, updated_at")
            .single();

        if (error) {
            setStatus("error", tr("status.saveRetry"));
            return;
        }

        if (revision === localRevision) {
            lastSavedContent = data.content;
            localDirty = false;
            updatedAt.dataset.timestamp = data.updated_at || "";
            updatedAt.textContent = formatTime(data.updated_at);
            setStatus("saved", tr("status.saved"));
        }
    }

    function scheduleSave() {
        localRevision += 1;
        const revision = localRevision;
        clearTimeout(saveTimer);
        setStatus("saving", tr("status.waitSave"));
        saveTimer = window.setTimeout(() => saveBoard(revision), 650);
    }

    async function loadBoard() {
        const { data, error } = await client
            .from("public_boards")
            .select("content, updated_at")
            .eq("id", config.boardId)
            .single();

        if (error) throw error;

        editor.value = data.content || "";
        lastSavedContent = editor.value;
        updateCount();
        updatedAt.dataset.timestamp = data.updated_at || "";
        updatedAt.textContent = formatTime(data.updated_at);
        editor.disabled = false;
        setStatus("ready", tr("status.connected"));
    }

    function subscribe() {
        client
            .channel(`public-board-${config.boardId}`)
            .on(
                "postgres_changes",
                {
                    event: "UPDATE",
                    schema: "public",
                    table: "public_boards",
                    filter: `id=eq.${config.boardId}`
                },
                (payload) => {
                    const incoming = payload.new;
                    if (!incoming || incoming.content === editor.value || localDirty) return;

                    editor.value = incoming.content || "";
                    lastSavedContent = editor.value;
                    updateCount();
                    updatedAt.dataset.timestamp = incoming.updated_at || "";
                    updatedAt.textContent = formatTime(incoming.updated_at);
                    setStatus("ready", tr("status.synced"));
                }
            )
            .subscribe((state) => {
                if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
                    setStatus("error", tr("status.realtimeLost"));
                }
            });
    }

    async function start() {
        updateCount();
        updatePrivateCount();
        window.history.replaceState(null, "", "/board/");

        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
            setStatus("error", tr("status.configuring"));
            updatedAt.textContent = tr("status.readonly");
            setFormMessage(tr("status.privateConfiguring"), "error");
            return;
        }

        try {
            client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            await loadBoard();
            subscribe();

        } catch (error) {
            setStatus("error", tr("status.connectionFailed"));
            setFormMessage(tr("status.serviceFailed"), "error");
        }
    }

    editor.addEventListener("input", () => {
        localDirty = true;
        updateCount();
        scheduleSave();
    });

    privateBoardEditor.addEventListener("input", () => {
        privateDirty = true;
        updatePrivateCount();
        schedulePrivateSave();
    });

    modeTabs.forEach((tab) => {
        tab.addEventListener("click", async () => {
            const mode = tab.dataset.mode;

            if (mode === "public" && privateRoomKey) {
                await lockPrivateRoom(true);
            }

            setMode(mode);
            if (mode === "private" && !privateRoomKey) showJoinPanel();
        });
    });

    privateRoomForm.addEventListener("submit", enterPrivateRoom);
    createRoomForm.addEventListener("submit", createNewPrivateRoom);
    showCreateRoomButton.addEventListener("click", showCreatePanel);
    backToJoin.addEventListener("click", showJoinPanel);
    lockPrivateRoomButton.addEventListener("click", () => lockPrivateRoom(true));

    window.addEventListener("site-language-change", () => {
        updateCount();
        updatePrivateCount();
        [statusText, roomMessage, createRoomMessage, privateSaveStatus].forEach((element) => {
            if (element.dataset.messageKey) element.textContent = tr(element.dataset.messageKey);
        });
        if (updatedAt.dataset.timestamp) updatedAt.textContent = formatTime(updatedAt.dataset.timestamp);
        if (privateRoomExpiryText.dataset.timestamp) {
            privateRoomExpiryText.textContent = formatExpiry(privateRoomExpiryText.dataset.timestamp);
        } else if (!privateRoomKey) {
            privateRoomExpiryText.textContent = tr("board.encryptedOnly");
        }
    });

    window.addEventListener("beforeunload", () => {
        clearTimeout(saveTimer);
        clearTimeout(privateSaveTimer);
    });

    start();
}());
