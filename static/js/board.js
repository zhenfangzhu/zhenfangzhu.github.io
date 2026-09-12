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
    const publicSaveRecovery = document.getElementById("public-save-recovery");
    const privateSaveRecovery = document.getElementById("private-save-recovery");
    const retryPublicSaveButton = document.getElementById("retry-public-save");
    const retryPrivateSaveButton = document.getElementById("retry-private-save");
    const publicCopyStatus = document.getElementById("public-copy-status");
    const privateCopyStatus = document.getElementById("private-copy-status");
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const PBKDF2_ITERATIONS = 1000000;
    const PIN_PATTERN = /^[0-9]{6}$/;
    const PIN_ROOM_CONTEXT = "zhuzhenfang.com/pin-room/v1";

    let client;
    let saveTimer;
    let lastSavedContent = "";
    let localDirty = false;
    let publicSavePromise = null;
    let publicSaveFailed = false;
    let privateSaveTimer;
    let privateLastSavedContent = "";
    let privateDirty = false;
    let privateSavePromise = null;
    let privateSaveFailed = false;
    let privateLockPending = false;
    let privateOpening = false;
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

    function updateSaveActions() {
        publicSaveRecovery.hidden = !publicSaveFailed;
        privateSaveRecovery.hidden = !privateSaveFailed;
        retryPublicSaveButton.disabled = Boolean(publicSavePromise);
        retryPrivateSaveButton.disabled = Boolean(privateSavePromise) || privateLockPending || privateOpening;
        lockPrivateRoomButton.disabled = privateLockPending || privateOpening;
        modeTabs.forEach(tab => { tab.disabled = privateLockPending || privateOpening; });
        privateBoardEditor.readOnly = privateLockPending;
    }

    async function copyDraft(source, feedback) {
        let key = "status.copied";
        try {
            await window.navigator.clipboard.writeText(source.value);
        } catch (error) {
            source.focus();
            source.select();
            key = "status.copyManually";
        }
        feedback.dataset.messageKey = key;
        feedback.textContent = tr(key);
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

    async function encryptPrivateContent(content, room) {
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
            room.key,
            plaintext
        );

        return {
            ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
            iv: bytesToBase64(iv),
            salt: bytesToBase64(room.salt)
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
        privateDirty = !exists;
        privateSaveFailed = false;
        privateBoardEditor.value = content;
        updateSaveActions();
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
        privateLastSavedContent = "";
        privateDirty = false;
        privateSaveFailed = false;
        clearPrivateCredentials();
        privateBoardEditor.value = "";
        privateCopyStatus.textContent = "";
        privateCopyStatus.dataset.messageKey = "";
        updateSaveActions();
        updatePrivateCount();
        privateWorkspace.hidden = true;
        privateCreatePanel.hidden = true;
        privateRoomForm.reset();
        createRoomForm.reset();
        setFormMessage("");
        setCreateMessage("");
        showJoinPanel();
    }

    function savePrivateBoard() {
        clearTimeout(privateSaveTimer);
        if (privateSavePromise) return privateSavePromise;
        if (!privateRoomKey || !privateRoomId || privateWorkspace.hidden) return Promise.resolve(false);

        if (privateRoomExists && !privateSaveFailed && privateBoardEditor.value === privateLastSavedContent) {
            privateDirty = false;
            setPrivateSaveStatus("status.savedEncrypted");
            return Promise.resolve(true);
        }

        const room = { id: privateRoomId, key: privateRoomKey, salt: privateRoomSalt.slice(), ttl: privateTtlDays };
        const isCurrentRoom = () => room.id === privateRoomId && room.key === privateRoomKey;
        privateDirty = true;
        const saving = (async () => {
            // Finish each write before taking the next snapshot, including an edit back to the original text.
            while (isCurrentRoom()) {
                const content = privateBoardEditor.value;
                setPrivateSaveStatus("status.encrypting");
                const encrypted = await encryptPrivateContent(content, room);
                if (!isCurrentRoom()) return false;
                setPrivateSaveStatus("status.savingEncrypted");

                const { data, error } = await client.rpc("save_private_board", {
                    p_room_id: room.id,
                    p_ciphertext: encrypted.ciphertext,
                    p_iv: encrypted.iv,
                    p_salt: encrypted.salt,
                    p_ttl_days: room.ttl
                });

                if (error) throw error;
                if (!isCurrentRoom()) return false;
                privateRoomExists = true;
                privateLastSavedContent = content;
                privateSaveFailed = false;
                privateDirty = privateBoardEditor.value !== content;
                privateRoomExpiryText.dataset.timestamp = data || "";
                privateRoomExpiryText.textContent = formatExpiry(data);
                if (!privateDirty) {
                    setPrivateSaveStatus("status.savedEncrypted");
                    return true;
                }
            }
            return false;
        })().catch(() => {
            if (isCurrentRoom()) {
                privateDirty = true;
                privateSaveFailed = true;
                setPrivateSaveStatus("status.saveFailed");
            }
            return false;
        });
        privateSavePromise = saving.finally(() => {
            room.salt.fill(0);
            privateSavePromise = null;
            updateSaveActions();
        });
        updateSaveActions();
        return privateSavePromise;
    }

    function schedulePrivateSave() {
        clearTimeout(privateSaveTimer);
        privateDirty = !privateRoomExists || privateSaveFailed || privateBoardEditor.value !== privateLastSavedContent;
        if (!privateDirty && !privateSavePromise) {
            setPrivateSaveStatus("status.savedEncrypted");
            return;
        }
        setPrivateSaveStatus("status.waitEncrypt");
        privateSaveTimer = window.setTimeout(savePrivateBoard, 700);
    }

    async function lockPrivateRoom() {
        if (privateLockPending || privateOpening) return false;
        privateLockPending = true;
        clearTimeout(privateSaveTimer);
        updateSaveActions();
        try {
            const saved = await savePrivateBoard();
            if (!saved || privateDirty || privateBoardEditor.value !== privateLastSavedContent) {
                privateBoardEditor.focus();
                return false;
            }
            clearPrivateSession();
            return true;
        } finally {
            privateLockPending = false;
            updateSaveActions();
        }
    }

    async function enterPrivateRoom(event) {
        event.preventDefault();
        if (privateOpening || privateLockPending || privateRoomKey) return;

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
        privateOpening = true;
        updateSaveActions();
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
            privateOpening = false;
            updateSaveActions();
        }
    }

    async function createNewPrivateRoom(event) {
        event.preventDefault();
        if (privateOpening || privateLockPending || privateRoomKey) return;

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
        privateOpening = true;
        updateSaveActions();
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
            openPrivateWorkspace("", null, false);

            // A failed first save must also keep anything typed while the room was being created.
            await savePrivateBoard();
        } catch (error) {
            clearPrivateCredentials();
            setCreateMessage(tr("status.createFailed"), "error");
        } finally {
            createRoomButton.disabled = false;
            privateOpening = false;
            updateSaveActions();
        }
    }

    function saveBoard() {
        clearTimeout(saveTimer);
        if (publicSavePromise) return publicSavePromise;
        if (!publicSaveFailed && editor.value === lastSavedContent) {
            localDirty = false;
            setStatus("saved", tr("status.saved"));
            return Promise.resolve(true);
        }

        localDirty = true;
        const saving = (async () => {
            do {
                const content = editor.value;
                setStatus("saving", tr("status.saving"));
                const { data, error } = await client
                    .from("public_boards")
                    .update({ content })
                    .eq("id", config.boardId)
                    .select("content, updated_at")
                    .single();

                if (error) throw error;
                lastSavedContent = data.content;
                publicSaveFailed = false;
                localDirty = editor.value !== lastSavedContent;
                updatedAt.dataset.timestamp = data.updated_at || "";
                updatedAt.textContent = formatTime(data.updated_at);
            } while (localDirty);
            setStatus("saved", tr("status.saved"));
            return true;
        })().catch(() => {
            // A failed response does not prove the server rejected the write; retry the current text.
            localDirty = true;
            publicSaveFailed = true;
            setStatus("error", tr("status.saveRetry"));
            return false;
        });
        publicSavePromise = saving.finally(() => {
            publicSavePromise = null;
            updateSaveActions();
        });
        updateSaveActions();
        return publicSavePromise;
    }

    function scheduleSave() {
        clearTimeout(saveTimer);
        localDirty = publicSaveFailed || editor.value !== lastSavedContent;
        if (!localDirty && !publicSavePromise) {
            setStatus("saved", tr("status.saved"));
            return;
        }
        setStatus("saving", tr("status.waitSave"));
        saveTimer = window.setTimeout(saveBoard, 650);
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
                    if (!incoming || incoming.content === editor.value || localDirty || publicSavePromise) return;

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
        updateCount();
        scheduleSave();
    });

    privateBoardEditor.addEventListener("input", () => {
        updatePrivateCount();
        schedulePrivateSave();
    });

    modeTabs.forEach((tab) => {
        tab.addEventListener("click", async () => {
            if (privateOpening || privateLockPending) return;
            const mode = tab.dataset.mode;

            if (mode === "public" && privateRoomKey) {
                if (!await lockPrivateRoom()) return;
            }

            setMode(mode);
            if (mode === "private" && !privateRoomKey) showJoinPanel();
        });
    });

    privateRoomForm.addEventListener("submit", enterPrivateRoom);
    createRoomForm.addEventListener("submit", createNewPrivateRoom);
    showCreateRoomButton.addEventListener("click", showCreatePanel);
    backToJoin.addEventListener("click", showJoinPanel);
    lockPrivateRoomButton.addEventListener("click", lockPrivateRoom);
    retryPublicSaveButton.addEventListener("click", saveBoard);
    retryPrivateSaveButton.addEventListener("click", savePrivateBoard);
    document.getElementById("copy-public-draft").addEventListener("click", () => copyDraft(editor, publicCopyStatus));
    document.getElementById("copy-private-draft").addEventListener("click", () => copyDraft(privateBoardEditor, privateCopyStatus));

    window.addEventListener("site-language-change", () => {
        updateCount();
        updatePrivateCount();
        [statusText, roomMessage, createRoomMessage, privateSaveStatus, publicCopyStatus, privateCopyStatus].forEach((element) => {
            if (element.dataset.messageKey) element.textContent = tr(element.dataset.messageKey);
        });
        if (updatedAt.dataset.timestamp) updatedAt.textContent = formatTime(updatedAt.dataset.timestamp);
        if (privateRoomExpiryText.dataset.timestamp) {
            privateRoomExpiryText.textContent = formatExpiry(privateRoomExpiryText.dataset.timestamp);
        } else if (!privateRoomKey) {
            privateRoomExpiryText.textContent = tr("board.encryptedOnly");
        }
    });

    window.addEventListener("beforeunload", (event) => {
        if (!localDirty && !publicSavePromise && !privateDirty && !privateSavePromise) return;
        event.preventDefault();
        event.returnValue = "";
    });

    window.addEventListener("online", () => {
        if (localDirty) saveBoard();
        if (privateDirty && privateRoomKey) savePrivateBoard();
    });

    start();
}());
