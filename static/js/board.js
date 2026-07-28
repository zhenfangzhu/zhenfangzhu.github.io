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
    const privateCreate = document.getElementById("private-create");
    const privateRead = document.getElementById("private-read");
    const privateNoteForm = document.getElementById("private-note-form");
    const privateContent = document.getElementById("private-content");
    const privateCharacterCount = document.getElementById("private-character-count");
    const privatePassword = document.getElementById("private-password");
    const privateExpiry = document.getElementById("private-expiry");
    const createMessage = document.getElementById("create-message");
    const createNoteButton = document.getElementById("create-note-button");
    const shareResult = document.getElementById("share-result");
    const shareLink = document.getElementById("share-link");
    const copyShareLink = document.getElementById("copy-share-link");
    const createAnotherNote = document.getElementById("create-another-note");
    const unlockNoteForm = document.getElementById("unlock-note-form");
    const unlockPassword = document.getElementById("unlock-password");
    const unlockMessage = document.getElementById("unlock-message");
    const unlockNoteButton = document.getElementById("unlock-note-button");
    const privateNoteExpiry = document.getElementById("private-note-expiry");
    const decryptedNote = document.getElementById("decrypted-note");
    const decryptedContent = document.getElementById("decrypted-content");
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const PBKDF2_ITERATIONS = 250000;
    const NOTE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    let client;
    let saveTimer;
    let localRevision = 0;
    let lastSavedContent = "";
    let localDirty = false;
    let encryptedRecord = null;

    function setStatus(state, text) {
        status.dataset.state = state;
        statusText.textContent = text;
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

    function updateCount() {
        characterCount.textContent = editor.value.length.toLocaleString("zh-CN");
    }

    function setFormMessage(element, text, state) {
        element.textContent = text;
        element.dataset.state = state || "";
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

    async function deriveEncryptionKey(password, salt, usages) {
        const sourceKey = await window.crypto.subtle.importKey(
            "raw",
            encoder.encode(password),
            "PBKDF2",
            false,
            ["deriveKey"]
        );

        return window.crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt,
                iterations: PBKDF2_ITERATIONS,
                hash: "SHA-256"
            },
            sourceKey,
            {
                name: "AES-GCM",
                length: 256
            },
            false,
            usages
        );
    }

    async function encryptContent(content, password) {
        const salt = window.crypto.getRandomValues(new Uint8Array(16));
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveEncryptionKey(password, salt, ["encrypt"]);
        const plaintext = encoder.encode(JSON.stringify({
            version: 1,
            content
        }));
        const ciphertext = await window.crypto.subtle.encrypt(
            {
                name: "AES-GCM",
                iv
            },
            key,
            plaintext
        );

        return {
            ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
            iv: bytesToBase64(iv),
            salt: bytesToBase64(salt)
        };
    }

    async function decryptContent(record, password) {
        const salt = base64ToBytes(record.salt);
        const iv = base64ToBytes(record.iv);
        const ciphertext = base64ToBytes(record.ciphertext);
        const key = await deriveEncryptionKey(password, salt, ["decrypt"]);
        const plaintext = await window.crypto.subtle.decrypt(
            {
                name: "AES-GCM",
                iv
            },
            key,
            ciphertext
        );
        const payload = JSON.parse(decoder.decode(plaintext));

        if (payload.version !== 1 || typeof payload.content !== "string") {
            throw new Error("Unsupported encrypted note");
        }

        return payload.content;
    }

    function noteIdFromHash() {
        const parameters = new URLSearchParams(window.location.hash.slice(1));
        const noteId = parameters.get("note") || "";
        return NOTE_ID_PATTERN.test(noteId) ? noteId : "";
    }

    function buildShareUrl(noteId) {
        const url = new URL("/board/", window.location.origin);
        url.hash = new URLSearchParams({ note: noteId }).toString();
        return url.toString();
    }

    function formatExpiry(value) {
        return `有效期至 ${new Intl.DateTimeFormat("zh-CN", {
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit"
        }).format(new Date(value))}`;
    }

    async function loadEncryptedNote(noteId) {
        setMode("private");
        privateCreate.hidden = true;
        privateRead.hidden = false;
        unlockNoteForm.hidden = false;
        decryptedNote.hidden = true;
        unlockNoteButton.disabled = true;
        setFormMessage(unlockMessage, "正在读取加密便签……");

        if (!client) {
            setFormMessage(unlockMessage, "服务暂时无法连接，请刷新重试。", "error");
            return;
        }

        const { data, error } = await client
            .rpc("read_private_note", { p_note_id: noteId })
            .maybeSingle();

        if (error) {
            console.error("Encrypted note lookup failed", error);
            setFormMessage(unlockMessage, "读取失败，请稍后再试。", "error");
            return;
        }

        if (!data) {
            privateNoteExpiry.textContent = "这张便签已过期，或者分享链接无效。";
            setFormMessage(unlockMessage, "无法找到可用的加密便签。", "error");
            return;
        }

        encryptedRecord = data;
        privateNoteExpiry.textContent = `${formatExpiry(data.expires_at)}。请输入发送者提供的密码。`;
        unlockNoteButton.disabled = false;
        setFormMessage(unlockMessage, "");
        unlockPassword.focus();
    }

    async function createEncryptedNote(event) {
        event.preventDefault();

        const content = privateContent.value.trim();
        const password = privatePassword.value;
        const ttlDays = Number(privateExpiry.value);

        if (!content) {
            setFormMessage(createMessage, "请先输入便签内容。", "error");
            privateContent.focus();
            return;
        }

        if (password.length < 8) {
            setFormMessage(createMessage, "密码至少需要 8 个字符。", "error");
            privatePassword.focus();
            return;
        }

        if (!client || !window.crypto || !window.crypto.subtle) {
            setFormMessage(createMessage, "当前浏览器无法创建加密便签。", "error");
            return;
        }

        createNoteButton.disabled = true;
        setFormMessage(createMessage, "正在本地加密……");

        try {
            const encrypted = await encryptContent(content, password);
            setFormMessage(createMessage, "正在保存密文……");

            const { data, error } = await client.rpc("create_private_note", {
                p_ciphertext: encrypted.ciphertext,
                p_iv: encrypted.iv,
                p_salt: encrypted.salt,
                p_ttl_days: ttlDays
            });

            if (error) throw error;

            shareLink.value = buildShareUrl(data);
            privateNoteForm.hidden = true;
            shareResult.hidden = false;
            privatePassword.value = "";
            privateContent.value = "";
            privateCharacterCount.textContent = "0";
            setFormMessage(createMessage, "");
            shareLink.focus();
        } catch (error) {
            console.error("Encrypted note creation failed", error);
            setFormMessage(createMessage, "创建失败，请稍后重试。", "error");
        } finally {
            createNoteButton.disabled = false;
        }
    }

    async function unlockEncryptedNote(event) {
        event.preventDefault();

        if (!encryptedRecord) {
            setFormMessage(unlockMessage, "这张便签当前无法读取。", "error");
            return;
        }

        const password = unlockPassword.value;
        if (password.length < 8) {
            setFormMessage(unlockMessage, "请输入发送者提供的完整密码。", "error");
            return;
        }

        unlockNoteButton.disabled = true;
        setFormMessage(unlockMessage, "正在本地解密……");

        try {
            const content = await decryptContent(encryptedRecord, password);
            decryptedContent.textContent = content;
            unlockNoteForm.hidden = true;
            decryptedNote.hidden = false;
            unlockPassword.value = "";
            setFormMessage(unlockMessage, "");
        } catch (error) {
            console.warn("Encrypted note could not be decrypted");
            setFormMessage(unlockMessage, "密码不正确，请重新输入。", "error");
            unlockPassword.select();
        } finally {
            unlockNoteButton.disabled = false;
        }
    }

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(shareLink.value);
            copyShareLink.textContent = "已复制";
        } catch (error) {
            shareLink.select();
            document.execCommand("copy");
            copyShareLink.textContent = "已复制";
        }

        window.setTimeout(() => {
            copyShareLink.textContent = "复制链接";
        }, 1800);
    }

    function resetPrivateCreator() {
        privateNoteForm.reset();
        privateNoteForm.hidden = false;
        shareResult.hidden = true;
        privateCharacterCount.textContent = "0";
        setFormMessage(createMessage, "");
        privateContent.focus();
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
        privateCharacterCount.textContent = privateContent.value.length.toLocaleString("zh-CN");

        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
            setStatus("error", "白板正在配置中");
            updatedAt.textContent = "暂时无法编辑";
            setFormMessage(createMessage, "加密便签正在配置中。", "error");
            return;
        }

        try {
            client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            await loadBoard();
            subscribe();

            const noteId = noteIdFromHash();
            if (noteId) {
                await loadEncryptedNote(noteId);
            }
        } catch (error) {
            console.error("Board initialization failed", error);
            setStatus("error", "连接失败，请刷新重试");
            setFormMessage(createMessage, "服务连接失败，请刷新重试。", "error");
        }
    }

    editor.addEventListener("input", () => {
        localDirty = true;
        updateCount();
        scheduleSave();
    });

    modeTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
            const mode = tab.dataset.mode;
            setMode(mode);

            if (mode === "private" && !noteIdFromHash()) {
                privateCreate.hidden = false;
                privateRead.hidden = true;
            }
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

    privateContent.addEventListener("input", () => {
        privateCharacterCount.textContent = privateContent.value.length.toLocaleString("zh-CN");
    });

    privateNoteForm.addEventListener("submit", createEncryptedNote);
    unlockNoteForm.addEventListener("submit", unlockEncryptedNote);
    copyShareLink.addEventListener("click", copyLink);
    createAnotherNote.addEventListener("click", resetPrivateCreator);

    window.addEventListener("hashchange", () => {
        const noteId = noteIdFromHash();
        if (noteId) loadEncryptedNote(noteId);
    });

    window.addEventListener("beforeunload", () => {
        clearTimeout(saveTimer);
    });

    start();
}());
