(function () {
  "use strict";

  const PROJECT_STORAGE_KEY = "padcode.project.v1";
  const AUTORUN_STORAGE_KEY = "padcode.autorun.v1";
  const AI_CONFIG_STORAGE_KEY = "padcode.ai.config.v1";
  const AI_KEY_STORAGE_KEY = "padcode.ai.key.v1";
  const MAX_CONSOLE_ENTRIES = 80;
  const MAX_AI_HISTORY = 12;

  const FILE_CONFIG = {
    html: { name: "index.html", mode: "htmlmixed" },
    css: { name: "style.css", mode: "css" },
    js: { name: "script.js", mode: "javascript" },
  };

  const AI_PROVIDERS = {
    deepseek: {
      label: "DeepSeek",
      endpoint: "https://api.deepseek.com/chat/completions",
      model: "deepseek-chat",
    },
    qwen: {
      label: "通义千问",
      endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
      model: "qwen-plus",
    },
    custom: {
      label: "其他兼容接口",
      endpoint: "",
      model: "",
    },
  };

  const AI_SYSTEM_PROMPT = `你是 PadCode 内置的网页开发助手，服务对象是一台 iPad。
你可以查看用户当前项目中的 index.html、style.css、script.js 和预览控制台信息。
回答要使用简体中文，直接解决问题，不要虚构已经执行过的操作。

修改文件时，必须在回答末尾为每个需要更新的文件输出完整内容，格式严格如下：
<file name="index.html">
完整文件内容
</file>
<file name="style.css">
完整文件内容
</file>
只输出真正需要修改的文件。代码中不得包含 Markdown 代码围栏。不要输出部分片段，因为 PadCode 会用这些内容替换整个文件。
如果用户只是咨询或不需要改代码，则不要输出 file 标签。`;

  const TEMPLATES = {
    starter: buildStarterTemplate(),
    profile: buildProfileTemplate(),
    blank: buildBlankTemplate(),
  };

  const elements = {
    workspace: document.querySelector("#workspace"),
    editorHost: document.querySelector("#editorHost"),
    fallbackEditor: document.querySelector("#fallbackEditor"),
    activeFilename: document.querySelector("#activeFilename"),
    cursorPosition: document.querySelector("#cursorPosition"),
    saveState: document.querySelector("#saveState"),
    saveDot: document.querySelector("#saveDot"),
    autoRunToggle: document.querySelector("#autoRunToggle"),
    runButton: document.querySelector("#runButton"),
    runShortcut: document.querySelector("#runShortcut"),
    saveShortcut: document.querySelector("#saveShortcut"),
    importButton: document.querySelector("#importButton"),
    exportButton: document.querySelector("#exportButton"),
    fileInput: document.querySelector("#fileInput"),
    reloadButton: document.querySelector("#reloadButton"),
    openButton: document.querySelector("#openButton"),
    previewFrame: document.querySelector("#previewFrame"),
    previewTimestamp: document.querySelector("#previewTimestamp"),
    templateButton: document.querySelector("#templateButton"),
    templateDialog: document.querySelector("#templateDialog"),
    consolePanel: document.querySelector("#consolePanel"),
    consoleToggle: document.querySelector("#consoleToggle"),
    consoleOutput: document.querySelector("#consoleOutput"),
    consoleCount: document.querySelector("#consoleCount"),
    clearConsoleButton: document.querySelector("#clearConsoleButton"),
    assistantButton: document.querySelector("#assistantButton"),
    assistantPanel: document.querySelector("#assistantPanel"),
    assistantScrim: document.querySelector("#assistantScrim"),
    assistantCloseButton: document.querySelector("#assistantCloseButton"),
    assistantTitle: document.querySelector("#assistantTitle"),
    aiSettingsButton: document.querySelector("#aiSettingsButton"),
    aiMessages: document.querySelector("#aiMessages"),
    aiContextLabel: document.querySelector("#aiContextLabel"),
    aiStarters: document.querySelector("#aiStarters"),
    aiForm: document.querySelector("#aiForm"),
    aiPrompt: document.querySelector("#aiPrompt"),
    aiSendButton: document.querySelector("#aiSendButton"),
    aiSettingsDialog: document.querySelector("#aiSettingsDialog"),
    aiSettingsForm: document.querySelector("#aiSettingsForm"),
    aiSettingsCloseButton: document.querySelector("#aiSettingsCloseButton"),
    aiSettingsCancelButton: document.querySelector("#aiSettingsCancelButton"),
    aiProvider: document.querySelector("#aiProvider"),
    aiEndpoint: document.querySelector("#aiEndpoint"),
    aiModel: document.querySelector("#aiModel"),
    aiApiKey: document.querySelector("#aiApiKey"),
    aiRememberKey: document.querySelector("#aiRememberKey"),
    toast: document.querySelector("#toast"),
  };

  const savedProject = loadProject();
  const state = {
    files: savedProject.files,
    activeFile: savedProject.activeFile,
    cursors: {},
    autoRun: readAutoRunPreference(),
  };

  let editor = null;
  let saveTimer = 0;
  let previewTimer = 0;
  let toastTimer = 0;
  const consoleLogs = [];
  let aiConfig = loadAIConfig();
  let aiHistory = [];
  let aiBusy = false;
  let aiHasOpened = false;

  initialize();

  function initialize() {
    elements.autoRunToggle.checked = state.autoRun;
    updateShortcutLabels();
    updateAIStatus();
    bindControls();
    initializeEditor();
    switchFile(state.activeFile, { focus: false, preservePreview: true });
    setView(new URLSearchParams(window.location.search).get("view") === "preview" ? "preview" : "code");
    saveNow();
    runPreview({ clearConsole: true });
    registerServiceWorker();
  }

  function bindControls() {
    document.querySelectorAll(".file-tab").forEach(function (button) {
      button.addEventListener("click", function () {
        switchFile(button.dataset.file);
      });
    });

    document.querySelectorAll(".view-switch button").forEach(function (button) {
      button.addEventListener("click", function () {
        setView(button.dataset.view);
      });
    });

    elements.autoRunToggle.addEventListener("change", function () {
      state.autoRun = elements.autoRunToggle.checked;
      try {
        localStorage.setItem(AUTORUN_STORAGE_KEY, state.autoRun ? "1" : "0");
      } catch (_error) {
        // The setting still applies for this session.
      }

      if (state.autoRun) {
        runPreview({ clearConsole: true });
      } else {
        elements.previewTimestamp.textContent = "更改后需手动运行";
      }
    });

    elements.runButton.addEventListener("click", function () {
      runPreview({ clearConsole: true });
      if (window.matchMedia("(max-width: 900px)").matches) {
        setView("preview");
      }
    });

    elements.reloadButton.addEventListener("click", function () {
      runPreview({ clearConsole: true });
    });

    elements.openButton.addEventListener("click", openPreviewInNewWindow);
    elements.exportButton.addEventListener("click", exportProject);
    elements.importButton.addEventListener("click", function () {
      elements.fileInput.click();
    });
    elements.fileInput.addEventListener("change", importFile);
    elements.templateButton.addEventListener("click", openTemplateDialog);
    elements.clearConsoleButton.addEventListener("click", clearConsole);
    elements.consoleToggle.addEventListener("click", toggleConsole);
    elements.assistantButton.addEventListener("click", openAssistant);
    elements.assistantCloseButton.addEventListener("click", closeAssistant);
    elements.assistantScrim.addEventListener("click", closeAssistant);
    elements.aiSettingsButton.addEventListener("click", openAISettings);
    elements.aiSettingsCloseButton.addEventListener("click", closeAISettings);
    elements.aiSettingsCancelButton.addEventListener("click", closeAISettings);
    elements.aiProvider.addEventListener("change", applyAIProviderPreset);
    elements.aiSettingsForm.addEventListener("submit", saveAISettings);
    elements.aiForm.addEventListener("submit", submitAIPrompt);
    elements.aiPrompt.addEventListener("input", resizeAIPrompt);
    elements.aiPrompt.addEventListener("keydown", handleAIPromptKeydown);

    elements.aiStarters.addEventListener("click", function (event) {
      const button = event.target.closest("[data-ai-prompt]");
      if (button) {
        elements.aiPrompt.value = button.dataset.aiPrompt;
        requestAIResponse();
      }
    });

    elements.templateDialog.addEventListener("click", function (event) {
      if (event.target === elements.templateDialog) {
        elements.templateDialog.close();
      }
    });

    elements.aiSettingsDialog.addEventListener("click", function (event) {
      if (event.target === elements.aiSettingsDialog) {
        closeAISettings();
      }
    });

    document.querySelectorAll("[data-template]").forEach(function (button) {
      button.addEventListener("click", function () {
        applyTemplate(button.dataset.template);
      });
    });

    window.addEventListener("message", receivePreviewMessage);
    document.addEventListener("keydown", handleGlobalKeydown);
  }

  function initializeEditor() {
    if (!window.CodeMirror) {
      elements.editorHost.classList.add("is-hidden");
      elements.fallbackEditor.classList.add("is-visible");
      elements.fallbackEditor.value = state.files[state.activeFile];
      elements.fallbackEditor.addEventListener("input", handleFallbackInput);
      elements.fallbackEditor.addEventListener("keydown", handleFallbackKeydown);
      showToast("高级编辑器加载失败，已切换到基础编辑模式。");
      return;
    }

    editor = window.CodeMirror.fromTextArea(elements.fallbackEditor, {
      mode: FILE_CONFIG[state.activeFile].mode,
      theme: "padcode",
      lineNumbers: true,
      lineWrapping: true,
      indentUnit: 2,
      tabSize: 2,
      indentWithTabs: false,
      autoCloseBrackets: true,
      matchBrackets: true,
      styleActiveLine: true,
      inputStyle: "contenteditable",
      spellcheck: false,
      autocorrect: false,
      autocapitalize: "off",
      viewportMargin: 24,
      extraKeys: {
        Tab: function (cm) {
          if (cm.somethingSelected()) {
            cm.indentSelection("add");
            return;
          }
          cm.replaceSelection("  ");
        },
        "Cmd-Enter": function () {
          runPreview({ clearConsole: true });
        },
        "Ctrl-Enter": function () {
          runPreview({ clearConsole: true });
        },
        "Cmd-S": function () {
          saveNow();
        },
        "Ctrl-S": function () {
          saveNow();
        },
      },
    });

    editor.setValue(state.files[state.activeFile]);
    editor.on("change", handleEditorChange);
    editor.on("cursorActivity", updateCursorPosition);
    updateCursorPosition();
  }

  function switchFile(key, options) {
    if (!FILE_CONFIG[key]) {
      return;
    }

    const settings = Object.assign({ focus: true, preservePreview: false }, options);

    if (editor) {
      state.cursors[state.activeFile] = editor.getCursor();
    }

    state.activeFile = key;
    const nextCode = state.files[key];

    if (editor) {
      editor.setOption("mode", FILE_CONFIG[key].mode);
      editor.setValue(nextCode);
      const cursor = state.cursors[key];
      if (cursor) {
        editor.setCursor(cursor);
      } else {
        editor.setCursor({ line: 0, ch: 0 });
      }
    } else {
      elements.fallbackEditor.value = nextCode;
      if (settings.focus) {
        elements.fallbackEditor.focus();
      }
    }

    document.querySelectorAll(".file-tab").forEach(function (button) {
      const isActive = button.dataset.file === key;
      button.classList.toggle("is-active", isActive);
      button.setAttribute("aria-selected", String(isActive));
    });

    elements.activeFilename.textContent = FILE_CONFIG[key].name;
    updateCursorPosition();

    if (settings.focus && editor) {
      editor.focus();
    }

    if (!settings.preservePreview) {
      schedulePreview();
    }
  }

  function handleEditorChange() {
    state.files[state.activeFile] = editor.getValue();
    scheduleSave();

    if (state.autoRun) {
      schedulePreview();
    } else {
      elements.previewTimestamp.textContent = "有更改，尚未运行";
    }
  }

  function handleFallbackInput() {
    state.files[state.activeFile] = elements.fallbackEditor.value;
    scheduleSave();
    updateFallbackCursor();
    if (state.autoRun) {
      schedulePreview();
    } else {
      elements.previewTimestamp.textContent = "有更改，尚未运行";
    }
  }

  function handleFallbackKeydown(event) {
    const commandKey = event.metaKey || event.ctrlKey;
    if (commandKey && event.key === "Enter") {
      event.preventDefault();
      runPreview({ clearConsole: true });
    } else if (commandKey && event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveNow();
    } else if (event.key === "Tab") {
      event.preventDefault();
      const field = elements.fallbackEditor;
      const start = field.selectionStart;
      const end = field.selectionEnd;
      field.setRangeText("  ", start, end, "end");
      handleFallbackInput();
    }
  }

  function updateFallbackCursor() {
    const field = elements.fallbackEditor;
    const beforeCursor = field.value.slice(0, field.selectionStart);
    const lines = beforeCursor.split("\n");
    elements.cursorPosition.textContent = "行 " + lines.length + "，列 " + (lines[lines.length - 1].length + 1);
  }

  function updateCursorPosition() {
    if (!editor) {
      updateFallbackCursor();
      return;
    }

    const cursor = editor.getCursor();
    elements.cursorPosition.textContent = "行 " + (cursor.line + 1) + "，列 " + (cursor.ch + 1);
  }

  function scheduleSave() {
    window.clearTimeout(saveTimer);
    setSaveStatus("正在保存…", "saving");
    saveTimer = window.setTimeout(saveNow, 420);
  }

  function saveNow() {
    window.clearTimeout(saveTimer);
    try {
      localStorage.setItem(
        PROJECT_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          files: state.files,
          activeFile: state.activeFile,
          updatedAt: new Date().toISOString(),
        })
      );
      setSaveStatus("已保存到此设备", "saved");
    } catch (_error) {
      setSaveStatus("本地保存失败", "error");
      showToast("浏览器无法写入本地存储，请先导出代码，避免丢失。");
    }
  }

  function setSaveStatus(message, status) {
    elements.saveState.textContent = message;
    elements.saveDot.classList.toggle("is-saving", status === "saving");
    elements.saveDot.classList.toggle("is-error", status === "error");
  }

  function schedulePreview() {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(function () {
      if (state.autoRun) {
        runPreview({ clearConsole: true });
      }
    }, 520);
  }

  function runPreview(options) {
    const settings = Object.assign({ clearConsole: true }, options);
    window.clearTimeout(previewTimer);

    if (settings.clearConsole) {
      clearConsole();
    }

    elements.previewFrame.srcdoc = buildPreviewDocument(true);
    elements.previewTimestamp.textContent =
      "刚刚运行 · " +
      new Date().toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
      });

    const liveDot = document.querySelector(".preview-live-dot");
    liveDot.classList.remove("is-running");
    void liveDot.offsetWidth;
    liveDot.classList.add("is-running");
  }

  function buildPreviewDocument(includeConsoleBridge) {
    let documentSource = state.files.html || "<!doctype html><html><head></head><body></body></html>";
    const css = state.files.css || "";
    const js = (state.files.js || "").replace(/<\/script/gi, "<\\/script");
    const styleTag = "<style>" + css.replace(/<\/style/gi, "<\\/style") + "</style>";
    const consoleBridge = includeConsoleBridge ? buildConsoleBridge() : "";
    const scriptTag = "<script>" + js + "</script>";

    if (/<\/head\s*>/i.test(documentSource)) {
      documentSource = documentSource.replace(/<\/head\s*>/i, styleTag + "</head>");
    } else {
      documentSource = styleTag + documentSource;
    }

    if (/<\/body\s*>/i.test(documentSource)) {
      documentSource = documentSource.replace(
        /<\/body\s*>/i,
        consoleBridge + scriptTag + "</body>"
      );
    } else {
      documentSource += consoleBridge + scriptTag;
    }

    return documentSource;
  }

  function buildConsoleBridge() {
    return `<script>
      (function () {
        function normalize(value) {
          if (typeof value === "string") return value;
          if (typeof value === "undefined") return "undefined";
          if (value instanceof Error) return value.stack || value.message;
          try {
            var text = JSON.stringify(value);
            if (typeof text === "undefined") return String(value);
            return text.length > 1400 ? text.slice(0, 1400) + "…" : text;
          } catch (_error) {
            return String(value);
          }
        }

        function send(type, values) {
          try {
            window.parent.postMessage({
              source: "padcode-preview",
              type: type,
              text: values.map(normalize).join(" ")
            }, "*");
          } catch (_error) {}
        }

        ["log", "info", "warn", "error"].forEach(function (type) {
          var original = console[type];
          console[type] = function () {
            original.apply(console, arguments);
            send(type, Array.prototype.slice.call(arguments));
          };
        });

        var originalClear = console.clear;
        console.clear = function () {
          originalClear.call(console);
          try {
            window.parent.postMessage({ source: "padcode-preview", type: "clear", text: "" }, "*");
          } catch (_error) {}
        };

        window.addEventListener("error", function (event) {
          var location = event.lineno ? " · 第 " + event.lineno + " 行" : "";
          send("error", [event.message + location]);
        });

        window.addEventListener("unhandledrejection", function (event) {
          send("error", ["未处理的 Promise 异常：" + normalize(event.reason)]);
        });
      })();
    </script>`;
  }

  function receivePreviewMessage(event) {
    if (event.source !== elements.previewFrame.contentWindow) {
      return;
    }

    const data = event.data;
    if (!data || data.source !== "padcode-preview") {
      return;
    }

    if (data.type === "clear") {
      clearConsole();
      return;
    }

    appendConsoleEntry(data.type || "log", data.text || "");
  }

  function appendConsoleEntry(type, text) {
    consoleLogs.push({ type: type, text: text });
    if (consoleLogs.length > MAX_CONSOLE_ENTRIES) {
      consoleLogs.shift();
    }

    if (type === "error") {
      setConsoleExpanded(true);
    }

    renderConsole();
  }

  function clearConsole() {
    consoleLogs.length = 0;
    renderConsole();
  }

  function renderConsole() {
    elements.consoleOutput.replaceChildren();
    elements.consoleCount.textContent = String(consoleLogs.length);

    if (consoleLogs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "console-empty";
      empty.textContent = "这里会显示 console 输出和页面错误。";
      elements.consoleOutput.append(empty);
      return;
    }

    consoleLogs.forEach(function (entry) {
      const row = document.createElement("div");
      const type = document.createElement("span");
      const message = document.createElement("span");
      row.className = "console-entry" + (entry.type === "warn" ? " is-warn" : "");
      row.className += entry.type === "error" ? " is-error" : "";
      row.className += entry.type === "info" ? " is-system" : "";
      type.className = "console-type";
      type.textContent = entry.type;
      message.textContent = entry.text;
      row.append(type, message);
      elements.consoleOutput.append(row);
    });

    elements.consoleOutput.scrollTop = elements.consoleOutput.scrollHeight;
  }

  function toggleConsole() {
    const expanded = elements.consolePanel.classList.contains("is-collapsed");
    setConsoleExpanded(expanded);
  }

  function setConsoleExpanded(expanded) {
    elements.consolePanel.classList.toggle("is-collapsed", !expanded);
    elements.consoleToggle.setAttribute("aria-expanded", String(expanded));
  }

  function setView(view) {
    const safeView = view === "preview" ? "preview" : "code";
    elements.workspace.dataset.view = safeView;
    document.querySelectorAll(".view-switch button").forEach(function (button) {
      const active = button.dataset.view === safeView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function openTemplateDialog() {
    if (typeof elements.templateDialog.showModal === "function") {
      elements.templateDialog.showModal();
    } else {
      elements.templateDialog.setAttribute("open", "");
    }
  }

  function applyTemplate(name) {
    if (!TEMPLATES[name]) {
      return;
    }

    const shouldReplace = window.confirm("载入示例会替换当前三个文件。要继续吗？");
    if (!shouldReplace) {
      return;
    }

    state.files = {
      html: TEMPLATES[name].html,
      css: TEMPLATES[name].css,
      js: TEMPLATES[name].js,
    };

    switchFile("html", { focus: true, preservePreview: true });
    saveNow();
    runPreview({ clearConsole: true });
    elements.templateDialog.close();
    showToast("示例已载入，可以开始修改了。");
  }

  function importFile() {
    const file = elements.fileInput.files && elements.fileInput.files[0];
    if (!file) {
      return;
    }

    const extension = file.name.split(".").pop().toLowerCase();
    const target = extension === "htm" ? "html" : extension;
    if (!FILE_CONFIG[target]) {
      showToast("请选择 .html、.css 或 .js 文件。");
      elements.fileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", function () {
      state.files[target] = String(reader.result || "");
      switchFile(target, { focus: true, preservePreview: true });
      saveNow();
      runPreview({ clearConsole: true });
      showToast(file.name + " 已导入。");
      elements.fileInput.value = "";
    });
    reader.addEventListener("error", function () {
      showToast("文件读取失败，请重试。");
      elements.fileInput.value = "";
    });
    reader.readAsText(file);
  }

  function exportProject() {
    const filename = safeFilename(extractProjectTitle()) + ".html";
    downloadBlob(buildPreviewDocument(false), filename, "text/html;charset=utf-8");
    showToast("已导出单个 HTML 文件。");
  }

  function openPreviewInNewWindow() {
    const blob = new Blob([buildPreviewDocument(false)], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const previewWindow = window.open(url, "_blank");

    if (!previewWindow) {
      URL.revokeObjectURL(url);
      showToast("Safari 阻止了新窗口，请允许弹出式窗口后重试。");
      return;
    }

    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 60000);
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type: type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(function () {
      URL.revokeObjectURL(url);
    }, 1000);
  }

  function extractProjectTitle() {
    const match = state.files.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = match ? match[1].replace(/<[^>]+>/g, "").trim() : "padcode-project";
    return title || "padcode-project";
  }

  function safeFilename(value) {
    return (
      value
        .replace(/[\\/:*?"<>|]+/g, "-")
        .replace(/\s+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80) || "padcode-project"
    );
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 3200);
  }

  function handleGlobalKeydown(event) {
    const commandKey = event.metaKey || event.ctrlKey;
    if (!commandKey) {
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      runPreview({ clearConsole: true });
      if (window.matchMedia("(max-width: 900px)").matches) {
        setView("preview");
      }
    } else if (event.key.toLowerCase() === "s") {
      event.preventDefault();
      saveNow();
    }
  }

  function updateShortcutLabels() {
    const isAppleDevice =
      /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) ||
      /MacIntel/.test(navigator.platform);
    elements.runShortcut.textContent = isAppleDevice ? "⌘ ↵" : "Ctrl ↵";
    elements.saveShortcut.textContent = isAppleDevice ? "⌘ S" : "Ctrl S";
  }

  function loadProject() {
    try {
      const raw = localStorage.getItem(PROJECT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.files) {
          return {
            files: {
              html:
                typeof parsed.files.html === "string"
                  ? parsed.files.html
                  : TEMPLATES.starter.html,
              css:
                typeof parsed.files.css === "string"
                  ? parsed.files.css
                  : TEMPLATES.starter.css,
              js:
                typeof parsed.files.js === "string" ? parsed.files.js : TEMPLATES.starter.js,
            },
            activeFile: FILE_CONFIG[parsed.activeFile] ? parsed.activeFile : "html",
          };
        }
      }
    } catch (_error) {
      // Fall back to the starter template when local storage is unavailable or corrupt.
    }

    return {
      files: {
        html: TEMPLATES.starter.html,
        css: TEMPLATES.starter.css,
        js: TEMPLATES.starter.js,
      },
      activeFile: "html",
    };
  }

  function readAutoRunPreference() {
    try {
      const value = localStorage.getItem(AUTORUN_STORAGE_KEY);
      return value === null ? true : value === "1";
    } catch (_error) {
      return true;
    }
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js").catch(function () {
          // The editor still works without offline caching.
        });
      });
    }
  }

  function buildStarterTemplate() {
    return {
      html: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>我的第一个网页</title>
  </head>
  <body>
    <div class="orb orb-one"></div>
    <div class="orb orb-two"></div>

    <main class="hero">
      <p class="eyebrow">MADE ON IPAD</p>
      <h1>你好，<br /><em>PadCode。</em></h1>
      <p class="intro">
        改几行代码，右侧会立即更新。<br />
        这个页面现在完全属于你。
      </p>
      <button id="magicButton" type="button">
        点我试试
        <span id="clickCount">0</span>
      </button>
    </main>

    <footer>
      <span>HTML</span>
      <i></i>
      <span>CSS</span>
      <i></i>
      <span>JavaScript</span>
    </footer>
  </body>
</html>`,
      css: `:root {
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  color: #20231f;
  background: #f3e8da;
}

* {
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  margin: 0;
  overflow: hidden;
  background:
    radial-gradient(circle at 85% 10%, rgba(255, 255, 255, 0.8), transparent 28%),
    #f3e8da;
}

.orb {
  position: fixed;
  border-radius: 50%;
  filter: blur(1px);
  pointer-events: none;
}

.orb-one {
  top: -12vw;
  right: -9vw;
  width: 34vw;
  height: 34vw;
  min-width: 190px;
  min-height: 190px;
  background: #f4794f;
  opacity: 0.78;
}

.orb-two {
  bottom: -13vw;
  left: -9vw;
  width: 31vw;
  height: 31vw;
  min-width: 180px;
  min-height: 180px;
  border: 1px solid rgba(32, 35, 31, 0.12);
  background: #b9d7d0;
  opacity: 0.55;
}

.hero {
  position: relative;
  z-index: 1;
  display: flex;
  min-height: 100vh;
  flex-direction: column;
  justify-content: center;
  padding: clamp(32px, 8vw, 100px);
}

.eyebrow {
  margin: 0 0 18px;
  color: #8d735e;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.2em;
}

h1 {
  max-width: 800px;
  margin: 0;
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(58px, 13vw, 148px);
  font-weight: 400;
  letter-spacing: -0.07em;
  line-height: 0.82;
}

h1 em {
  color: #d94d24;
  font-style: italic;
  white-space: nowrap;
}

.intro {
  margin: 30px 0 0;
  color: #6f685f;
  font-size: clamp(14px, 2.2vw, 18px);
  line-height: 1.8;
}

button {
  display: flex;
  width: max-content;
  align-items: center;
  gap: 15px;
  margin-top: 32px;
  padding: 13px 15px 13px 20px;
  border: 0;
  border-radius: 999px;
  background: #20231f;
  box-shadow: 0 9px 28px rgba(32, 35, 31, 0.2);
  color: #f8f1e9;
  cursor: pointer;
  font-size: 13px;
  transition: transform 180ms ease;
}

button:hover {
  transform: translateY(-2px);
}

button:active {
  transform: scale(0.96);
}

button span {
  display: grid;
  width: 29px;
  height: 29px;
  place-items: center;
  border-radius: 50%;
  background: #f58a61;
  color: #20231f;
  font-size: 11px;
  font-weight: 700;
}

footer {
  position: fixed;
  right: clamp(24px, 5vw, 70px);
  bottom: 26px;
  display: flex;
  align-items: center;
  gap: 10px;
  color: #928878;
  font-family: ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.08em;
}

footer i {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: #bcae9f;
}

@media (max-width: 600px) {
  .hero {
    padding: 34px 26px;
  }

  h1 {
    font-size: clamp(64px, 22vw, 100px);
  }

  footer {
    right: auto;
    left: 26px;
  }
}
`,
      js: `const button = document.querySelector("#magicButton");
const counter = document.querySelector("#clickCount");
const messages = ["很好！", "继续探索", "代码开始有生命了"];
let count = 0;

button.addEventListener("click", () => {
  count += 1;
  counter.textContent = count;
  button.firstChild.textContent = messages[count % messages.length] + " ";

  button.animate(
    [
      { transform: "scale(1)" },
      { transform: "scale(0.92)" },
      { transform: "scale(1)" }
    ],
    { duration: 280, easing: "ease-out" }
  );

  console.log("按钮被点击了", count, "次");
});

console.log("欢迎来到 PadCode。试试修改 index.html 里的文案。");`,
    };
  }

  function buildProfileTemplate() {
    return {
      html: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>我的个人名片</title>
  </head>
  <body>
    <main class="profile">
      <section class="identity">
        <div class="avatar" aria-hidden="true">你</div>
        <p class="label">HELLO, WORLD</p>
        <h1>你好，我是<br /><em>一名创造者。</em></h1>
        <p class="summary">
          我正在学习网页设计，喜欢把想法变成可以点击、可以看见的东西。
        </p>
        <div class="links">
          <a href="#project">查看作品</a>
          <a href="mailto:hello@example.com">联系我</a>
        </div>
      </section>

      <aside class="details">
        <div>
          <span>当前位置</span>
          <strong>中国 · 上海</strong>
        </div>
        <div>
          <span>正在学习</span>
          <strong>HTML / CSS / JavaScript</strong>
        </div>
        <div>
          <span>最近更新</span>
          <strong id="year">2026</strong>
        </div>
      </aside>

      <section class="project" id="project">
        <p class="label">SELECTED PROJECT</p>
        <h2>我的第一个网页</h2>
        <p>从一个空白页面开始，把它变成真正属于自己的空间。</p>
      </section>
    </main>
  </body>
</html>`,
      css: `:root {
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
  color: #e8eef4;
  background: #17222d;
}

* {
  box-sizing: border-box;
}

body {
  min-height: 100vh;
  margin: 0;
  background:
    radial-gradient(circle at 10% 0%, rgba(91, 155, 172, 0.35), transparent 36%),
    linear-gradient(145deg, #13202b, #172a31 54%, #10252b);
}

.profile {
  display: grid;
  min-height: 100vh;
  grid-template-columns: minmax(0, 1.45fr) minmax(230px, 0.55fr);
  grid-template-rows: 1fr auto;
  gap: 30px clamp(30px, 6vw, 90px);
  padding: clamp(30px, 7vw, 90px);
}

.identity {
  align-self: center;
}

.avatar {
  display: grid;
  width: 62px;
  height: 62px;
  margin-bottom: 40px;
  place-items: center;
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: 50%;
  background: #d3ece7;
  color: #173037;
  font-family: Georgia, "Songti SC", serif;
  font-size: 24px;
}

.label {
  margin: 0 0 16px;
  color: #73b5bb;
  font-family: ui-monospace, monospace;
  font-size: 9px;
  letter-spacing: 0.18em;
}

h1 {
  margin: 0;
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(44px, 8vw, 92px);
  font-weight: 400;
  letter-spacing: -0.055em;
  line-height: 0.98;
}

h1 em {
  color: #ffb080;
  font-style: italic;
}

.summary {
  max-width: 580px;
  margin: 28px 0 0;
  color: #aebdc8;
  font-size: 14px;
  line-height: 1.8;
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: 11px;
  margin-top: 30px;
}

.links a {
  padding: 10px 16px;
  border: 1px solid rgba(255, 255, 255, 0.16);
  border-radius: 999px;
  color: #ecf4f5;
  font-size: 11px;
  text-decoration: none;
}

.links a:first-child {
  border-color: #ffb080;
  background: #ffb080;
  color: #14252b;
}

.details {
  align-self: end;
  padding: 22px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.035);
}

.details div {
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding: 14px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.details div:last-child {
  border-bottom: 0;
}

.details span {
  color: #718a98;
  font-size: 9px;
}

.details strong {
  font-size: 11px;
  font-weight: 500;
}

.project {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 20px;
  padding-top: 24px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
}

.project h2 {
  margin: 0;
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(24px, 4vw, 42px);
  font-weight: 400;
}

.project > p:last-child {
  max-width: 460px;
  margin: 0;
  color: #8da2af;
  font-size: 12px;
  line-height: 1.8;
}

@media (max-width: 680px) {
  .profile {
    grid-template-columns: 1fr;
    padding: 34px 25px;
  }

  .details {
    display: none;
  }

  .project {
    grid-template-columns: 1fr;
  }
}
`,
      js: `const year = document.querySelector("#year");
year.textContent = String(new Date().getFullYear());

document.querySelector(".avatar").addEventListener("click", () => {
  document.querySelector("h1 em").animate(
    [
      { color: "#ffb080" },
      { color: "#78d9cf" },
      { color: "#ffb080" }
    ],
    { duration: 900 }
  );
  console.log("你好！这是我的个人名片。");
});`,
    };
  }

  function buildBlankTemplate() {
    return {
      html: `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>空白画布</title>
  </head>
  <body>
    <main>
      <h1>Hello, PadCode!</h1>
      <p>从一个空白画布开始，创造你的网页。</p>
    </main>
  </body>
</html>`,
      css: `* {
  box-sizing: border-box;
}

body {
  display: grid;
  min-height: 100vh;
  margin: 0;
  place-items: center;
  background: #f4f1eb;
  color: #20231f;
  font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
}

main {
  padding: 28px;
  text-align: center;
}

h1 {
  margin: 0;
  font-family: Georgia, "Songti SC", serif;
  font-size: clamp(42px, 8vw, 78px);
  font-weight: 400;
}

p {
  color: #75766f;
}
`,
      js: `console.log("Hello, PadCode!");`,
    };
  }
})();
