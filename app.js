(function () {
  "use strict";

  const PROJECT_STORAGE_KEY = "padcode.project.v1";
  const AUTORUN_STORAGE_KEY = "padcode.autorun.v1";
  const PREVIEW_COLLAPSE_STORAGE_KEY = "padcode.previewCollapsed.v1";
  const AI_CONFIG_STORAGE_KEY = "padcode.ai.config.v1";
  const AI_KEY_STORAGE_KEY = "padcode.ai.key.v1";
  const CHECKPOINT_STORAGE_KEY = "padcode.checkpoint.v1";
  const MAX_CONSOLE_ENTRIES = 80;
  const MAX_AI_HISTORY = 12;

  const FILE_CONFIG = {
    html: { name: "index.html", mode: "htmlmixed" },
    css: { name: "style.css", mode: "css" },
    js: { name: "script.js", mode: "javascript" },
  };

  const LANGUAGE_CONFIG = {
    web: {
      label: "Web · HTML/CSS/JS",
      fileName: "index.html",
      mode: "htmlmixed",
    },
    python: {
      label: "Python 3",
      fileName: "main.py",
      mode: "python",
      pistonLanguage: "python",
      version: "3.10.0",
    },
    java: {
      label: "Java",
      fileName: "Main.java",
      mode: "text/x-java",
      pistonLanguage: "java",
      version: "15.0.2",
    },
    c: {
      label: "C",
      fileName: "main.c",
      mode: "text/x-csrc",
      pistonLanguage: "c",
      version: "10.2.0",
    },
    cpp: {
      label: "C++",
      fileName: "main.cpp",
      mode: "text/x-c++src",
      pistonLanguage: "c++",
      version: "10.2.0",
    },
  };

  const PISTON_ENDPOINT = "https://emkc.org/api/v2/piston/execute";
  const PISTON_RUNTIMES_ENDPOINT = "https://emkc.org/api/v2/piston/runtimes";

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

  const AI_SYSTEM_PROMPT = `你是 PadCode 内置的多语言开发助手，服务对象是一台 iPad。
你可以查看用户当前工作区中的网页文件、Python、Java、C、C++ 代码草稿和运行输出。
回答要使用简体中文，直接解决问题，不要虚构已经执行过的操作。

修改文件时，必须在回答末尾为每个需要更新的文件输出完整内容，格式严格如下：
<file name="index.html">
完整文件内容
</file>
<file name="style.css">
完整文件内容
</file>
代码草稿使用对应文件名，例如 <file name="main.py">。只输出真正需要修改的文件。代码中不得包含 Markdown 代码围栏。不要输出部分片段，因为 PadCode 会用这些内容替换整个文件。
如果用户只是咨询或不需要改代码，则不要输出 file 标签。`;

  const TEMPLATES = {
    starter: buildStarterTemplate(),
    profile: buildProfileTemplate(),
    blank: buildBlankTemplate(),
  };

  const CODE_STARTERS = buildCodeStarters();

  const elements = {
    appShell: document.querySelector(".app-shell"),
    workspace: document.querySelector("#workspace"),
    editorHost: document.querySelector("#editorHost"),
    fallbackEditor: document.querySelector("#fallbackEditor"),
    activeFilename: document.querySelector("#activeFilename"),
    fileTabs: document.querySelector(".file-tabs"),
    newFileTabButton: document.querySelector("#newFileTabButton"),
    drawerNewFileButton: document.querySelector("#drawerNewFileButton"),
    customFileTree: document.querySelector("#customFileTree"),
    customFileCount: document.querySelector("#customFileCount"),
    activeFileActions: document.querySelector("#activeFileActions"),
    renameFileButton: document.querySelector("#renameFileButton"),
    deleteFileButton: document.querySelector("#deleteFileButton"),
    fileDialog: document.querySelector("#fileDialog"),
    fileForm: document.querySelector("#fileForm"),
    newFileNameInput: document.querySelector("#newFileNameInput"),
    fileDialogError: document.querySelector("#fileDialogError"),
    languageSelect: document.querySelector("#languageSelect"),
    templateButtonLabel: document.querySelector("#templateButtonLabel"),
    cursorPosition: document.querySelector("#cursorPosition"),
    saveState: document.querySelector("#saveState"),
    saveDot: document.querySelector("#saveDot"),
    autoRunToggle: document.querySelector("#autoRunToggle"),
    autoRunLabel: document.querySelector("#autoRunLabel"),
    runButton: document.querySelector("#runButton"),
    runShortcut: document.querySelector("#runShortcut"),
    saveShortcut: document.querySelector("#saveShortcut"),
    importButton: document.querySelector("#importButton"),
    exportButton: document.querySelector("#exportButton"),
    fileInput: document.querySelector("#fileInput"),
    reloadButton: document.querySelector("#reloadButton"),
    openButton: document.querySelector("#openButton"),
    collapsePreviewButton: document.querySelector("#collapsePreviewButton"),
    showPreviewButton: document.querySelector("#showPreviewButton"),
    stdinButton: document.querySelector("#stdinButton"),
    stdinDialog: document.querySelector("#stdinDialog"),
    stdinInput: document.querySelector("#stdinInput"),
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
    workbenchDrawer: document.querySelector("#workbenchDrawer"),
    workbenchScrim: document.querySelector("#workbenchScrim"),
    workbenchCloseButton: document.querySelector("#workbenchCloseButton"),
    workbenchPanelTitle: document.querySelector("#workbenchPanelTitle"),
    workbenchSearchInput: document.querySelector("#workbenchSearchInput"),
    workbenchSearchResults: document.querySelector("#workbenchSearchResults"),
    createCheckpointButton: document.querySelector("#createCheckpointButton"),
    compareCheckpointButton: document.querySelector("#compareCheckpointButton"),
    restoreCheckpointButton: document.querySelector("#restoreCheckpointButton"),
    checkpointInfo: document.querySelector("#checkpointInfo"),
    workbenchChanges: document.querySelector("#workbenchChanges"),
    problemsSummary: document.querySelector("#problemsSummary"),
    workbenchProblems: document.querySelector("#workbenchProblems"),
    openProblemsConsoleButton: document.querySelector("#openProblemsConsoleButton"),
    drawerImportButton: document.querySelector("#drawerImportButton"),
    drawerExportButton: document.querySelector("#drawerExportButton"),
    openEditorLabel: document.querySelector("#openEditorLabel"),
    commandPaletteButton: document.querySelector("#commandPaletteButton"),
    activitySettingsButton: document.querySelector("#activitySettingsButton"),
    commandDialog: document.querySelector("#commandDialog"),
    commandInput: document.querySelector("#commandInput"),
    commandList: document.querySelector("#commandList"),
    extensionAiStatus: document.querySelector("#extensionAiStatus"),
    toast: document.querySelector("#toast"),
  };

  const savedProject = loadProject();
  const state = {
    files: savedProject.files,
    codeProjects: savedProject.codeProjects,
    customFiles: savedProject.customFiles,
    activeLanguage: savedProject.activeLanguage,
    activeFile: savedProject.activeFile,
    activeDocumentKind: savedProject.activeDocumentKind,
    activeCustomFileId: savedProject.activeCustomFileId,
    cursors: {},
    autoRun: readAutoRunPreference(),
    previewCollapsed: readPreviewCollapsedPreference(),
  };

  let editor = null;
  let saveTimer = 0;
  let previewTimer = 0;
  let toastTimer = 0;
  let pistonBusy = false;
  let embeddedRunnerReady = false;
  let embeddedRunnerCompleted = false;
  let embeddedRunnerTimer = 0;
  let embeddedRunnerRetryTimer = 0;
  const consoleLogs = [];
  let aiConfig = loadAIConfig();
  let aiHistory = [];
  let aiBusy = false;
  let aiHasOpened = false;
  let activeWorkbenchPanel = "explorer";
  let selectedCommandIndex = 0;
  let filteredCommands = [];
  let monacoProblems = [];

  initialize();

  function initialize() {
    const requestedLanguage = new URLSearchParams(window.location.search).get("lang");
    if (requestedLanguage && LANGUAGE_CONFIG[requestedLanguage]) {
      state.activeLanguage = requestedLanguage;
      state.activeDocumentKind = requestedLanguage === "web" ? "web" : "code";
      state.activeCustomFileId = null;
    }
    elements.autoRunToggle.checked = state.autoRun;
    setPreviewCollapsed(state.previewCollapsed, { persist: false });
    updateShortcutLabels();
    updateAIStatus();
    bindControls();
    initializeEditor(startWorkbench);
  }

  function startWorkbench() {
    if (
      state.activeDocumentKind === "custom" &&
      getCustomFile(state.activeCustomFileId)
    ) {
      activateCustomFile(state.activeCustomFileId, {
        focus: false,
        persist: false,
        run: false,
      });
    } else {
      activateLanguage(state.activeLanguage, { focus: false, persist: false, run: false });
    }
    renderCustomFileTree();
    renderFileTabs();
    setView(new URLSearchParams(window.location.search).get("view") === "preview" ? "preview" : "code");
    saveNow();
    if (isWebLanguage()) {
      runPreview({ clearConsole: true });
    } else {
      renderCodeIdle();
    }
    updateCheckpointInfo();
    updateTreeSelection();
    renderProblems();
    registerServiceWorker();
  }

  function bindControls() {
    elements.fileTabs.addEventListener("click", function (event) {
      const button = event.target.closest(".file-tab");
      if (!button) {
        return;
      }
      if (button.dataset.customId) {
        activateCustomFile(button.dataset.customId);
      } else if (button.dataset.codeLanguage) {
        activateLanguage(button.dataset.codeLanguage);
      } else if (button.dataset.file) {
        activateLanguage("web");
        switchFile(button.dataset.file);
      }
    });

    elements.newFileTabButton.addEventListener("click", openFileDialog);
    elements.drawerNewFileButton.addEventListener("click", openFileDialog);
    elements.fileForm.addEventListener("submit", handleNewFileSubmit);
    elements.fileDialog.querySelectorAll("[data-close-file-dialog]").forEach(function (button) {
      button.addEventListener("click", function () {
        elements.fileDialog.close();
      });
    });
    elements.fileDialog.addEventListener("click", function (event) {
      if (event.target === elements.fileDialog) {
        elements.fileDialog.close();
      }
    });
    elements.customFileTree.addEventListener("click", handleCustomFileTreeClick);
    elements.renameFileButton.addEventListener("click", renameActiveCustomFile);
    elements.deleteFileButton.addEventListener("click", deleteActiveCustomFile);

    elements.languageSelect.addEventListener("change", function () {
      activateLanguage(elements.languageSelect.value);
    });

    document.querySelectorAll(".view-switch button").forEach(function (button) {
      button.addEventListener("click", function () {
        setView(button.dataset.view);
      });
    });

    elements.autoRunToggle.addEventListener("change", function () {
      if (!isWebLanguage()) {
        return;
      }
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
      if (state.previewCollapsed) {
        setPreviewCollapsed(false);
      }
      runCurrent({ showPreview: true });
      if (window.matchMedia("(max-width: 900px)").matches) {
        setView("preview");
      }
    });

    elements.reloadButton.addEventListener("click", function () {
      runCurrent();
    });

    elements.collapsePreviewButton.addEventListener("click", function () {
      setPreviewCollapsed(true);
    });
    elements.showPreviewButton.addEventListener("click", function () {
      setPreviewCollapsed(false);
      setView("preview");
    });
    elements.openButton.addEventListener("click", openPreviewInNewWindow);
    elements.exportButton.addEventListener("click", exportProject);
    elements.importButton.addEventListener("click", function () {
      elements.fileInput.click();
    });
    elements.fileInput.addEventListener("change", importFile);
    elements.templateButton.addEventListener("click", handleTemplateButton);
    elements.clearConsoleButton.addEventListener("click", clearConsole);
    elements.consoleToggle.addEventListener("click", toggleConsole);
    elements.stdinButton.addEventListener("click", openStdinDialog);
    elements.stdinInput.addEventListener("input", saveStdinValue);
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

    elements.stdinDialog.addEventListener("click", function (event) {
      if (event.target === elements.stdinDialog) {
        elements.stdinDialog.close();
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

    document.querySelectorAll("[data-workbench-panel]").forEach(function (button) {
      button.addEventListener("click", function () {
        toggleWorkbenchPanel(button.dataset.workbenchPanel);
      });
    });

    document.querySelectorAll("[data-web-file]").forEach(function (button) {
      button.addEventListener("click", function () {
        activateLanguage("web");
        switchFile(button.dataset.webFile);
        updateTreeSelection();
        closeWorkbench();
      });
    });

    document.querySelectorAll("[data-code-language]").forEach(function (button) {
      button.addEventListener("click", function () {
        activateLanguage(button.dataset.codeLanguage);
        updateTreeSelection();
        closeWorkbench();
      });
    });

    elements.workbenchCloseButton.addEventListener("click", closeWorkbench);
    elements.workbenchScrim.addEventListener("click", closeWorkbench);
    elements.drawerImportButton.addEventListener("click", function () {
      elements.fileInput.click();
    });
    elements.drawerExportButton.addEventListener("click", exportProject);
    elements.workbenchSearchInput.addEventListener("input", renderWorkbenchSearch);
    elements.workbenchSearchResults.addEventListener("click", openSearchResult);
    elements.createCheckpointButton.addEventListener("click", createCheckpoint);
    elements.compareCheckpointButton.addEventListener("click", compareCheckpoint);
    elements.restoreCheckpointButton.addEventListener("click", restoreCheckpoint);
    elements.workbenchChanges.addEventListener("click", openCheckpointChange);
    elements.workbenchProblems.addEventListener("click", openProblem);
    elements.openProblemsConsoleButton.addEventListener("click", function () {
      setConsoleExpanded(true);
      setView("preview");
      closeWorkbench();
    });
    elements.commandPaletteButton.addEventListener("click", function () {
      openCommandPalette("");
    });
    elements.activitySettingsButton.addEventListener("click", function () {
      closeWorkbench();
      openAISettings();
    });
    elements.commandInput.addEventListener("input", renderCommandPalette);
    elements.commandInput.addEventListener("keydown", handleCommandKeydown);
    elements.commandDialog.addEventListener("click", function (event) {
      if (event.target === elements.commandDialog) {
        elements.commandDialog.close();
      }
    });
    elements.commandList.addEventListener("click", function (event) {
      const button = event.target.closest("[data-command-index]");
      if (button) {
        executeCommandByIndex(Number(button.dataset.commandIndex));
      }
    });

    window.addEventListener("message", receivePreviewMessage);
    window.addEventListener("message", receiveEmbeddedRunnerMessage);
    elements.previewFrame.addEventListener("load", handleEmbeddedRunnerLoad);
    document.addEventListener("keydown", handleGlobalKeydown, true);
  }

  function initializeEditor(onReady) {
    if (window.require && typeof window.require === "function") {
      let completed = false;
      const complete = function () {
        if (!completed) {
          completed = true;
          onReady();
        }
      };

      try {
        window.require(
          ["vs/editor/editor.main"],
          function (monaco) {
            initializeMonacoEditor(monaco);
            complete();
          },
          function () {
            initializeFallbackEditor();
            showToast("Monaco 加载失败，已切换到基础编辑模式。");
            complete();
          }
        );
        return;
      } catch (_error) {
        // Fall through to the existing CodeMirror or textarea editor.
      }
    }

    initializeFallbackEditor();
    onReady();
  }

  function initializeMonacoEditor(monaco) {
    const languageByMode = {
      htmlmixed: "html",
      css: "css",
      javascript: "javascript",
      python: "python",
      "text/x-java": "java",
      "text/x-csrc": "c",
      "text/x-c++src": "cpp",
    };
    const models = new Map();
    const viewStates = new Map();
    const changeListeners = [];
    const cursorListeners = [];
    let currentKey = "";
    let pendingMode = getActiveMode();
    let applyingValue = false;

    self.MonacoEnvironment = {
      getWorkerUrl: function (_moduleId, label) {
        const workers = {
          json: "vendor/monaco/vs/assets/json.worker-Csf_TLih.js",
          css: "vendor/monaco/vs/assets/css.worker-BpD9FCKP.js",
          html: "vendor/monaco/vs/assets/html.worker-CLuInTTy.js",
          typescript: "vendor/monaco/vs/assets/ts.worker-g3pjEjl4.js",
          javascript: "vendor/monaco/vs/assets/ts.worker-g3pjEjl4.js",
        };
        return workers[label] || "vendor/monaco/vs/assets/editor.worker-_vAIFJDs.js";
      },
    };

    monaco.editor.defineTheme("padcode-vs", {
      base: "vs-dark",
      inherit: true,
      rules: [
        { token: "comment", foreground: "6F7B8C", fontStyle: "italic" },
        { token: "keyword", foreground: "FF9FB1" },
        { token: "string", foreground: "A2DEB5" },
        { token: "number", foreground: "F2C477" },
        { token: "tag", foreground: "FF8E71" },
        { token: "attribute.name", foreground: "F3CB71" },
      ],
      colors: {
        "editor.background": "#10141B",
        "editor.foreground": "#D9E1EE",
        "editorLineNumber.foreground": "#495668",
        "editorLineNumber.activeForeground": "#AAB5C5",
        "editorCursor.foreground": "#FFB46F",
        "editor.selectionBackground": "#2A3F61",
        "editor.inactiveSelectionBackground": "#253652",
        "editor.lineHighlightBackground": "#141A23",
        "editorIndentGuide.background1": "#252D39",
        "editorIndentGuide.activeBackground1": "#455164",
        "editorWidget.background": "#171D27",
        "editorWidget.border": "#344050",
        "editorSuggestWidget.background": "#171D27",
        "editorSuggestWidget.selectedBackground": "#263447",
        "editorHoverWidget.background": "#171D27",
        "editorHoverWidget.border": "#344050",
        "minimap.background": "#0D1117",
      },
    });

    const monacoEditor = monaco.editor.create(elements.editorHost, {
      value: "",
      language: languageByMode[pendingMode] || "plaintext",
      theme: "padcode-vs",
      automaticLayout: true,
      fontFamily: '"SFMono-Regular", "Cascadia Code", Menlo, Consolas, monospace',
      fontSize: 13,
      lineHeight: 22,
      lineNumbers: "on",
      glyphMargin: false,
      folding: true,
      foldingHighlight: true,
      showFoldingControls: "mouseover",
      minimap: {
        enabled: window.matchMedia("(min-width: 901px)").matches,
        renderCharacters: false,
        maxColumn: 88,
      },
      wordWrap: "on",
      wrappingIndent: "indent",
      tabSize: 2,
      insertSpaces: true,
      detectIndentation: false,
      formatOnPaste: true,
      formatOnType: true,
      autoClosingBrackets: "languageDefined",
      autoClosingQuotes: "languageDefined",
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      smoothScrolling: true,
      cursorBlinking: "smooth",
      cursorSmoothCaretAnimation: "on",
      quickSuggestions: { other: true, comments: false, strings: true },
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: "smart",
      tabCompletion: "on",
      snippetSuggestions: "top",
      parameterHints: { enabled: true },
      hover: { enabled: true },
      links: true,
      colorDecorators: true,
      codeLens: true,
      renderWhitespace: "selection",
      renderControlCharacters: true,
      stickyScroll: { enabled: true },
      padding: { top: 14, bottom: 90 },
      scrollBeyondLastLine: false,
      fixedOverflowWidgets: true,
      accessibilitySupport: "auto",
    });

    elements.editorHost.classList.remove("is-hidden");
    elements.fallbackEditor.classList.remove("is-visible");

    monacoEditor.onDidChangeModelContent(function () {
      if (!applyingValue) {
        changeListeners.forEach(function (listener) {
          listener();
        });
      }
    });

    monaco.editor.onDidChangeMarkers(function () {
      const nextProblems = [];
      models.forEach(function (model, modelKey) {
        const parts = modelKey.split(":");
        const targetKind = parts[0];
        const targetKey = parts.slice(1).join(":");
        const filename =
          targetKind === "web" && FILE_CONFIG[targetKey]
            ? FILE_CONFIG[targetKey].name
            : targetKind === "code" && LANGUAGE_CONFIG[targetKey]
              ? LANGUAGE_CONFIG[targetKey].fileName
              : model.uri.path.split("/").pop();
        monaco.editor.getModelMarkers({ resource: model.uri }).forEach(function (marker) {
          if (marker.severity >= monaco.MarkerSeverity.Warning) {
            nextProblems.push({
              kind: "marker",
              targetKind: targetKind,
              key: targetKey,
              filename: filename,
              message: marker.message,
              line: marker.startLineNumber,
              column: marker.startColumn,
              severity:
                marker.severity === monaco.MarkerSeverity.Error ? "错误" : "警告",
            });
          }
        });
      });
      monacoProblems = nextProblems;
      renderProblems();
    });

    monacoEditor.onDidChangeCursorPosition(function () {
      cursorListeners.forEach(function (listener) {
        listener();
      });
    });

    function getLanguage(mode) {
      return languageByMode[mode] || "plaintext";
    }

    function selectModel(value, mode) {
      const nextKey = getCursorKey();
      const language = getLanguage(mode);
      const activeName = getActiveFileName();
      let model = models.get(nextKey);

      if (!model) {
        model = monaco.editor.createModel(
          value || "",
          language,
          monaco.Uri.parse(
            "file:///padcode/" + nextKey.replace(":", "/") + "/" + activeName
          )
        );
        models.set(nextKey, model);
      } else if (model.getValue() !== value && typeof value === "string") {
        applyingValue = true;
        model.setValue(value);
        applyingValue = false;
      }

      if (model.getLanguageId() !== language) {
        monaco.editor.setModelLanguage(model, language);
      }

      if (currentKey && currentKey !== nextKey) {
        viewStates.set(currentKey, monacoEditor.saveViewState());
      }

      if (monacoEditor.getModel() !== model) {
        monacoEditor.setModel(model);
      }
      const savedViewState = viewStates.get(nextKey);
      if (savedViewState) {
        monacoEditor.restoreViewState(savedViewState);
      }
      currentKey = nextKey;
      pendingMode = mode;
    }

    editor = {
      setOption: function (name, value) {
        if (name === "mode") {
          pendingMode = value;
          const model = monacoEditor.getModel();
          if (model) {
            monaco.editor.setModelLanguage(model, getLanguage(value));
          }
        }
      },
      setValue: function (value) {
        selectModel(value, pendingMode || getActiveMode());
      },
      getValue: function () {
        const model = monacoEditor.getModel();
        return model ? model.getValue() : "";
      },
      getCursor: function () {
        const position = monacoEditor.getPosition();
        return position
          ? { line: position.lineNumber - 1, ch: position.column - 1 }
          : { line: 0, ch: 0 };
      },
      setCursor: function (cursor) {
        const safeCursor = cursor || { line: 0, ch: 0 };
        monacoEditor.setPosition({
          lineNumber: safeCursor.line + 1,
          column: safeCursor.ch + 1,
        });
      },
      focus: function () {
        monacoEditor.focus();
      },
      on: function (eventName, listener) {
        if (eventName === "change") {
          changeListeners.push(listener);
        } else if (eventName === "cursorActivity") {
          cursorListeners.push(listener);
        }
      },
      monaco: monaco,
      instance: monacoEditor,
      layout: function () {
        monacoEditor.layout();
      },
    };

    window.PadCodeMonaco = {
      monaco: monaco,
      editor: monacoEditor,
      models: models,
    };

    editor.on("change", handleEditorChange);
    editor.on("cursorActivity", updateCursorPosition);
    updateCursorPosition();
  }

  function initializeFallbackEditor() {
    if (!window.CodeMirror) {
      elements.editorHost.classList.add("is-hidden");
      elements.fallbackEditor.classList.add("is-visible");
      elements.fallbackEditor.value = getActiveSource();
      elements.fallbackEditor.addEventListener("input", handleFallbackInput);
      elements.fallbackEditor.addEventListener("keydown", handleFallbackKeydown);
      showToast("高级编辑器加载失败，已切换到基础编辑模式。");
      return;
    }

    editor = window.CodeMirror.fromTextArea(elements.fallbackEditor, {
      mode: getActiveMode(),
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
          runCurrent({ showPreview: true });
        },
        "Ctrl-Enter": function () {
          runCurrent({ showPreview: true });
        },
        "Cmd-S": function () {
          saveNow();
        },
        "Ctrl-S": function () {
          saveNow();
        },
      },
    });

    editor.setValue(getActiveSource());
    editor.on("change", handleEditorChange);
    editor.on("cursorActivity", updateCursorPosition);
    updateCursorPosition();
  }

  function isWebLanguage() {
    return state.activeDocumentKind === "web";
  }

  function getCustomFile(id) {
    return state.customFiles.find(function (file) {
      return file.id === id;
    });
  }

  function getFileExtension(filename) {
    const parts = String(filename || "").toLowerCase().split(".");
    return parts.length > 1 ? parts.pop() : "";
  }

  function getModeForFilename(filename) {
    const extension = getFileExtension(filename);
    const modes = {
      html: "htmlmixed",
      htm: "htmlmixed",
      css: "css",
      js: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      json: "javascript",
      py: "python",
      java: "text/x-java",
      c: "text/x-csrc",
      h: "text/x-csrc",
      cpp: "text/x-c++src",
      cc: "text/x-c++src",
      cxx: "text/x-c++src",
      hpp: "text/x-c++src",
    };
    return modes[extension] || "text/plain";
  }

  function getLanguageForFilename(filename) {
    const extension = getFileExtension(filename);
    if (extension === "py") return "python";
    if (extension === "java") return "java";
    if (["c", "h"].includes(extension)) return "c";
    if (["cpp", "cc", "cxx", "hpp"].includes(extension)) return "cpp";
    return "web";
  }

  function getActiveFileName() {
    if (state.activeDocumentKind === "custom") {
      const file = getCustomFile(state.activeCustomFileId);
      return file ? file.name : "untitled.txt";
    }
    return isWebLanguage()
      ? FILE_CONFIG[state.activeFile].name
      : LANGUAGE_CONFIG[state.activeLanguage].fileName;
  }

  function getActiveMode() {
    if (state.activeDocumentKind === "custom") {
      const file = getCustomFile(state.activeCustomFileId);
      return file ? getModeForFilename(file.name) : "text/plain";
    }
    return isWebLanguage()
      ? FILE_CONFIG[state.activeFile].mode
      : LANGUAGE_CONFIG[state.activeLanguage].mode;
  }

  function getCursorKey() {
    if (state.activeDocumentKind === "custom") {
      return "custom:" + state.activeCustomFileId;
    }
    return isWebLanguage()
      ? "web:" + state.activeFile
      : "code:" + state.activeLanguage;
  }

  function getActiveSource() {
    if (state.activeDocumentKind === "custom") {
      const file = getCustomFile(state.activeCustomFileId);
      return file ? file.content : "";
    }
    if (isWebLanguage()) {
      return state.files[state.activeFile] || "";
    }
    return state.codeProjects[state.activeLanguage].source || "";
  }

  function setActiveSource(value) {
    if (state.activeDocumentKind === "custom") {
      const file = getCustomFile(state.activeCustomFileId);
      if (file) {
        file.content = value;
      }
      return;
    }
    if (isWebLanguage()) {
      state.files[state.activeFile] = value;
      return;
    }
    state.codeProjects[state.activeLanguage].source = value;
  }

  function activateLanguage(language, options) {
    if (!LANGUAGE_CONFIG[language]) {
      return;
    }

    const settings = Object.assign({ focus: true, persist: true, run: false }, options);
    if (editor) {
      state.cursors[getCursorKey()] = editor.getCursor();
    }

    state.activeLanguage = language;
    state.activeDocumentKind = language === "web" ? "web" : "code";
    state.activeCustomFileId = null;
    const config = LANGUAGE_CONFIG[language];
    const webLanguage = isWebLanguage();
    elements.languageSelect.value = language;
    elements.appShell.classList.toggle("is-code-language", !webLanguage);
    elements.autoRunToggle.disabled = !webLanguage;
    elements.autoRunToggle.closest(".live-toggle").classList.toggle("is-disabled", !webLanguage);
    elements.autoRunLabel.textContent = webLanguage ? "实时预览" : "外部运行器";
    elements.templateButtonLabel.textContent = webLanguage ? "示例" : "重置";
    const runLabel = elements.runButton.querySelector("span");
    if (runLabel) {
      runLabel.textContent = webLanguage ? "运行" : "在线运行";
    }
    elements.assistantButton.disabled = false;
    elements.assistantButton.title = "";

    if (webLanguage) {
      switchFile(state.activeFile, settings);
    } else {
      state.activeFile = "html";
      const nextSource = state.codeProjects[language].source;
      if (editor) {
        editor.setOption("mode", config.mode);
        editor.setValue(nextSource);
        editor.setCursor(state.cursors["code:" + language] || { line: 0, ch: 0 });
      } else {
        elements.fallbackEditor.value = nextSource;
      }
      elements.activeFilename.textContent = config.fileName;
      elements.stdinInput.value = state.codeProjects[language].stdin || "";
      updateCursorPosition();
      updateAIContext();
      renderCodeIdle();
    }

    elements.activeFileActions.hidden = true;
    renderFileTabs();
    renderCustomFileTree();
    updateTreeSelection();

    if (settings.focus) {
      if (editor) {
        editor.focus();
      } else {
        elements.fallbackEditor.focus();
      }
    }

    if (settings.persist) {
      scheduleSave();
    }

    if (settings.run) {
      runCurrent({ showPreview: true });
    }
    updateTreeSelection();
  }

  function activateCustomFile(id, options) {
    const file = getCustomFile(id);
    if (!file) {
      return;
    }

    const settings = Object.assign({ focus: true, persist: true, run: false }, options);
    if (editor) {
      state.cursors[getCursorKey()] = editor.getCursor();
    }

    state.activeDocumentKind = "custom";
    state.activeCustomFileId = id;
    state.activeLanguage = getLanguageForFilename(file.name);
    const config = getCustomFileConfig(file);
    const mode = getModeForFilename(file.name);

    elements.languageSelect.value = state.activeLanguage;
    elements.appShell.classList.add("is-code-language");
    elements.autoRunToggle.disabled = true;
    elements.autoRunToggle.closest(".live-toggle").classList.add("is-disabled");
    elements.autoRunLabel.textContent = "独立文件";
    elements.templateButtonLabel.textContent = "新建";
    const runLabel = elements.runButton.querySelector("span");
    if (runLabel) {
      runLabel.textContent = config.externalSlug ? "在线运行" : "预览";
    }

    if (editor) {
      editor.setOption("mode", mode);
      editor.setValue(file.content || "");
      editor.setCursor(state.cursors["custom:" + id] || { line: 0, ch: 0 });
    } else {
      elements.fallbackEditor.value = file.content || "";
    }

    elements.activeFilename.textContent = file.name;
    elements.activeFileActions.hidden = false;
    updateCursorPosition();
    updateAIContext();
    renderFileTabs();
    renderCustomFileTree();
    updateTreeSelection();

    if (mode === "htmlmixed") {
      runPreview({ clearConsole: true });
    } else {
      preparePreviewFrame();
      elements.previewFrame.srcdoc = buildTerminalDocument(
        file.name,
        "这是一个独立文件，内容会自动保存在 iPad 浏览器中。\n\n" +
          (config.externalSlug
            ? "点击“在线运行”会复制代码并打开 OneCompiler。"
            : "点击顶部“存到文件”可以保存到 iPad 的“文件”App。"),
        "idle"
      );
      elements.previewTimestamp.textContent = "文件已保存";
    }

    if (settings.focus) {
      if (editor) editor.focus();
      else elements.fallbackEditor.focus();
    }
    if (settings.persist) {
      scheduleSave();
    }
    if (settings.run) {
      runCurrent({ showPreview: true });
    }
  }

  function getCustomFileConfig(file) {
    const extension = getFileExtension(file.name);
    const externalSlugs = {
      py: "python",
      java: "java",
      c: "c",
      h: "c",
      cpp: "cpp",
      cc: "cpp",
      cxx: "cpp",
      hpp: "cpp",
      html: "html",
      htm: "html",
      css: "css",
      js: "javascript",
      mjs: "javascript",
      cjs: "javascript",
    };
    return {
      fileName: file.name,
      label: extension ? extension.toUpperCase() : "TEXT",
      externalSlug: externalSlugs[extension] || null,
    };
  }

  function renderFileTabs() {
    if (!elements.fileTabs) {
      return;
    }
    const tabs = [];
    const contextLanguage = state.activeLanguage;

    if (contextLanguage === "web") {
      Object.keys(FILE_CONFIG).forEach(function (key) {
        const config = FILE_CONFIG[key];
        tabs.push(
          createFileTab({
            label: config.name,
            dataset: { file: key },
            active:
              state.activeDocumentKind === "web" && state.activeFile === key,
            dotClass: "file-dot-" + key,
          })
        );
      });
    } else if (LANGUAGE_CONFIG[contextLanguage]) {
      const config = LANGUAGE_CONFIG[contextLanguage];
      tabs.push(
        createFileTab({
          label: config.fileName,
          dataset: { codeLanguage: contextLanguage },
          active:
            state.activeDocumentKind === "code" &&
            state.activeLanguage === contextLanguage,
          dotClass: "file-dot-custom",
        })
      );
    }

    state.customFiles.forEach(function (file) {
      tabs.push(
        createFileTab({
          label: file.name,
          dataset: { customId: file.id },
          active:
            state.activeDocumentKind === "custom" &&
            state.activeCustomFileId === file.id,
          dotClass: "file-dot-custom",
        })
      );
    });

    elements.fileTabs.replaceChildren.apply(elements.fileTabs, tabs);
    const activeTab = elements.fileTabs.querySelector(".file-tab.is-active");
    if (activeTab) {
      activeTab.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }

  function createFileTab(options) {
    const button = document.createElement("button");
    const dot = document.createElement("span");
    const label = document.createElement("span");
    button.type = "button";
    button.className = "file-tab" + (options.active ? " is-active" : "");
    button.setAttribute("role", "tab");
    button.setAttribute("aria-selected", String(options.active));
    if (options.dataset.file) button.dataset.file = options.dataset.file;
    if (options.dataset.codeLanguage) {
      button.dataset.codeLanguage = options.dataset.codeLanguage;
    }
    if (options.dataset.customId) button.dataset.customId = options.dataset.customId;
    dot.className = "file-dot " + options.dotClass;
    dot.setAttribute("aria-hidden", "true");
    label.textContent = options.label;
    button.append(dot, label);
    return button;
  }

  function renderCustomFileTree() {
    if (!elements.customFileTree) {
      return;
    }
    elements.customFileTree.replaceChildren();
    elements.customFileCount.textContent = String(state.customFiles.length);

    state.customFiles.forEach(function (file) {
      const row = document.createElement("div");
      const openButton = document.createElement("button");
      const icon = document.createElement("span");
      const name = document.createElement("span");
      const rename = document.createElement("button");
      const remove = document.createElement("button");
      const filename = file.name.split("/").pop();
      const extension = getFileExtension(file.name);
      row.className = "tree-custom-row";
      openButton.type = "button";
      openButton.className = "tree-file";
      openButton.dataset.customFile = file.id;
      openButton.classList.toggle(
        "is-active",
        state.activeDocumentKind === "custom" && state.activeCustomFileId === file.id
      );
      icon.className = "file-icon";
      icon.textContent = (extension || "TXT").slice(0, 3).toUpperCase();
      name.textContent = filename;
      name.title = file.name;
      openButton.append(icon, name);
      rename.type = "button";
      rename.className = "tree-file-action";
      rename.dataset.renameFile = file.id;
      rename.title = "重命名";
      rename.setAttribute("aria-label", "重命名 " + filename);
      rename.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m4 20 4.5-1 10-10-3.5-3.5-10 10L4 20Z"/><path d="m13.5 7 3.5 3.5"/></svg>';
      remove.type = "button";
      remove.className = "tree-file-action is-danger";
      remove.dataset.deleteFile = file.id;
      remove.title = "删除";
      remove.setAttribute("aria-label", "删除 " + filename);
      remove.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>';
      row.append(openButton, rename, remove);
      elements.customFileTree.append(row);
    });
  }

  function handleCustomFileTreeClick(event) {
    if (event.target.closest("[data-new-file]")) {
      openFileDialog();
      return;
    }
    const remove = event.target.closest("[data-delete-file]");
    if (remove) {
      deleteCustomFile(remove.dataset.deleteFile);
      return;
    }
    const rename = event.target.closest("[data-rename-file]");
    if (rename) {
      renameCustomFile(rename.dataset.renameFile);
      return;
    }
    const open = event.target.closest("[data-custom-file]");
    if (open) {
      activateCustomFile(open.dataset.customFile);
      closeWorkbench();
    }
  }

  function openFileDialog() {
    elements.fileDialogError.textContent = "";
    elements.newFileNameInput.value = nextUntitledName();
    if (typeof elements.fileDialog.showModal === "function") {
      elements.fileDialog.showModal();
    } else {
      elements.fileDialog.setAttribute("open", "");
    }
    window.setTimeout(function () {
      elements.newFileNameInput.focus();
      elements.newFileNameInput.select();
    }, 40);
  }

  function handleNewFileSubmit(event) {
    const submitter = event.submitter;
    if (submitter && submitter.value === "cancel") {
      return;
    }
    event.preventDefault();
    const name = normalizeNewFileName(elements.newFileNameInput.value);
    const validation = validateNewFileName(name);
    if (validation) {
      elements.fileDialogError.textContent = validation;
      elements.newFileNameInput.focus();
      return;
    }

    const file = {
      id: createFileId(),
      name: name,
      content: starterContentForFile(name),
    };
    state.customFiles.push(file);
    elements.fileDialog.close();
    saveNow();
    activateCustomFile(file.id);
    showToast(name + " 已创建。");
  }

  function nextUntitledName() {
    let index = 1;
    let name = "untitled.txt";
    while (fileNameExists(name)) {
      index += 1;
      name = "untitled-" + index + ".txt";
    }
    return name;
  }

  function normalizeNewFileName(value) {
    return String(value || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/^\/+/, "")
      .replace(/\/{2,}/g, "/");
  }

  function validateNewFileName(name, ignoredId) {
    if (!name) return "请输入文件名。";
    if (name.length > 120) return "文件名不能超过 120 个字符。";
    if (
      name.split("/").some(function (part) {
        return part === "." || part === "..";
      })
    ) {
      return "文件名不能包含 . 或 .. 路径。";
    }
    if (/[<>:"|?*]/.test(name)) return "文件名包含不支持的字符。";
    if (fileNameExists(name, ignoredId)) return "已经有同名文件。";
    return "";
  }

  function fileNameExists(name, ignoredId) {
    const normalized = name.toLowerCase();
    const fixedNames = Object.keys(FILE_CONFIG)
      .map(function (key) {
        return FILE_CONFIG[key].name.toLowerCase();
      })
      .concat(
        Object.keys(LANGUAGE_CONFIG)
          .filter(function (key) {
            return key !== "web";
          })
          .map(function (key) {
            return LANGUAGE_CONFIG[key].fileName.toLowerCase();
          })
      );
    return (
      fixedNames.includes(normalized) ||
      state.customFiles.some(function (file) {
        return file.id !== ignoredId && file.name.toLowerCase() === normalized;
      })
    );
  }

  function createFileId() {
    return (
      "file-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8)
    );
  }

  function starterContentForFile(name) {
    const extension = getFileExtension(name);
    if (extension === "html" || extension === "htm") {
      return '<!doctype html>\n<html lang="zh-CN">\n  <head>\n    <meta charset="UTF-8" />\n    <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n    <title>新页面</title>\n  </head>\n  <body>\n    <h1>Hello, PadCode!</h1>\n  </body>\n</html>\n';
    }
    if (extension === "py") return "# " + name + "\n";
    if (["js", "mjs", "cjs"].includes(extension)) return "// " + name + "\n";
    if (extension === "css") return "/* " + name + " */\n";
    if (extension === "md") return "# " + name.replace(/\.md$/i, "") + "\n";
    return "";
  }

  function renameActiveCustomFile() {
    if (state.activeDocumentKind === "custom") {
      renameCustomFile(state.activeCustomFileId);
    }
  }

  function renameCustomFile(id) {
    const file = getCustomFile(id);
    if (!file) return;
    const nextName = window.prompt("新的文件名", file.name);
    if (nextName === null) return;
    const normalized = normalizeNewFileName(nextName);
    const validation = validateNewFileName(normalized, id);
    if (validation) {
      showToast(validation);
      return;
    }
    const previous = file.name;
    file.name = normalized;
    saveNow();
    if (state.activeCustomFileId === id) {
      activateCustomFile(id, { focus: true, persist: false, run: false });
    } else {
      renderCustomFileTree();
      renderFileTabs();
    }
    showToast(previous + " 已重命名为 " + normalized + "。");
  }

  function deleteActiveCustomFile() {
    if (state.activeDocumentKind === "custom") {
      deleteCustomFile(state.activeCustomFileId);
    }
  }

  function deleteCustomFile(id) {
    const file = getCustomFile(id);
    if (!file) return;
    if (!window.confirm("删除文件“" + file.name + "”？此操作无法撤销。")) return;
    state.customFiles = state.customFiles.filter(function (item) {
      return item.id !== id;
    });
    if (state.activeDocumentKind === "custom" && state.activeCustomFileId === id) {
      state.activeCustomFileId = null;
      activateLanguage("web");
    } else {
      renderCustomFileTree();
      renderFileTabs();
    }
    saveNow();
    showToast(file.name + " 已删除。");
  }

  function switchFile(key, options) {
    if (!FILE_CONFIG[key] || !isWebLanguage()) {
      return;
    }

    const settings = Object.assign({ focus: true, preservePreview: false }, options);

    if (editor) {
      state.cursors[getCursorKey()] = editor.getCursor();
    }

    state.activeFile = key;
    const nextCode = state.files[key];

    if (editor) {
      editor.setOption("mode", FILE_CONFIG[key].mode);
      editor.setValue(nextCode);
      const cursor = state.cursors["web:" + key];
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

    elements.activeFilename.textContent = FILE_CONFIG[key].name;
    elements.activeFileActions.hidden = true;
    renderFileTabs();
    updateCursorPosition();
    updateAIContext();

    if (settings.focus && editor) {
      editor.focus();
    }

    if (!settings.preservePreview) {
      schedulePreview();
    }
    updateTreeSelection();
  }

  function handleEditorChange() {
    setActiveSource(editor.getValue());
    scheduleSave();

    if ((isWebLanguage() || getActiveMode() === "htmlmixed") && state.autoRun) {
      schedulePreview();
    } else {
      elements.previewTimestamp.textContent = isWebLanguage() ? "有更改，尚未运行" : "已保存 · 点击运行";
    }
  }

  function handleFallbackInput() {
    setActiveSource(elements.fallbackEditor.value);
    scheduleSave();
    updateFallbackCursor();
    if ((isWebLanguage() || getActiveMode() === "htmlmixed") && state.autoRun) {
      schedulePreview();
    } else {
      elements.previewTimestamp.textContent = isWebLanguage() ? "有更改，尚未运行" : "已保存 · 点击运行";
    }
  }

  function handleFallbackKeydown(event) {
    const commandKey = event.metaKey || event.ctrlKey;
    if (commandKey && event.key === "Enter") {
      event.preventDefault();
      runCurrent({ showPreview: true });
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
          version: 2,
          files: state.files,
          codeProjects: state.codeProjects,
          customFiles: state.customFiles,
          activeLanguage: state.activeLanguage,
          activeFile: state.activeFile,
          activeDocumentKind: state.activeDocumentKind,
          activeCustomFileId: state.activeCustomFileId,
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
    if (!isWebLanguage() && getActiveMode() !== "htmlmixed") {
      return;
    }
    previewTimer = window.setTimeout(function () {
      if (state.autoRun) {
        runPreview({ clearConsole: true });
      }
    }, 520);
  }

  function runPreview(options) {
    const settings = Object.assign({ clearConsole: true }, options);
    window.clearTimeout(previewTimer);
    preparePreviewFrame();

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

  function preparePreviewFrame() {
    window.clearTimeout(embeddedRunnerTimer);
    window.clearTimeout(embeddedRunnerRetryTimer);
    embeddedRunnerReady = false;
    embeddedRunnerCompleted = false;
    delete elements.previewFrame.dataset.oneCompilerUrl;
    elements.previewFrame.removeAttribute("src");
    elements.previewFrame.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-modals allow-popups"
    );
  }

  function runCurrent(options) {
    if (state.previewCollapsed) {
      setPreviewCollapsed(false);
    }
    if (isWebLanguage() || getActiveMode() === "htmlmixed") {
      runPreview({ clearConsole: true });
      return;
    }
    openExternalRunner();
  }

  function openExternalRunner() {
    const language = state.activeLanguage;
    const customFile = getCustomFile(state.activeCustomFileId);
    const config = customFile
      ? getCustomFileConfig(customFile)
      : LANGUAGE_CONFIG[language];
    const source = customFile
      ? customFile.content
      : state.codeProjects[language].source;
    const stdin = customFile ? "" : state.codeProjects[language].stdin || "";
    const slug = customFile
      ? config.externalSlug
      : { python: "python", java: "java", c: "c", cpp: "cpp" }[language];
    if (!slug) {
      showToast("这个文件类型没有在线运行器，可以使用“存到文件”保存。");
      return;
    }

    const query = new URLSearchParams({
      listenToEvents: "true",
      codeChangeEvent: "true",
      hideLanguageSelection: "true",
      hideNew: "true",
      hideNewFileOption: "true",
      hideTitle: "true",
      hideEditorOptions: "true",
      theme: "dark",
      fontSize: "13",
    });
    const url = "https://onecompiler.com/embed/" + slug + "?" + query.toString();
    const payload = {
      eventType: "populateCode",
      language: slug,
      files: [{ name: config.fileName, content: source }],
      stdin: stdin,
    };
    const sameRunner =
      embeddedRunnerReady && elements.previewFrame.dataset.oneCompilerUrl === url;

    setView("preview");
    clearConsole();
    embeddedRunnerCompleted = false;
    setConsoleExpanded(true);
    elements.previewTimestamp.textContent = "正在准备站内运行…";
    appendConsoleEntry(
      "info",
      config.label + " · " + config.fileName + " · 正在发送到站内运行器"
    );

    if (sameRunner) {
      startEmbeddedRunner(payload, 120);
      return;
    }

    embeddedRunnerReady = false;
    elements.previewFrame.dataset.oneCompilerUrl = url;
    elements.previewFrame.dataset.pendingRunnerPayload = JSON.stringify(payload);
    elements.previewFrame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
    );
    elements.previewFrame.removeAttribute("srcdoc");
    elements.previewFrame.src = url;
  }

  function handleEmbeddedRunnerLoad() {
    const expectedUrl = elements.previewFrame.dataset.oneCompilerUrl;
    if (!expectedUrl) {
      return;
    }
    embeddedRunnerReady = true;
    let payload = null;
    try {
      payload = JSON.parse(elements.previewFrame.dataset.pendingRunnerPayload || "null");
    } catch (_error) {
      payload = null;
    }
    if (!payload) {
      return;
    }
    startEmbeddedRunner(payload, 1200);
  }

  function startEmbeddedRunner(payload, delay) {
    window.clearTimeout(embeddedRunnerTimer);
    window.clearTimeout(embeddedRunnerRetryTimer);
    embeddedRunnerTimer = window.setTimeout(function () {
      sendToEmbeddedRunner(payload);
      embeddedRunnerTimer = window.setTimeout(function () {
        sendToEmbeddedRunner({ eventType: "triggerRun" });
      }, 500);
      embeddedRunnerRetryTimer = window.setTimeout(function () {
        if (embeddedRunnerCompleted || !embeddedRunnerReady) {
          return;
        }
        sendToEmbeddedRunner(payload);
        embeddedRunnerTimer = window.setTimeout(function () {
          sendToEmbeddedRunner({ eventType: "triggerRun" });
        }, 600);
      }, 3500);
    }, delay);
  }

  function sendToEmbeddedRunner(payload) {
    if (!elements.previewFrame.contentWindow) {
      return;
    }
    elements.previewFrame.contentWindow.postMessage(payload, "https://onecompiler.com");
  }

  function receiveEmbeddedRunnerMessage(event) {
    if (event.origin !== "https://onecompiler.com") {
      return;
    }
    if (event.source !== elements.previewFrame.contentWindow) {
      return;
    }
    const data = event.data;
    if (!data || data.action !== "runComplete") {
      return;
    }
    embeddedRunnerCompleted = true;
    window.clearTimeout(embeddedRunnerRetryTimer);
    const result = data.result || {};
    const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
    elements.previewTimestamp.textContent =
      "运行完成" +
      (typeof result.executionTime === "number"
        ? " · " + Math.round(result.executionTime) + " ms"
        : "");
    appendConsoleEntry(
      result.stderr ? "error" : "info",
      output || "程序运行完成，没有额外输出。"
    );
  }

  async function executeProgram() {
    if (pistonBusy || isWebLanguage()) {
      return;
    }

    const language = state.activeLanguage;
    const config = LANGUAGE_CONFIG[language];
    const project = state.codeProjects[language];
    pistonBusy = true;
    setRunButtonBusy(true);
    clearConsole();
    elements.previewTimestamp.textContent = "正在编译并运行…";
    elements.previewFrame.srcdoc = buildTerminalDocument(
      "正在运行 " + config.label,
      "代码正在发送到云端编译运行，请稍候…",
      "loading"
    );
    setConsoleExpanded(true);

    const startedAt = performance.now();
    try {
      const runtime = await getPistonRuntime(config.pistonLanguage);
      const response = await fetch(PISTON_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          language: runtime.language,
          version: runtime.version,
          files: [{ name: config.fileName, content: project.source }],
          stdin: project.stdin || "",
          compile_timeout: 15000,
          run_timeout: 5000,
        }),
      });

      if (!response.ok) {
        throw new Error("运行服务返回 HTTP " + response.status);
      }

      const result = await response.json();
      const compile = result.compile || null;
      const run = result.run || {};
      const compileOutput = compile && compile.output ? String(compile.output).trim() : "";
      const runOutput = run.output ? String(run.output).trim() : "";
      const outputParts = [];
      if (compileOutput) {
        outputParts.push("[编译]\n" + compileOutput);
      }
      if (runOutput) {
        outputParts.push("[运行]\n" + runOutput);
      }
      const outputText = outputParts.join("\n\n") || "程序运行完成，没有输出。";
      const success =
        (!compile || compile.code === 0) &&
        (typeof run.code !== "number" || run.code === 0);
      const elapsed = Math.round(performance.now() - startedAt);

      elements.previewFrame.srcdoc = buildTerminalDocument(
        config.label + " · " + (success ? "运行完成" : "运行结束"),
        outputText,
        success ? "success" : "error"
      );
      elements.previewTimestamp.textContent =
        (success ? "完成" : "退出码 " + run.code) + " · " + elapsed + " ms";
      appendConsoleEntry(
        success ? "info" : "error",
        config.label +
          " " +
          runtime.version +
          " · " +
          (success ? "运行完成" : "运行失败") +
          " · " +
          elapsed +
          " ms"
      );
    } catch (error) {
      const message =
        error && error.name === "AbortError"
          ? "运行服务响应超时，请稍后重试。"
          : error && error.message
            ? error.message
            : "无法连接代码运行服务。";
      elements.previewFrame.srcdoc = buildTerminalDocument(
        "运行失败",
        "无法执行这段代码。\n\n" +
          message +
          "\n\n请检查网络连接。该功能需要访问 emkc.org 免费公共服务。",
        "error"
      );
      elements.previewTimestamp.textContent = "连接失败";
      appendConsoleEntry("error", message);
      showToast("代码运行失败，请检查网络后重试。");
    } finally {
      pistonBusy = false;
      setRunButtonBusy(false);
    }
  }

  function getPistonRuntime(language) {
    if (!getPistonRuntime.cache) {
      const controller = new AbortController();
      const timeout = window.setTimeout(function () {
        controller.abort();
      }, 12000);

      getPistonRuntime.cache = fetch(PISTON_RUNTIMES_ENDPOINT, {
        signal: controller.signal,
      })
        .then(function (response) {
          if (!response.ok) {
            throw new Error("无法获取语言运行时，HTTP " + response.status);
          }
          return response.json();
        })
        .catch(function (error) {
          getPistonRuntime.cache = null;
          throw error;
        })
        .finally(function () {
          window.clearTimeout(timeout);
        });
    }

    return getPistonRuntime.cache.then(function (runtimes) {
      const runtime = runtimes.find(function (item) {
        return item.language === language;
      });
      if (!runtime) {
        throw new Error("免费运行服务暂不支持 " + language);
      }
      return runtime;
    });
  }

  function renderCodeIdle() {
    if (isWebLanguage()) {
      return;
    }
    preparePreviewFrame();
    const config = LANGUAGE_CONFIG[state.activeLanguage];
    elements.previewFrame.srcdoc = buildTerminalDocument(
      config.label + " 工作台",
      "左侧编写代码，点击右上角“运行”或按 ⌘ Enter 执行。\n\n" +
        "代码会先复制到剪贴板，再在 OneCompiler 免费运行器中打开。\n\n" +
        "PadCode 会自动保存代码，你也可以随时保存到 iPad 的“文件”App。",
      "idle"
    );
    elements.previewTimestamp.textContent = "等待运行";
  }

  function buildTerminalDocument(title, output, stateName) {
    const accent =
      stateName === "error" ? "#ff8b72" : stateName === "success" ? "#7ed6a4" : "#ffbc7a";
    return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    * { box-sizing: border-box; }
    html, body { min-height: 100%; margin: 0; background: #0d1117; color: #dce5ef; }
    body {
      display: flex;
      min-height: 100vh;
      flex-direction: column;
      padding: clamp(22px, 5vw, 54px);
      font-family: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
    }
    header {
      display: flex;
      align-items: center;
      gap: 9px;
      margin-bottom: 26px;
      color: #8795a8;
      font-size: 10px;
      letter-spacing: 0.05em;
    }
    header::before {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background: ${accent};
      box-shadow: 0 0 0 5px color-mix(in srgb, ${accent} 12%, transparent);
      content: "";
    }
    pre {
      flex: 1;
      margin: 0;
      overflow: auto;
      color: ${stateName === "error" ? "#ffd4ca" : "#dce5ef"};
      font: inherit;
      font-size: clamp(12px, 2.2vw, 14px);
      line-height: 1.75;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      tab-size: 2;
    }
    .state {
      margin-top: 24px;
      padding-top: 15px;
      border-top: 1px solid #202834;
      color: #586678;
      font-size: 9px;
    }
  </style>
</head>
<body>
  <header>${escapeHtml(title)}</header>
  <pre>${escapeHtml(output)}</pre>
  <div class="state">PadCode · ${stateName === "loading" ? "正在连接" : "免费云端运行服务"}</div>
</body>
</html>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function setRunButtonBusy(busy) {
    elements.runButton.disabled = busy;
    const label = elements.runButton.querySelector("span");
    if (label) {
      label.textContent = busy ? "运行中…" : "运行";
    }
  }

  function buildPreviewDocument(includeConsoleBridge) {
    const customFile = getCustomFile(state.activeCustomFileId);
    let documentSource =
      state.activeDocumentKind === "custom" &&
      customFile &&
      getFileExtension(customFile.name) === "html"
        ? customFile.content
        : state.files.html || "<!doctype html><html><head></head><body></body></html>";
    documentSource = inlineCustomHtmlAssets(documentSource);
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

  function inlineCustomHtmlAssets(source) {
    let result = String(source || "");
    result = result.replace(
      /<link\b([^>]*?)\bhref=["']([^"']+)["']([^>]*)>/gi,
      function (tag, before, href, after) {
        if (!/\brel=["']?stylesheet/i.test(before + " " + after)) {
          return tag;
        }
        const asset = findCustomAsset(href);
        return asset
          ? "<style>" + asset.content.replace(/<\/style/gi, "<\\/style") + "</style>"
          : tag;
      }
    );
    result = result.replace(
      /<script\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi,
      function (tag, _before, src) {
        const asset = findCustomAsset(src);
        return asset
          ? "<script>" + asset.content.replace(/<\/script/gi, "<\\/script") + "</script>"
          : tag;
      }
    );
    return result;
  }

  function findCustomAsset(path) {
    const normalized = String(path || "")
      .replace(/^\.\//, "")
      .toLowerCase();
    return state.customFiles.find(function (file) {
      return file.name.toLowerCase() === normalized;
    });
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
    updateAIContext();
    renderProblems();
  }

  function clearConsole() {
    consoleLogs.length = 0;
    renderConsole();
    updateAIContext();
    renderProblems();
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
    if (safeView === "preview" && state.previewCollapsed) {
      setPreviewCollapsed(false, { persist: true, keepView: true });
    }
    elements.workspace.dataset.view = safeView;
    document.querySelectorAll(".view-switch button").forEach(function (button) {
      const active = button.dataset.view === safeView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function setPreviewCollapsed(collapsed, options) {
    const settings = Object.assign({ persist: true, keepView: false }, options);
    state.previewCollapsed = Boolean(collapsed);
    elements.workspace.classList.toggle("is-preview-collapsed", state.previewCollapsed);
    elements.showPreviewButton.hidden = !state.previewCollapsed;
    elements.collapsePreviewButton.setAttribute(
      "aria-pressed",
      String(state.previewCollapsed)
    );
    if (
      state.previewCollapsed &&
      !settings.keepView &&
      window.matchMedia("(max-width: 900px)").matches
    ) {
      setView("code");
    }
    if (settings.persist) {
      try {
        localStorage.setItem(
          PREVIEW_COLLAPSE_STORAGE_KEY,
          state.previewCollapsed ? "1" : "0"
        );
      } catch (_error) {
        // The visual state still applies for this session.
      }
    }
  }

  function toggleWorkbenchPanel(panel) {
    const isCurrent =
      activeWorkbenchPanel === panel && elements.workbenchDrawer.classList.contains("is-open");
    if (isCurrent) {
      closeWorkbench();
      return;
    }
    openWorkbenchPanel(panel);
  }

  function openWorkbenchPanel(panel) {
    const titles = {
      explorer: "资源管理器",
      search: "全局搜索",
      source: "本地检查点",
      problems: "问题",
      extensions: "扩展与功能",
    };
    const safePanel = titles[panel] ? panel : "explorer";
    activeWorkbenchPanel = safePanel;
    elements.workbenchPanelTitle.textContent = titles[safePanel];

    document.querySelectorAll("[data-workbench-panel]").forEach(function (button) {
      const active = button.dataset.workbenchPanel === safePanel;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    document.querySelectorAll(".workbench-panel").forEach(function (section) {
      section.classList.toggle("is-active", section.dataset.panel === safePanel);
    });

    closeAssistant();
    elements.workbenchDrawer.classList.add("is-open");
    elements.workbenchDrawer.setAttribute("aria-hidden", "false");
    elements.workbenchScrim.hidden = false;

    if (safePanel === "source") {
      updateCheckpointInfo();
    } else if (safePanel === "problems") {
      renderProblems();
    } else if (safePanel === "search") {
      window.setTimeout(function () {
        elements.workbenchSearchInput.focus();
      }, 80);
    }
    updateTreeSelection();
  }

  function closeWorkbench() {
    elements.workbenchDrawer.classList.remove("is-open");
    elements.workbenchDrawer.setAttribute("aria-hidden", "true");
    elements.workbenchScrim.hidden = true;
    document.querySelectorAll("[data-workbench-panel]").forEach(function (button) {
      button.classList.remove("is-active");
      button.setAttribute("aria-pressed", "false");
    });
  }

  function updateTreeSelection() {
    document.querySelectorAll("[data-web-file], [data-code-language]").forEach(function (button) {
      let active = false;
      if (isWebLanguage() && button.dataset.webFile) {
        active = button.dataset.webFile === state.activeFile;
      } else if (!isWebLanguage() && button.dataset.codeLanguage) {
        active = button.dataset.codeLanguage === state.activeLanguage;
      }
      button.classList.toggle("is-active", active);
    });

    elements.openEditorLabel.textContent = getActiveFileName();
    renderCustomFileTree();
  }

  function getSearchEntries() {
    const entries = Object.keys(FILE_CONFIG).map(function (key) {
      return {
        kind: "web",
        key: key,
        filename: FILE_CONFIG[key].name,
        content: state.files[key] || "",
      };
    });

    Object.keys(LANGUAGE_CONFIG)
      .filter(function (language) {
        return language !== "web";
      })
      .forEach(function (language) {
        entries.push({
          kind: "code",
          key: language,
          filename: LANGUAGE_CONFIG[language].fileName,
          content: state.codeProjects[language].source || "",
        });
      });
    state.customFiles.forEach(function (file) {
      entries.push({
        kind: "custom",
        key: file.id,
        filename: file.name,
        content: file.content || "",
      });
    });
    return entries;
  }

  function renderWorkbenchSearch() {
    const query = elements.workbenchSearchInput.value.trim();
    elements.workbenchSearchResults.replaceChildren();
    if (!query) {
      const hint = document.createElement("p");
      hint.className = "drawer-help";
      hint.textContent = "输入关键词后搜索全部文件。";
      elements.workbenchSearchResults.append(hint);
      return;
    }

    const lowerQuery = query.toLowerCase();
    let resultCount = 0;
    getSearchEntries().forEach(function (entry) {
      entry.content.split(/\r?\n/).forEach(function (line, lineIndex) {
        if (resultCount >= 100 || line.toLowerCase().indexOf(lowerQuery) === -1) {
          return;
        }
        const button = document.createElement("button");
        const title = document.createElement("strong");
        const detail = document.createElement("small");
        const column = line.toLowerCase().indexOf(lowerQuery);
        button.type = "button";
        button.className = "search-result";
        button.dataset.searchKind = entry.kind;
        button.dataset.searchKey = entry.key;
        button.dataset.searchLine = String(lineIndex);
        button.dataset.searchColumn = String(column);
        title.textContent = entry.filename + ":" + (lineIndex + 1);
        detail.textContent = line.trim().slice(0, 110) || "（空行）";
        button.append(title, detail);
        elements.workbenchSearchResults.append(button);
        resultCount += 1;
      });
    });

    if (resultCount === 0) {
      const empty = document.createElement("p");
      empty.className = "drawer-help";
      empty.textContent = "没有找到匹配内容。";
      elements.workbenchSearchResults.append(empty);
    }
  }

  function openSearchResult(event) {
    const button = event.target.closest("[data-search-kind]");
    if (!button) {
      return;
    }
    const line = Number(button.dataset.searchLine) || 0;
    const column = Number(button.dataset.searchColumn) || 0;

    if (button.dataset.searchKind === "web") {
      activateLanguage("web");
      switchFile(button.dataset.searchKey, { focus: false, preservePreview: true });
    } else if (button.dataset.searchKind === "custom") {
      activateCustomFile(button.dataset.searchKey, { focus: false });
    } else {
      activateLanguage(button.dataset.searchKey, { focus: false });
    }
    if (editor) {
      editor.setCursor({ line: line, ch: column });
      editor.focus();
    }
    updateTreeSelection();
    closeWorkbench();
  }

  function createWorkspaceSnapshot() {
    return {
      version: 2,
      savedAt: new Date().toISOString(),
      files: Object.assign({}, state.files),
      codeProjects: JSON.parse(JSON.stringify(state.codeProjects)),
      customFiles: JSON.parse(JSON.stringify(state.customFiles)),
    };
  }

  function readCheckpoint() {
    try {
      const raw = localStorage.getItem(CHECKPOINT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed && parsed.files && parsed.codeProjects ? parsed : null;
    } catch (_error) {
      return null;
    }
  }

  function updateCheckpointInfo() {
    const checkpoint = readCheckpoint();
    if (!checkpoint) {
      elements.checkpointInfo.textContent = "尚未创建检查点";
      return;
    }
    elements.checkpointInfo.textContent =
      "上次检查点：" +
      new Date(checkpoint.savedAt).toLocaleString("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      });
  }

  function createCheckpoint() {
    try {
      localStorage.setItem(CHECKPOINT_STORAGE_KEY, JSON.stringify(createWorkspaceSnapshot()));
      updateCheckpointInfo();
      elements.workbenchChanges.replaceChildren();
      showToast("已创建本地检查点。");
    } catch (_error) {
      showToast("无法创建检查点，请检查浏览器存储空间。");
    }
  }

  function getCheckpointChanges() {
    const checkpoint = readCheckpoint();
    if (!checkpoint) {
      return [];
    }

    const current = createWorkspaceSnapshot();
    const changes = [];
    Object.keys(FILE_CONFIG).forEach(function (key) {
      if ((checkpoint.files[key] || "") !== (current.files[key] || "")) {
        changes.push({ kind: "web", key: key, filename: FILE_CONFIG[key].name });
      }
    });
    Object.keys(LANGUAGE_CONFIG).forEach(function (language) {
      if (language === "web") {
        return;
      }
      const before = checkpoint.codeProjects[language] || {};
      const after = current.codeProjects[language] || {};
      if ((before.source || "") !== (after.source || "")) {
        changes.push({
          kind: "code",
          key: language,
          filename: LANGUAGE_CONFIG[language].fileName,
        });
      }
    });
    return changes;
  }

  function compareCheckpoint() {
    const changes = getCheckpointChanges();
    elements.workbenchChanges.replaceChildren();
    if (!readCheckpoint()) {
      const empty = document.createElement("p");
      empty.className = "drawer-help";
      empty.textContent = "请先创建一个检查点。";
      elements.workbenchChanges.append(empty);
      return;
    }
    if (changes.length === 0) {
      const empty = document.createElement("p");
      empty.className = "drawer-help";
      empty.textContent = "当前内容与检查点一致。";
      elements.workbenchChanges.append(empty);
      return;
    }

    changes.forEach(function (change) {
      const button = document.createElement("button");
      const title = document.createElement("strong");
      const detail = document.createElement("small");
      button.type = "button";
      button.className = "change-row";
      button.dataset.changeKind = change.kind;
      button.dataset.changeKey = change.key;
      title.textContent = "M  " + change.filename;
      detail.textContent = "已修改";
      button.append(title, detail);
      elements.workbenchChanges.append(button);
    });
  }

  function openCheckpointChange(event) {
    const button = event.target.closest("[data-change-kind]");
    if (!button) {
      return;
    }
    if (button.dataset.changeKind === "web") {
      activateLanguage("web");
      switchFile(button.dataset.changeKey);
    } else {
      activateLanguage(button.dataset.changeKey);
    }
    closeWorkbench();
  }

  function restoreCheckpoint() {
    const checkpoint = readCheckpoint();
    if (!checkpoint) {
      showToast("请先创建一个检查点。");
      return;
    }
    if (!window.confirm("恢复检查点会覆盖当前网页文件和全部代码草稿。是否继续？")) {
      return;
    }
    state.files = {
      html: checkpoint.files.html || "",
      css: checkpoint.files.css || "",
      js: checkpoint.files.js || "",
    };
    state.codeProjects = normalizeCodeProjects(checkpoint.codeProjects);
    state.customFiles = normalizeCustomFiles(checkpoint.customFiles);
    state.activeLanguage = "web";
    state.activeFile = "html";
    state.activeDocumentKind = "web";
    state.activeCustomFileId = null;
    saveNow();
    activateLanguage("web");
    switchFile("html");
    runPreview({ clearConsole: true });
    elements.workbenchChanges.replaceChildren();
    updateTreeSelection();
    showToast("检查点已恢复。");
  }

  function renderProblems() {
    if (!elements.workbenchProblems) {
      return;
    }
    elements.workbenchProblems.replaceChildren();
    const consoleErrors = consoleLogs
      .filter(function (entry) {
        return entry.type === "error";
      })
      .map(function (entry) {
        return {
          message: entry.text,
          filename: getActiveFileName(),
          line: 0,
          column: 0,
          severity: "预运行错误",
          kind: "console",
        };
      });
    const allProblems = monacoProblems.concat(consoleErrors);
    elements.problemsSummary.textContent =
      allProblems.length === 0
        ? "当前没有已知问题"
        : allProblems.length + " 个问题需要检查";

    allProblems.forEach(function (problem) {
      const button = document.createElement("button");
      const title = document.createElement("strong");
      const detail = document.createElement("small");
      button.type = "button";
      button.className = "problem-row";
      button.dataset.problemKind = problem.kind || "marker";
      button.dataset.problemTargetKind = problem.targetKind || "";
      button.dataset.problemKey = problem.key || "";
      button.dataset.problemLine = String(problem.line || 0);
      button.dataset.problemColumn = String(problem.column || 0);
      title.textContent = problem.message;
      detail.textContent =
        problem.filename +
        (problem.line ? ":" + problem.line + ":" + problem.column : "") +
        " · " +
        problem.severity;
      button.append(title, detail);
      elements.workbenchProblems.append(button);
    });
  }

  function openProblem(event) {
    const button = event.target.closest("[data-problem-kind]");
    if (!button) {
      return;
    }
    if (button.dataset.problemKind === "marker" && button.dataset.problemKey) {
      if (button.dataset.problemTargetKind === "web") {
        activateLanguage("web");
        switchFile(button.dataset.problemKey, {
          focus: false,
          preservePreview: true,
        });
      } else {
        activateLanguage(button.dataset.problemKey, { focus: false });
      }
      if (editor) {
        editor.setCursor({
          line: Math.max(0, Number(button.dataset.problemLine) - 1),
          ch: Math.max(0, Number(button.dataset.problemColumn) - 1),
        });
        editor.focus();
      }
    } else {
      setConsoleExpanded(true);
      setView("preview");
    }
    closeWorkbench();
  }

  function getWorkbenchCommands() {
    return [
      {
        id: "save",
        label: "文件: 保存",
        detail: "保存当前工作区",
        shortcut: "⌘ S",
        run: saveNow,
      },
      {
        id: "run",
        label: "运行: 当前项目",
        detail: "运行网页或代码草稿",
        shortcut: "⌘ ↵",
        run: function () {
          runCurrent({ showPreview: true });
        },
      },
      {
        id: "ai",
        label: "AI: 打开编码助手",
        detail: "读取项目上下文并修改代码",
        shortcut: "⌘ I",
        run: openAssistant,
      },
      {
        id: "explorer",
        label: "视图: 资源管理器",
        detail: "浏览工作区文件",
        shortcut: "⌘ B",
        run: function () {
          openWorkbenchPanel("explorer");
        },
      },
      {
        id: "search",
        label: "查找: 在文件中搜索",
        detail: "搜索网页和代码草稿",
        shortcut: "⇧⌘F",
        run: function () {
          openWorkbenchPanel("search");
        },
      },
      {
        id: "format",
        label: "编辑: 格式化文档",
        detail: "使用 Monaco 的格式化能力",
        shortcut: "⇧⌥F",
        run: formatActiveDocument,
      },
      {
        id: "find",
        label: "编辑: 查找",
        detail: "在当前文件中查找",
        shortcut: "⌘ F",
        run: function () {
          runMonacoAction("actions.find");
        },
      },
      {
        id: "replace",
        label: "编辑: 查找并替换",
        detail: "在当前文件中替换内容",
        shortcut: "⌥⌘F",
        run: function () {
          runMonacoAction("editor.action.startFindReplaceAction");
        },
      },
      {
        id: "goto",
        label: "转到: 行",
        detail: "输入行号快速跳转",
        shortcut: "⌃ G",
        run: function () {
          runMonacoAction("editor.action.gotoLine");
        },
      },
      {
        id: "minimap",
        label: "视图: 切换 minimap",
        detail: "显示或隐藏代码缩略图",
        shortcut: "",
        run: toggleMinimap,
      },
      {
        id: "wrap",
        label: "视图: 切换自动换行",
        detail: "切换当前编辑器的行宽行为",
        shortcut: "⌥Z",
        run: toggleWordWrap,
      },
      {
        id: "source",
        label: "源代码管理: 本地检查点",
        detail: "创建或恢复工作区快照",
        shortcut: "",
        run: function () {
          openWorkbenchPanel("source");
        },
      },
      {
        id: "settings",
        label: "设置: 配置 AI 接口",
        detail: "管理 DeepSeek 或通义千问",
        shortcut: "",
        run: openAISettings,
      },
      {
        id: "console",
        label: "视图: 切换运行输出",
        detail: "展开或折叠控制台",
        shortcut: "",
        run: function () {
          setView("preview");
          toggleConsole();
        },
      },
      {
        id: "python",
        label: "语言: Python 草稿",
        detail: "打开 main.py",
        shortcut: "",
        run: function () {
          activateLanguage("python");
        },
      },
      {
        id: "java",
        label: "语言: Java 草稿",
        detail: "打开 Main.java",
        shortcut: "",
        run: function () {
          activateLanguage("java");
        },
      },
      ...getQuickOpenCommands(),
    ];
  }

  function getQuickOpenCommands() {
    const webCommands = Object.keys(FILE_CONFIG).map(function (key) {
      return {
        id: "open-web-" + key,
        label: "转到文件: " + FILE_CONFIG[key].name,
        detail: "打开网页项目文件",
        shortcut: "",
        run: function () {
          activateLanguage("web");
          switchFile(key);
        },
      };
    });
    const codeCommands = Object.keys(LANGUAGE_CONFIG)
      .filter(function (language) {
        return language !== "web";
      })
      .map(function (language) {
        return {
          id: "open-code-" + language,
          label: "转到文件: " + LANGUAGE_CONFIG[language].fileName,
          detail: LANGUAGE_CONFIG[language].label + " 代码草稿",
          shortcut: "",
          run: function () {
            activateLanguage(language);
          },
        };
      });
    return webCommands.concat(codeCommands);
  }

  function openCommandPalette(initialQuery) {
    closeWorkbench();
    closeAssistant();
    elements.commandInput.value =
      typeof initialQuery === "string" ? initialQuery : "";
    selectedCommandIndex = 0;
    renderCommandPalette();
    if (typeof elements.commandDialog.showModal === "function") {
      elements.commandDialog.showModal();
    } else {
      elements.commandDialog.setAttribute("open", "");
    }
    window.setTimeout(function () {
      elements.commandInput.focus();
    }, 30);
  }

  function renderCommandPalette() {
    const query = elements.commandInput.value.trim().toLowerCase();
    filteredCommands = getWorkbenchCommands().filter(function (command) {
      return (
        !query ||
        command.label.toLowerCase().indexOf(query) !== -1 ||
        command.detail.toLowerCase().indexOf(query) !== -1
      );
    });
    selectedCommandIndex = Math.min(
      Math.max(selectedCommandIndex, 0),
      Math.max(filteredCommands.length - 1, 0)
    );
    elements.commandList.replaceChildren();

    if (filteredCommands.length === 0) {
      const empty = document.createElement("p");
      empty.className = "command-empty";
      empty.textContent = "没有匹配的命令";
      elements.commandList.append(empty);
      return;
    }

    filteredCommands.forEach(function (command, index) {
      const button = document.createElement("button");
      const label = document.createElement("span");
      const shortcut = document.createElement("kbd");
      button.type = "button";
      button.className = "command-item" + (index === selectedCommandIndex ? " is-selected" : "");
      button.dataset.commandIndex = String(index);
      label.textContent = command.label;
      shortcut.textContent = command.shortcut;
      button.append(label, shortcut);
      elements.commandList.append(button);
    });
  }

  function handleCommandKeydown(event) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      selectedCommandIndex = Math.min(selectedCommandIndex + 1, filteredCommands.length - 1);
      renderCommandPalette();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      selectedCommandIndex = Math.max(selectedCommandIndex - 1, 0);
      renderCommandPalette();
    } else if (event.key === "Enter") {
      event.preventDefault();
      executeCommandByIndex(selectedCommandIndex);
    }
  }

  function executeCommandByIndex(index) {
    const command = filteredCommands[index];
    if (!command) {
      return;
    }
    if (typeof elements.commandDialog.close === "function") {
      elements.commandDialog.close();
    } else {
      elements.commandDialog.removeAttribute("open");
    }
    try {
      command.run();
    } catch (error) {
      showToast("命令执行失败：" + (error && error.message ? error.message : "未知错误"));
    }
  }

  function runMonacoAction(actionId) {
    const action =
      editor &&
      editor.instance &&
      editor.instance.getAction &&
      editor.instance.getAction(actionId);
    if (action) {
      action.run();
    } else {
      showToast("当前编辑器不支持该命令。");
    }
  }

  function formatActiveDocument() {
    if (editor && editor.instance) {
      const action = editor.instance.getAction("editor.action.formatDocument");
      if (action) {
        const result = action.run();
        if (result && typeof result.then === "function") {
          result
            .then(function () {
              saveNow();
              showToast("文档已格式化。");
            })
            .catch(function () {
              showToast("当前文档没有可用的格式化器。");
            });
        } else {
          saveNow();
          showToast("文档已格式化。");
        }
        return;
      }
    }
    showToast("当前语言暂时没有可用的格式化器。");
  }

  function toggleMinimap() {
    if (!editor || !editor.instance) {
      return;
    }
    const minimap = editor.instance.getOption(editor.monaco.editor.EditorOption.minimap);
    editor.instance.updateOptions({ minimap: { enabled: !(minimap && minimap.enabled) } });
  }

  function toggleWordWrap() {
    if (!editor || !editor.instance) {
      return;
    }
    const current = editor.instance.getOption(editor.monaco.editor.EditorOption.wordWrap);
    editor.instance.updateOptions({ wordWrap: current === "on" ? "off" : "on" });
  }

  function openAssistant() {
    closeWorkbench();
    if (!aiHasOpened) {
      aiHistory.push({
        role: "assistant",
        content:
          "你好，我是 PadCode AI。配置 DeepSeek 或通义千问的 API Key 后，我可以读取当前三个文件，帮你修改页面、排查预览错误，并把完整代码直接应用到项目。",
      });
      aiHasOpened = true;
    }

    updateAIStatus();
    renderAIHistory();
    elements.assistantPanel.classList.add("is-open");
    elements.assistantPanel.setAttribute("aria-hidden", "false");
    elements.assistantButton.setAttribute("aria-expanded", "true");
    elements.assistantScrim.hidden = false;
  }

  function closeAssistant() {
    elements.assistantPanel.classList.remove("is-open");
    elements.assistantPanel.setAttribute("aria-hidden", "true");
    elements.assistantButton.setAttribute("aria-expanded", "false");
    elements.assistantScrim.hidden = true;
  }

  function openAISettings() {
    elements.aiProvider.value = aiConfig.provider;
    elements.aiEndpoint.value = aiConfig.endpoint;
    elements.aiModel.value = aiConfig.model;
    elements.aiApiKey.value = "";
    elements.aiApiKey.placeholder = aiConfig.apiKey ? "已保存，留空则保持不变" : "sk-…";
    elements.aiRememberKey.checked = Boolean(aiConfig.rememberKey);

    if (typeof elements.aiSettingsDialog.showModal === "function") {
      elements.aiSettingsDialog.showModal();
    } else {
      elements.aiSettingsDialog.setAttribute("open", "");
    }
  }

  function closeAISettings() {
    if (typeof elements.aiSettingsDialog.close === "function") {
      elements.aiSettingsDialog.close();
    } else {
      elements.aiSettingsDialog.removeAttribute("open");
    }
  }

  function applyAIProviderPreset() {
    const preset = AI_PROVIDERS[elements.aiProvider.value];
    if (!preset || elements.aiProvider.value === "custom") {
      return;
    }

    elements.aiEndpoint.value = preset.endpoint;
    elements.aiModel.value = preset.model;
  }

  function saveAISettings(event) {
    event.preventDefault();

    const provider = AI_PROVIDERS[elements.aiProvider.value]
      ? elements.aiProvider.value
      : "custom";
    const endpoint = elements.aiEndpoint.value.trim();
    const model = elements.aiModel.value.trim();
    const newKey = elements.aiApiKey.value.trim();
    const rememberKey = elements.aiRememberKey.checked;

    let endpointUrl;
    try {
      endpointUrl = new URL(endpoint);
    } catch (_error) {
      showToast("API 地址格式不正确。");
      elements.aiEndpoint.focus();
      return;
    }

    if (endpointUrl.protocol !== "https:") {
      showToast("为了保证 iPad 上的数据安全，API 地址必须使用 HTTPS。");
      elements.aiEndpoint.focus();
      return;
    }

    if (!model) {
      showToast("请填写模型名称。");
      elements.aiModel.focus();
      return;
    }

    const apiKey = newKey || aiConfig.apiKey;
    if (!apiKey) {
      showToast("请填写 API Key。");
      elements.aiApiKey.focus();
      return;
    }

    aiConfig = {
      provider: provider,
      endpoint: endpointUrl.href,
      model: model,
      apiKey: apiKey,
      rememberKey: rememberKey,
    };

    try {
      localStorage.setItem(
        AI_CONFIG_STORAGE_KEY,
        JSON.stringify({
          version: 1,
          provider: aiConfig.provider,
          endpoint: aiConfig.endpoint,
          model: aiConfig.model,
          rememberKey: aiConfig.rememberKey,
        })
      );

      if (rememberKey) {
        localStorage.setItem(AI_KEY_STORAGE_KEY, apiKey);
        sessionStorage.removeItem(AI_KEY_STORAGE_KEY);
      } else {
        sessionStorage.setItem(AI_KEY_STORAGE_KEY, apiKey);
        localStorage.removeItem(AI_KEY_STORAGE_KEY);
      }
    } catch (_error) {
      showToast("浏览器无法保存 AI 配置，请检查隐私或存储设置。");
      return;
    }

    updateAIStatus();
    closeAISettings();
    showToast(AI_PROVIDERS[provider].label + " 已连接。");
  }

  function updateAIStatus() {
    const provider = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;
    const ready = Boolean(aiConfig.apiKey && aiConfig.endpoint && aiConfig.model);
    elements.aiSettingsButton.textContent = ready ? aiConfig.model : "未配置";
    elements.aiSettingsButton.classList.toggle("is-ready", ready);
    elements.aiSettingsButton.title = ready
      ? provider.label + " · " + aiConfig.model
      : "点击配置 AI 接口";
    elements.extensionAiStatus.textContent = ready
      ? provider.label + " · " + aiConfig.model
      : "国内 AI 接口 · 未配置";
    updateAIContext();
  }

  function updateAIContext() {
    const activeName = getActiveFileName();
    const errorCount = consoleLogs.filter(function (entry) {
      return entry.type === "error";
    }).length;
    elements.aiContextLabel.textContent =
      "当前文件 " +
      activeName +
      " · " +
      (Object.keys(FILE_CONFIG).length + state.customFiles.length) +
      " 个文件" +
      (errorCount ? " · " + errorCount + " 个错误" : "");
  }

  function renderAIHistory() {
    elements.aiMessages.replaceChildren();

    aiHistory.forEach(function (message, index) {
      elements.aiMessages.append(createAIMessageElement(message, index));
    });

    if (aiBusy) {
      const row = document.createElement("div");
      const bubble = document.createElement("div");
      const typing = document.createElement("span");
      row.className = "ai-message";
      bubble.className = "ai-message-bubble";
      typing.className = "ai-typing";
      typing.setAttribute("aria-label", "AI 正在思考");
      typing.append(
        document.createElement("i"),
        document.createElement("i"),
        document.createElement("i")
      );
      bubble.append(typing);
      row.append(bubble);
      elements.aiMessages.append(row);
    }

    scrollAIToBottom();
  }

  function createAIMessageElement(message, index) {
    const row = document.createElement("div");
    const bubble = document.createElement("div");
    const meta = document.createElement("span");
    const isUser = message.role === "user";
    const parsed =
      !isUser && message.files
        ? { text: message.content, files: message.files }
        : parseAIResponse(message.content);

    row.className = "ai-message" + (isUser ? " is-user" : "");
    row.className += message.error ? " is-error" : "";
    bubble.className = "ai-message-bubble";
    bubble.textContent = isUser
      ? message.content
      : parsed.text || "已生成代码修改，请查看下方操作。";
    meta.className = "ai-message-meta";
    meta.textContent = isUser ? "你" : "PadCode AI" + (aiConfig.model ? " · " + aiConfig.model : "");
    row.append(bubble, meta);

    const fileKeys = Object.keys(parsed.files || {});
    if (!isUser && fileKeys.length > 0) {
      const actions = document.createElement("div");
      const applyButton = document.createElement("button");
      const copyButton = document.createElement("button");
      actions.className = "ai-message-actions";
      applyButton.className = "is-primary";
      applyButton.type = "button";
      applyButton.textContent = "应用 " + fileKeys.length + " 个文件";
      applyButton.addEventListener("click", function () {
        applyAIFiles(parsed.files, fileKeys);
      });
      copyButton.type = "button";
      copyButton.textContent = "复制回答";
      copyButton.addEventListener("click", function () {
        copyText(message.content);
      });
      actions.append(applyButton, copyButton);
      row.append(actions);
    } else if (!isUser && !message.error) {
      const actions = document.createElement("div");
      const copyButton = document.createElement("button");
      actions.className = "ai-message-actions";
      copyButton.type = "button";
      copyButton.textContent = "复制回答";
      copyButton.addEventListener("click", function () {
        copyText(message.content);
      });
      actions.append(copyButton);
      row.append(actions);
    }

    row.dataset.messageIndex = String(index);
    return row;
  }

  function parseAIResponse(content) {
    const files = {};
    const filePattern =
      /<file\s+(?:name|path)=["']([^"']+)["'][^>]*>([\s\S]*?)<\/file>/gi;
    let match;

    while ((match = filePattern.exec(content)) !== null) {
      const filename = match[1].split("/").pop().toLowerCase();
      const webKey = Object.keys(FILE_CONFIG).find(function (key) {
        return FILE_CONFIG[key].name === filename;
      });
      const codeKey = Object.keys(LANGUAGE_CONFIG).find(function (language) {
        return (
          language !== "web" &&
          LANGUAGE_CONFIG[language].fileName.toLowerCase() === filename
        );
      });
      if (webKey) {
        files["web:" + webKey] = {
          kind: "web",
          key: webKey,
          content: match[2].replace(/^\r?\n/, "").replace(/\r?\n$/, ""),
        };
      } else if (codeKey) {
        files["code:" + codeKey] = {
          kind: "code",
          key: codeKey,
          content: match[2].replace(/^\r?\n/, "").replace(/\r?\n$/, ""),
        };
      }
    }

    return {
      files: files,
      text: content
        .replace(filePattern, "")
        .replace(/```[a-z]*\r?\n?/gi, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim(),
    };
  }

  function applyAIFiles(files, fileKeys) {
    const filenames = fileKeys.map(function (key) {
      const file = files[key];
      return file.kind === "web"
        ? FILE_CONFIG[file.key].name
        : LANGUAGE_CONFIG[file.key].fileName;
    });
    const confirmed = window.confirm(
      "将替换项目中的 " + filenames.join("、") + "。当前内容会被覆盖，是否继续？"
    );
    if (!confirmed) {
      return;
    }

    fileKeys.forEach(function (key) {
      const file = files[key];
      const value = String(file.content).trimEnd() + "\n";
      if (file.kind === "web") {
        state.files[file.key] = value;
      } else {
        state.codeProjects[file.key].source = value;
      }
    });

    const firstFile = files[fileKeys[0]];
    if (firstFile.kind === "web") {
      activateLanguage("web");
      switchFile(firstFile.key, { focus: false, preservePreview: true });
      runPreview({ clearConsole: true });
    } else {
      activateLanguage(firstFile.key, { focus: false });
    }
    saveNow();
    closeAssistant();
    showToast("AI 修改已应用，请检查预览效果。");
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          showToast("回答已复制。");
        },
        function () {
          showToast("复制失败，请长按文字手动复制。");
        }
      );
      return;
    }

    const field = document.createElement("textarea");
    field.value = text;
    field.setAttribute("readonly", "");
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    showToast(copied ? "回答已复制。" : "复制失败，请长按文字手动复制。");
  }

  function scrollAIToBottom() {
    requestAnimationFrame(function () {
      elements.aiMessages.scrollTop = elements.aiMessages.scrollHeight;
    });
  }

  function resizeAIPrompt() {
    elements.aiPrompt.style.height = "auto";
    elements.aiPrompt.style.height = Math.min(elements.aiPrompt.scrollHeight, 120) + "px";
  }

  function handleAIPromptKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      requestAIResponse();
    }
  }

  function submitAIPrompt(event) {
    event.preventDefault();
    requestAIResponse();
  }

  async function requestAIResponse() {
    if (aiBusy) {
      return;
    }

    const prompt = elements.aiPrompt.value.trim();
    if (!prompt) {
      elements.aiPrompt.focus();
      return;
    }

    if (!aiConfig.apiKey || !aiConfig.endpoint || !aiConfig.model) {
      openAISettings();
      showToast("请先配置国内 AI 接口和 API Key。");
      return;
    }

    aiHistory.push({ role: "user", content: prompt });
    elements.aiPrompt.value = "";
    resizeAIPrompt();
    aiBusy = true;
    elements.aiSendButton.disabled = true;
    elements.aiStarters.classList.add("is-disabled");
    renderAIHistory();

    const controller = new AbortController();
    const timeout = window.setTimeout(function () {
      controller.abort();
    }, 90000);

    try {
      const history = aiHistory.slice(-10).map(function (message) {
        return { role: message.role, content: message.content };
      });
      history[history.length - 1].content =
        prompt + "\n\n以下是当前项目快照，请基于它完成请求：\n" + buildAIProjectContext();

      const response = await fetch(aiConfig.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + aiConfig.apiKey,
        },
        body: JSON.stringify({
          model: aiConfig.model,
          messages: [{ role: "system", content: AI_SYSTEM_PROMPT }].concat(history),
          temperature: 0.25,
          max_tokens: 6000,
          stream: false,
        }),
        signal: controller.signal,
      });

      const payload = await response.json().catch(function () {
        return null;
      });
      if (!response.ok) {
        const reason =
          payload && payload.error && (payload.error.message || payload.error.code);
        throw new Error(reason || "接口返回 HTTP " + response.status);
      }

      const choice = payload && payload.choices && payload.choices[0];
      const rawContent = choice && choice.message && choice.message.content;
      const text = normalizeAIResponseContent(rawContent);
      if (!text) {
        throw new Error("接口没有返回可用内容。");
      }

      aiHistory.push({ role: "assistant", content: text });
    } catch (error) {
      const message =
        error && error.name === "AbortError"
          ? "请求超时。请检查网络后重试。"
          : error && error.message
            ? error.message
            : "请求失败，请稍后重试。";
      aiHistory.push({
        role: "assistant",
        content: "请求失败：" + message,
        error: true,
      });
    } finally {
      window.clearTimeout(timeout);
      aiBusy = false;
      elements.aiSendButton.disabled = false;
      elements.aiStarters.classList.remove("is-disabled");
      if (aiHistory.length > MAX_AI_HISTORY) {
        aiHistory = aiHistory.slice(-MAX_AI_HISTORY);
      }
      renderAIHistory();
    }
  }

  function normalizeAIResponseContent(content) {
    if (typeof content === "string") {
      return content.trim();
    }
    if (Array.isArray(content)) {
      return content
        .map(function (part) {
          return typeof part === "string" ? part : part && part.text ? part.text : "";
        })
        .join("")
        .trim();
    }
    return "";
  }

  function buildAIProjectContext() {
    const parts = [
      "当前打开文件：" +
        (isWebLanguage()
          ? FILE_CONFIG[state.activeFile].name
          : LANGUAGE_CONFIG[state.activeLanguage].fileName),
      "预览控制台最近输出：",
      consoleLogs.length
        ? consoleLogs
            .slice(-12)
            .map(function (entry) {
              return "[" + entry.type + "] " + entry.text;
            })
            .join("\n")
        : "（无）",
    ];

    Object.keys(FILE_CONFIG).forEach(function (key) {
      parts.push(
        '<file name="' +
          FILE_CONFIG[key].name +
          '">\n' +
          state.files[key] +
          "\n</file>"
      );
    });

    Object.keys(LANGUAGE_CONFIG).forEach(function (language) {
      if (language === "web") {
        return;
      }
      parts.push(
        '<file name="' +
          LANGUAGE_CONFIG[language].fileName +
          '">\n' +
          state.codeProjects[language].source +
          "\n</file>"
      );
    });

    return parts.join("\n\n");
  }

  function loadAIConfig() {
    const config = {
      provider: "deepseek",
      endpoint: AI_PROVIDERS.deepseek.endpoint,
      model: AI_PROVIDERS.deepseek.model,
      apiKey: "",
      rememberKey: false,
    };

    try {
      const raw = localStorage.getItem(AI_CONFIG_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === "object") {
        config.provider = AI_PROVIDERS[parsed.provider] ? parsed.provider : "custom";
        config.endpoint =
          typeof parsed.endpoint === "string" && parsed.endpoint
            ? parsed.endpoint
            : config.endpoint;
        config.model =
          typeof parsed.model === "string" && parsed.model ? parsed.model : config.model;
        config.rememberKey = parsed.rememberKey === true;
      }

      config.apiKey = config.rememberKey
        ? localStorage.getItem(AI_KEY_STORAGE_KEY) || ""
        : sessionStorage.getItem(AI_KEY_STORAGE_KEY) || "";
    } catch (_error) {
      // The panel still opens, and the user can configure it again.
    }

    return config;
  }

  function handleTemplateButton() {
    if (isWebLanguage()) {
      openTemplateDialog();
      return;
    }
    if (state.activeDocumentKind === "custom") {
      openFileDialog();
      return;
    }

    const config = LANGUAGE_CONFIG[state.activeLanguage];
    if (!window.confirm("将 " + config.fileName + " 恢复为初始示例代码？")) {
      return;
    }

    state.codeProjects[state.activeLanguage] = {
      source: CODE_STARTERS[state.activeLanguage].source,
      stdin: state.codeProjects[state.activeLanguage].stdin || "",
    };
    activateLanguage(state.activeLanguage, { focus: true, persist: false, run: false });
    saveNow();
    showToast(config.label + " 示例已恢复。");
  }

  function openStdinDialog() {
    if (isWebLanguage()) {
      return;
    }
    elements.stdinInput.value = state.codeProjects[state.activeLanguage].stdin || "";
    if (typeof elements.stdinDialog.showModal === "function") {
      elements.stdinDialog.showModal();
    } else {
      elements.stdinDialog.setAttribute("open", "");
    }
    elements.stdinInput.focus();
  }

  function saveStdinValue() {
    if (isWebLanguage()) {
      return;
    }
    state.codeProjects[state.activeLanguage].stdin = elements.stdinInput.value;
    scheduleSave();
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
    const codeTarget = {
      py: "python",
      java: "java",
      c: "c",
      cpp: "cpp",
      cc: "cpp",
      cxx: "cpp",
    }[extension];

    if (!FILE_CONFIG[target] && !codeTarget) {
      showToast("请选择 .html、.css、.js、.py、.java、.c 或 .cpp 文件。");
      elements.fileInput.value = "";
      return;
    }

    const reader = new FileReader();
    reader.addEventListener("load", function () {
      if (codeTarget) {
        state.codeProjects[codeTarget].source = String(reader.result || "");
        activateLanguage(codeTarget, { focus: true, persist: true, run: false });
      } else {
        state.files[target] = String(reader.result || "");
        switchFile(target, { focus: true, preservePreview: true });
      }
      saveNow();
      runCurrent();
      showToast(file.name + " 已导入。");
      elements.fileInput.value = "";
    });
    reader.addEventListener("error", function () {
      showToast("文件读取失败，请重试。");
      elements.fileInput.value = "";
    });
    reader.readAsText(file);
  }

  async function exportProject() {
    const payload = isWebLanguage()
      ? {
          filename: safeFilename(extractProjectTitle()) + ".html",
          content: buildPreviewDocument(false),
          type: "text/html",
        }
      : {
          filename: getActiveFileName(),
          content: getActiveSource(),
          type: getMimeTypeForFilename(getActiveFileName()),
        };

    const file = new File([payload.content], payload.filename, {
      type: payload.type + ";charset=utf-8",
    });
    const canShareFile =
      typeof navigator.share === "function" &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] });

    if (canShareFile && isIPadOS()) {
      try {
        await navigator.share({
          files: [file],
          title: payload.filename,
        });
        showToast("已打开 iPad 分享面板，可保存到“文件”App。");
        return;
      } catch (error) {
        if (error && error.name === "AbortError") {
          return;
        }
      }
    }

    downloadBlob(payload.content, payload.filename, file.type);
    showToast("文件已下载到 iPad 的“下载”文件夹。");
  }

  function getMimeTypeForFilename(filename) {
    const extension = getFileExtension(filename);
    const types = {
      html: "text/html",
      htm: "text/html",
      css: "text/css",
      js: "text/javascript",
      mjs: "text/javascript",
      json: "application/json",
      md: "text/markdown",
      py: "text/x-python",
      java: "text/x-java",
      c: "text/x-csrc",
      h: "text/x-csrc",
      cpp: "text/x-c++src",
      cc: "text/x-c++src",
      cxx: "text/x-c++src",
      hpp: "text/x-c++src",
    };
    return types[extension] || "text/plain";
  }

  function isIPadOS() {
    return (
      /iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
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
    if (event.key === "F1" || ((event.metaKey || event.ctrlKey) && event.shiftKey && event.key.toLowerCase() === "p")) {
      event.preventDefault();
      openCommandPalette();
      return;
    }

    if (event.key === "Escape" && elements.assistantPanel.classList.contains("is-open")) {
      closeAssistant();
      return;
    }

    const commandKey = event.metaKey || event.ctrlKey;
    if (!commandKey) {
      return;
    }

    if (event.shiftKey && event.key.toLowerCase() === "f") {
      event.preventDefault();
      openWorkbenchPanel("search");
    } else if (event.key.toLowerCase() === "p" && !event.altKey && !event.shiftKey) {
      event.preventDefault();
      openCommandPalette("转到文件:");
    } else if (event.key.toLowerCase() === "b") {
      event.preventDefault();
      toggleWorkbenchPanel("explorer");
    } else if (event.key.toLowerCase() === "i" && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      openAssistant();
    } else if (event.key === "Enter") {
      event.preventDefault();
      runCurrent({ showPreview: true });
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
          const customFiles = normalizeCustomFiles(parsed.customFiles);
          const requestedCustomId =
            typeof parsed.activeCustomFileId === "string" ? parsed.activeCustomFileId : null;
          const hasRequestedCustom = customFiles.some(function (file) {
            return file.id === requestedCustomId;
          });
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
            codeProjects: normalizeCodeProjects(parsed.codeProjects),
            customFiles: customFiles,
            activeLanguage: LANGUAGE_CONFIG[parsed.activeLanguage]
              ? parsed.activeLanguage
              : "web",
            activeFile: FILE_CONFIG[parsed.activeFile] ? parsed.activeFile : "html",
            activeDocumentKind:
              parsed.activeDocumentKind === "custom" && hasRequestedCustom
                ? "custom"
                : parsed.activeLanguage && parsed.activeLanguage !== "web"
                  ? "code"
                  : "web",
            activeCustomFileId: hasRequestedCustom ? requestedCustomId : null,
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
      codeProjects: normalizeCodeProjects(null),
      customFiles: [],
      activeLanguage: "web",
      activeFile: "html",
      activeDocumentKind: "web",
      activeCustomFileId: null,
    };
  }

  function normalizeCustomFiles(savedFiles) {
    if (!Array.isArray(savedFiles)) {
      return [];
    }
    const seenNames = new Set();
    return savedFiles
      .filter(function (file) {
        return (
          file &&
          typeof file.id === "string" &&
          typeof file.name === "string" &&
          typeof file.content === "string"
        );
      })
      .filter(function (file) {
        const normalized = file.name.trim().toLowerCase();
        if (!normalized || seenNames.has(normalized)) {
          return false;
        }
        seenNames.add(normalized);
        return true;
      })
      .map(function (file) {
        return {
          id: file.id,
          name: normalizeNewFileName(file.name),
          content: file.content,
        };
      });
  }

  function normalizeCodeProjects(savedProjects) {
    return Object.keys(CODE_STARTERS).reduce(function (result, language) {
      const saved =
        savedProjects && typeof savedProjects[language] === "object"
          ? savedProjects[language]
          : null;
      result[language] = {
        source:
          saved && typeof saved.source === "string"
            ? saved.source
            : CODE_STARTERS[language].source,
        stdin: saved && typeof saved.stdin === "string" ? saved.stdin : "",
      };
      return result;
    }, {});
  }

  function readAutoRunPreference() {
    try {
      const value = localStorage.getItem(AUTORUN_STORAGE_KEY);
      return value === null ? true : value === "1";
    } catch (_error) {
      return true;
    }
  }

  function readPreviewCollapsedPreference() {
    try {
      return localStorage.getItem(PREVIEW_COLLAPSE_STORAGE_KEY) === "1";
    } catch (_error) {
      return false;
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

  function buildCodeStarters() {
    return {
      python: {
        source: `# Python 3 · PadCode
name = "PadCode"
print("Hello, " + name + "!")

for number in range(1, 6):
    print("第", number, "次循环")

# 如需读取标准输入，可取消下一行注释：
# user_input = input("请输入：")
`,
        stdin: "",
      },
      java: {
        source: `// Java · PadCode
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, PadCode!");

        for (int i = 1; i <= 5; i++) {
            System.out.println("第 " + i + " 次循环");
        }
    }
}
`,
        stdin: "",
      },
      c: {
        source: `/* C · PadCode */
#include <stdio.h>

int main(void) {
    printf("Hello, PadCode!\\n");

    for (int i = 1; i <= 5; i++) {
        printf("第 %d 次循环\\n", i);
    }

    return 0;
}
`,
        stdin: "",
      },
      cpp: {
        source: `// C++ · PadCode
#include <iostream>

int main() {
    std::cout << "Hello, PadCode!" << std::endl;

    for (int i = 1; i <= 5; ++i) {
        std::cout << "第 " << i << " 次循环" << std::endl;
    }

    return 0;
}
`,
        stdin: "",
      },
    };
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
