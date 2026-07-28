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
    const privateRoomForm = document.getElementById("private-room-form");
    const privateRoomPassword = document.getElementById("private-room-password");
    const privateRoomExpiry = document.getElementById("private-room-expiry");
    const roomMessage = document.getElementById("room-message");
    const enterRoomButton = document.getElementById("enter-room-button");
    const newRoomPrompt = document.getElementById("new-room-prompt");
    const createPrivateRoom = document.getElementById("create-private-room");
    const privateWorkspace = document.getElementById("private-workspace");
    const privateRoomExpiryText = document.getElementById("private-room-expiry-text");
    const privateBoardEditor = document.getElementById("private-board-editor");
    const privateSaveStatus = document.getElementById("private-save-status");
    const privateBoardCharacterCount = document.getElementById("private-board-character-count");
    const lockPrivateRoomButton = document.getElementById("lock-private-room");
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const PBKDF2_ITERATIONS = 600000;
    const KDF_CONTEXT = encoder.encode("zhuzhenfang.com/private-board/v1");

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

    function setStatus(state, text) {
        status.dataset.state = state;
        statusText.textContent = text;
    }

    function setFormMessage(text, state) {
        roomMessage.textContent = text;
        roomMessage.dataset.state = state || "";
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
        if (!value) return "尚未保存";
        return `更新于 ${new Intl.DateTimeFormat("zh-CN", {
            month: "numeric",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit"
        }).format(new Date(value))}`;
    }

    function formatExpiry(value) {
        if (!value) return "输入内容后会自动加密保存。";
        return `内容将于 ${new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date(value))} 过期。`;
    }

    function updateCount() {
        characterCount.textContent = editor.value.length.toLocaleString("zh-CN");
    }

    function updatePrivateCount() {
        privateBoardCharacterCount.textContent = privateBoardEditor.value.length.toLocaleString("zh-CN");
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

    async function deriveRoomCredentials(password) {
        const passwordKey = await window.crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveBits"]
        );
        const derivedBuffer = await window.crypto.subtle.deriveBits(
            {
                name: "PBKDF2",
                salt: KDF_CONTEXT,
                iterations: PBKDF2_ITERATIONS,
                hash: "SHA-256"
            },
            passwordKey,
            512
        );
        const derived = new Uint8Array(derivedBuffer);
        const roomBytes = derived.slice(0, 32);
        const keyBytes = derived.slice(32, 64);
        const key = await window.crypto.subtle.importKey(
            "raw",
            keyBytes,
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            ["encrypt", "decrypt"]
        );

        keyBytes.fill(0);
        derived.fill(0);

        return {
            roomId: bytesToHex(roomBytes),
            key,
            salt: KDF_CONTEXT.slice()
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
        privateWorkspace.hidden = false;
        privateRoomExpiryText.textContent = formatExpiry(expiresAt);
        privateSaveStatus.textContent = exists ? "已在本地解密" : "输入内容后自动保存";
        privateBoardEditor.focus();
    }

    function clearPrivateSession() {
        clearTimeout(privateSaveTimer);
        privateRevision = 0;
        privateLastSavedContent = "";
        privateDirty = false;
        privateRoomId = "";
        privateRoomKey = null;
        if (privateRoomSalt) privateRoomSalt.fill(0);
        privateRoomSalt = null;
        privateRoomExists = false;
        privateBoardEditor.value = "";
        updatePrivateCount();
        privateWorkspace.hidden = true;
        privateGate.hidden = false;
        privateRoomForm.reset();
        privateRoomExpiry.value = "30";
        newRoomPrompt.hidden = true;
        setFormMessage("");
    }

    async function savePrivateBoard(revision) {
        if (!privateRoomKey || !privateRoomId) return false;

        const content = privateBoardEditor.value;
        if (privateRoomExists && content === privateLastSavedContent) {
            privateDirty = false;
            privateSaveStatus.textContent = "已保存并加密";
            return true;
        }

        privateSaveStatus.textContent = "正在本地加密……";

        try {
            const encrypted = await encryptPrivateContent(content);
            privateSaveStatus.textContent = "正在保存密文……";

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
                privateSaveStatus.textContent = "已保存并加密";
                privateRoomExpiryText.textContent = formatExpiry(data);
            }

            return true;
        } catch (error) {
            privateSaveStatus.textContent = "保存失败，请稍后重试";
            return false;
        }
    }

    function schedulePrivateSave() {
        privateRevision += 1;
        const revision = privateRevision;
        clearTimeout(privateSaveTimer);
        privateSaveStatus.textContent = "等待加密保存";
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

        const password = privateRoomPassword.value;
        if (password.length < 12) {
            setFormMessage("密码至少需要 12 个字符。", "error");
            privateRoomPassword.focus();
            return;
        }

        if (!client || !window.crypto || !window.crypto.subtle) {
            setFormMessage("当前浏览器无法进入私密白板。", "error");
            return;
        }

        enterRoomButton.disabled = true;
        newRoomPrompt.hidden = true;
        setFormMessage("正在安全验证……");

        try {
            const credentials = await deriveRoomCredentials(password);
            privateRoomPassword.value = "";
            privateRoomId = credentials.roomId;
            privateRoomKey = credentials.key;
            privateRoomSalt = credentials.salt;
            privateTtlDays = Number(privateRoomExpiry.value);

            const { data, error } = await client
                .rpc("read_private_board", { p_room_id: privateRoomId })
                .maybeSingle();

            if (error) throw error;

            if (!data) {
                setFormMessage("没有找到对应的私密白板。请检查密码，或用此密码新建。");
                newRoomPrompt.hidden = false;
                return;
            }

            const content = await decryptPrivateContent(data);
            setFormMessage("");
            openPrivateWorkspace(content, data.expires_at, true);
        } catch (error) {
            privateRoomId = "";
            privateRoomKey = null;
            if (privateRoomSalt) privateRoomSalt.fill(0);
            privateRoomSalt = null;
            setFormMessage("无法进入，请检查密码后重试。", "error");
        } finally {
            enterRoomButton.disabled = false;
        }
    }

    async function saveBoard(revision) {
        const content = editor.value;
        if (content === lastSavedContent) {
            setStatus("saved", "已保存");
            return;
        }

        setStatus("saving", "正在保存");
        const { data, error } = await client
            .from("public_boards")
            .update({ content })
            .eq("id", config.boardId)
            .select("content, updated_at")
            .single();

        if (error) {
            setStatus("error", "保存失败，稍后重试");
            return;
        }

        if (revision === localRevision) {
            lastSavedContent = data.content;
            localDirty = false;
            updatedAt.textContent = formatTime(data.updated_at);
            setStatus("saved", "已保存");
        }
    }

    function scheduleSave() {
        localRevision += 1;
        const revision = localRevision;
        clearTimeout(saveTimer);
        setStatus("saving", "等待保存");
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
        updatedAt.textContent = formatTime(data.updated_at);
        editor.disabled = false;
        setStatus("ready", "已连接");
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
                    updatedAt.textContent = formatTime(incoming.updated_at);
                    setStatus("ready", "已同步新内容");
                }
            )
            .subscribe((state) => {
                if (state === "CHANNEL_ERROR" || state === "TIMED_OUT") {
                    setStatus("error", "实时连接中断");
                }
            });
    }

    async function start() {
        updateCount();
        updatePrivateCount();

        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
            setStatus("error", "白板正在配置中");
            updatedAt.textContent = "暂时无法编辑";
            setFormMessage("私密白板正在配置中。", "error");
            return;
        }

        try {
            client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            await loadBoard();
            subscribe();
        } catch (error) {
            setStatus("error", "连接失败，请刷新重试");
            setFormMessage("服务连接失败，请刷新重试。", "error");
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
        });
    });

    document.querySelectorAll(".password-toggle").forEach((button) => {
        button.addEventListener("click", () => {
            const input = document.getElementById(button.dataset.passwordTarget);
            const showing = input.type === "text";
            input.type = showing ? "password" : "text";
            button.textContent = showing ? "显示" : "隐藏";
            button.setAttribute("aria-label", showing ? "显示密码" : "隐藏密码");
            input.focus();
        });
    });

    privateRoomForm.addEventListener("submit", enterPrivateRoom);

    createPrivateRoom.addEventListener("click", () => {
        newRoomPrompt.hidden = true;
        setFormMessage("");
        openPrivateWorkspace("", null, false);
    });

    lockPrivateRoomButton.addEventListener("click", () => lockPrivateRoom(true));

    window.addEventListener("beforeunload", () => {
        clearTimeout(saveTimer);
        clearTimeout(privateSaveTimer);
    });

    start();
}());
