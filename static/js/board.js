(function () {
    "use strict";

    const editor = document.getElementById("board-editor");
    const status = document.getElementById("board-status");
    const statusText = document.getElementById("status-text");
    const updatedAt = document.getElementById("updated-at");
    const characterCount = document.getElementById("character-count");
    const config = window.BOARD_CONFIG || {};

    let client;
    let saveTimer;
    let localRevision = 0;
    let lastSavedContent = "";
    let localDirty = false;

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

        if (!config.supabaseUrl || !config.supabaseAnonKey || !window.supabase) {
            setStatus("error", "白板正在配置中");
            updatedAt.textContent = "暂时无法编辑";
            return;
        }

        try {
            client = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
            await loadBoard();
            subscribe();
        } catch (error) {
            console.error("Board initialization failed", error);
            setStatus("error", "连接失败，请刷新重试");
        }
    }

    editor.addEventListener("input", () => {
        localDirty = true;
        updateCount();
        scheduleSave();
    });

    window.addEventListener("beforeunload", () => {
        clearTimeout(saveTimer);
    });

    start();
}());
