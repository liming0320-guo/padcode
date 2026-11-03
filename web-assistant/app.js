(function () {
  "use strict";

  const CONFIG_STORAGE_KEY = "ai-workbench.config.v1";
  const KEY_STORAGE_KEY = "ai-workbench.key.v1";
  const CHAT_STORAGE_KEY = "ai-workbench.chats.v1";
  const DEFAULT_SYSTEM_PROMPT =
    "你是我的编码与技术助手。回答使用简体中文，先给结论，再给必要步骤。代码必须完整、可运行，并说明风险与验证方法。不要声称已经执行过你实际没有执行的操作。";

  const DEFAULT_CONFIG = {
    endpoint: "",
    protocol: "chat",
    model: "",
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    maxTokens: 4096,
    temperature: 0.7,
    rememberKey: false,
    stream: true,
  };

  const elements = {
    sidebar: document.querySelector("#sidebar"),
    sidebarCloseButton: document.querySelector("#sidebarCloseButton"),
    menuButton: document.querySelector("#menuButton"),
    backdrop: document.querySelector("#backdrop"),
    newChatButton: document.querySelector("#newChatButton"),
    newChatTopButton: document.querySelector("#newChatTopButton"),
    conversationList: document.querySelector("#conversationList"),
    conversationTitle: document.querySelector("#conversationTitle"),
    connectionStatus: document.querySelector("#connectionStatus"),
    sidebarConnection: document.querySelector("#sidebarConnection"),
    chatViewport: document.querySelector("#chatViewport"),
    messages: document.querySelector("#messages"),
    welcome: document.querySelector("#welcome"),
    composer: document.querySelector("#composer"),
    promptInput: document.querySelector("#promptInput"),
    sendButton: document.querySelector("#sendButton"),
    settingsButton: document.querySelector("#settingsButton"),
    topSettingsButton: document.querySelector("#topSettingsButton"),
    settingsDialog: document.querySelector("#settingsDialog"),
    settingsForm: document.querySelector("#settingsForm"),
    settingsCloseButton: document.querySelector("#settingsCloseButton"),
    endpointInput: document.querySelector("#endpointInput"),
    protocolInput: document.querySelector("#protocolInput"),
    modelInput: document.querySelector("#modelInput"),
    apiKeyInput: document.querySelector("#apiKeyInput"),
    systemPromptInput: document.querySelector("#systemPromptInput"),
    maxTokensInput: document.querySelector("#maxTokensInput"),
    temperatureInput: document.querySelector("#temperatureInput"),
    rememberKeyInput: document.querySelector("#rememberKeyInput"),
    streamInput: document.querySelector("#streamInput"),
    settingsResult: document.querySelector("#settingsResult"),
    testConnectionButton: document.querySelector("#testConnectionButton"),
    clearAllButton: document.querySelector("#clearAllButton"),
    toast: document.querySelector("#toast"),
  };

  let config = loadConfig();
  let apiKey = loadApiKey(config.rememberKey);
  let chatStore = loadChatStore();
  let busy = false;
  let abortedByUser = false;
  let abortController = null;
  let toastTimer = 0;
  let saveTimer = 0;
  let streamRenderFrame = 0;
  let connectionConfirmed = false;

  initialize();

  function initialize() {
    bindEvents();
    ensureConversation();
    renderConversations();
    renderCurrentConversation();
    updateConnectionStatus();
    resizePrompt();
    registerServiceWorker();

    if (!isConfigured()) {
      window.setTimeout(openSettings, 350);
    }
  }

  function bindEvents() {
    elements.menuButton.addEventListener("click", openSidebar);
    elements.sidebarCloseButton.addEventListener("click", closeSidebar);
    elements.backdrop.addEventListener("click", closeSidebar);
    elements.newChatButton.addEventListener("click", newConversation);
    elements.newChatTopButton.addEventListener("click", newConversation);
    elements.settingsButton.addEventListener("click", openSettings);
    elements.topSettingsButton.addEventListener("click", openSettings);
    elements.settingsCloseButton.addEventListener("click", closeSettings);
    elements.settingsForm.addEventListener("submit", saveSettings);
    elements.testConnectionButton.addEventListener("click", testConnection);
    elements.clearAllButton.addEventListener("click", clearLocalData);
    elements.composer.addEventListener("submit", handleSubmit);
    elements.promptInput.addEventListener("input", resizePrompt);
    elements.promptInput.addEventListener("keydown", handlePromptKeydown);
    elements.sendButton.addEventListener("click", function (event) {
      if (busy) {
        event.preventDefault();
        abortResponse();
      }
    });

    elements.settingsDialog.addEventListener("click", function (event) {
      if (event.target === elements.settingsDialog) {
        closeSettings();
      }
    });

    elements.conversationList.addEventListener("click", handleConversationListClick);
    elements.messages.addEventListener("click", handleMessageAction);
    document.querySelectorAll("[data-prompt]").forEach(function (button) {
      button.addEventListener("click", function () {
        elements.promptInput.value = button.dataset.prompt;
        resizePrompt();
        sendCurrentMessage();
      });
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeSidebar();
      }
    });
  }

  function loadConfig() {
    try {
      const raw = localStorage.getItem(CONFIG_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (!parsed || typeof parsed !== "object") {
        return Object.assign({}, DEFAULT_CONFIG);
      }
      return {
        endpoint: typeof parsed.endpoint === "string" ? parsed.endpoint : "",
        protocol: parsed.protocol === "responses" ? "responses" : "chat",
        model: typeof parsed.model === "string" ? parsed.model : "",
        systemPrompt:
          typeof parsed.systemPrompt === "string" && parsed.systemPrompt.trim()
            ? parsed.systemPrompt
            : DEFAULT_SYSTEM_PROMPT,
        maxTokens: clampNumber(parsed.maxTokens, 128, 32768, 4096),
        temperature: clampNumber(parsed.temperature, 0, 2, 0.7),
        rememberKey: parsed.rememberKey === true,
        stream: parsed.stream !== false,
      };
    } catch (_error) {
      return Object.assign({}, DEFAULT_CONFIG);
    }
  }

  function loadApiKey(rememberKey) {
    try {
      return rememberKey
        ? localStorage.getItem(KEY_STORAGE_KEY) || ""
        : sessionStorage.getItem(KEY_STORAGE_KEY) || "";
    } catch (_error) {
      return "";
    }
  }

  function loadChatStore() {
    try {
      const raw = localStorage.getItem(CHAT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Array.isArray(parsed.items)) {
        const items = parsed.items
          .filter(function (item) {
            return item && typeof item.id === "string" && Array.isArray(item.messages);
          })
          .map(function (item) {
            return {
              id: item.id,
              title: typeof item.title === "string" ? item.title : "新对话",
              createdAt: Number(item.createdAt) || Date.now(),
              updatedAt: Number(item.updatedAt) || Date.now(),
              messages: item.messages
                .filter(function (message) {
                  return (
                    message &&
                    (message.role === "user" || message.role === "assistant") &&
                    typeof message.content === "string"
                  );
                })
                .map(function (message) {
                  return {
                    role: message.role,
                    content: message.content,
                    createdAt: Number(message.createdAt) || Date.now(),
                    isError: message.isError === true,
                  };
                }),
            };
          });
        return {
          activeId:
            typeof parsed.activeId === "string" &&
            items.some(function (item) {
              return item.id === parsed.activeId;
            })
              ? parsed.activeId
              : items[0]
                ? items[0].id
                : "",
          items: items,
        };
      }
    } catch (_error) {
      // A fresh local conversation is safer than showing malformed persisted data.
    }
    return { activeId: "", items: [] };
  }

  function ensureConversation() {
    let conversation = getCurrentConversation();
    if (!conversation) {
      conversation = createConversationObject();
      chatStore.items.unshift(conversation);
      chatStore.activeId = conversation.id;
      persistChats();
    }
    return conversation;
  }

  function createConversationObject() {
    const now = Date.now();
    return {
      id: createId(),
      title: "新对话",
      createdAt: now,
      updatedAt: now,
      messages: [],
    };
  }

  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === "function") {
      return window.crypto.randomUUID();
    }
    return "chat-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
  }

  function getCurrentConversation() {
    return (
      chatStore.items.find(function (item) {
        return item.id === chatStore.activeId;
      }) || null
    );
  }

  function newConversation() {
    if (busy) {
      abortResponse();
    }
    const conversation = createConversationObject();
    chatStore.items.unshift(conversation);
    chatStore.activeId = conversation.id;
    persistChats();
    renderConversations();
    renderCurrentConversation();
    closeSidebar();
    window.setTimeout(function () {
      elements.promptInput.focus();
    }, 80);
  }

  function switchConversation(id) {
    if (busy || id === chatStore.activeId) {
      closeSidebar();
      return;
    }
    chatStore.activeId = id;
    persistChats();
    renderConversations();
    renderCurrentConversation();
    closeSidebar();
  }

  function deleteConversation(id) {
    if (busy) {
      return;
    }
    const conversation = chatStore.items.find(function (item) {
      return item.id === id;
    });
    if (!conversation || !window.confirm("删除对话“" + conversation.title + "”？")) {
      return;
    }
    chatStore.items = chatStore.items.filter(function (item) {
      return item.id !== id;
    });
    if (chatStore.activeId === id) {
      chatStore.activeId = chatStore.items[0] ? chatStore.items[0].id : "";
    }
    ensureConversation();
    persistChats();
    renderConversations();
    renderCurrentConversation();
  }

  function handleConversationListClick(event) {
    const deleteButton = event.target.closest("[data-delete-id]");
    if (deleteButton) {
      event.stopPropagation();
      deleteConversation(deleteButton.dataset.deleteId);
      return;
    }
    const selectButton = event.target.closest("[data-conversation-id]");
    if (selectButton) {
      switchConversation(selectButton.dataset.conversationId);
    }
  }

  function renderConversations() {
    elements.conversationList.replaceChildren();
    const items = chatStore.items.slice().sort(function (a, b) {
      return b.updatedAt - a.updatedAt;
    });

    if (items.length === 0) {
      const empty = document.createElement("p");
      empty.className = "conversation-empty";
      empty.textContent = "还没有对话。";
      elements.conversationList.append(empty);
      return;
    }

    items.forEach(function (conversation) {
      const row = document.createElement("div");
      const selectButton = document.createElement("button");
      const title = document.createElement("span");
      const deleteButton = document.createElement("button");
      row.className =
        "conversation-row" +
        (conversation.id === chatStore.activeId ? " is-active" : "");
      selectButton.type = "button";
      selectButton.className = "conversation-select";
      selectButton.dataset.conversationId = conversation.id;
      title.textContent = conversation.title || "新对话";
      selectButton.append(title);

      deleteButton.type = "button";
      deleteButton.className = "delete-conversation";
      deleteButton.dataset.deleteId = conversation.id;
      deleteButton.setAttribute("aria-label", "删除对话");
      deleteButton.innerHTML =
        '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3m-8 0 1 13h8l1-13M10 11v5m4-5v5"/></svg>';
      row.append(selectButton, deleteButton);
      elements.conversationList.append(row);
    });
  }

  function renderCurrentConversation() {
    const conversation = ensureConversation();
    elements.conversationTitle.textContent = conversation.title || "新对话";
    elements.messages.replaceChildren();
    const hasMessages = conversation.messages.length > 0;
    elements.welcome.hidden = hasMessages;
    elements.messages.hidden = !hasMessages;

    conversation.messages.forEach(function (message, index) {
      elements.messages.append(createMessageElement(message, index));
    });
    if (hasMessages) {
      scrollToBottom(true);
    }
  }

  function createMessageElement(message, index) {
    const row = document.createElement("article");
    const role = document.createElement("span");
    const bubble = document.createElement("div");
    row.className =
      "message" +
      (message.role === "user" ? " is-user" : "") +
      (message.isError ? " is-error" : "");
    role.className = "message-role";
    role.textContent = message.role === "user" ? "你" : "助手";
    bubble.className = "message-bubble";

    if (message.role === "user") {
      bubble.textContent = message.content;
    } else if (message.pending && !message.content) {
      const typing = document.createElement("span");
      typing.className = "typing";
      typing.setAttribute("aria-label", "助手正在回答");
      typing.append(
        document.createElement("i"),
        document.createElement("i"),
        document.createElement("i")
      );
      bubble.append(typing);
    } else {
      const content = document.createElement("div");
      content.className = "message-content";
      renderMarkdown(content, message.content);
      bubble.append(content);
    }

    row.append(role, bubble);

    if (message.role === "assistant" && message.content && !message.isError) {
      const actions = document.createElement("div");
      const copyButton = document.createElement("button");
      actions.className = "message-actions";
      copyButton.type = "button";
      copyButton.dataset.copyMessage = String(index);
      copyButton.textContent = "复制";
      actions.append(copyButton);
      row.append(actions);
    }
    return row;
  }

  function renderMarkdown(container, text) {
    const source = String(text || "").replace(/\r\n/g, "\n");
    const codePattern = /```([^\n`]*)\n?([\s\S]*?)```/g;
    let cursor = 0;
    let match;

    while ((match = codePattern.exec(source)) !== null) {
      renderTextSection(container, source.slice(cursor, match.index));
      container.append(createCodeBlock(match[1].trim(), match[2].replace(/\n$/, "")));
      cursor = match.index + match[0].length;
    }
    renderTextSection(container, source.slice(cursor));

    if (!container.childNodes.length) {
      const paragraph = document.createElement("p");
      paragraph.textContent = source;
      container.append(paragraph);
    }
  }

  function renderTextSection(container, text) {
    const trimmed = text.replace(/^\n+|\n+$/g, "");
    if (!trimmed) {
      return;
    }

    const lines = trimmed.split("\n");
    let list = null;
    let listType = "";

    lines.forEach(function (line) {
      const unordered = line.match(/^\s*[-*]\s+(.+)$/);
      const ordered = line.match(/^\s*\d+\.\s+(.+)$/);
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      const wantsList = unordered || ordered;
      const nextListType = unordered ? "ul" : ordered ? "ol" : "";

      if (wantsList) {
        if (!list || listType !== nextListType) {
          list = document.createElement(nextListType);
          listType = nextListType;
          container.append(list);
        }
        const item = document.createElement("li");
        appendInlineMarkdown(item, wantsList[1]);
        list.append(item);
        return;
      }

      list = null;
      listType = "";
      if (!line.trim()) {
        return;
      }
      const paragraph = document.createElement(heading ? "h3" : "p");
      if (heading) {
        paragraph.style.fontSize = heading[1].length === 1 ? "16px" : "14px";
      }
      appendInlineMarkdown(paragraph, heading ? heading[2] : line);
      container.append(paragraph);
    });
  }

  function appendInlineMarkdown(parent, text) {
    const tokenPattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
    let cursor = 0;
    let match;
    while ((match = tokenPattern.exec(text)) !== null) {
      if (match.index > cursor) {
        parent.append(document.createTextNode(text.slice(cursor, match.index)));
      }
      const token = match[0];
      if (token.startsWith("**")) {
        const strong = document.createElement("strong");
        strong.textContent = token.slice(2, -2);
        parent.append(strong);
      } else if (token.startsWith("`")) {
        const code = document.createElement("code");
        code.textContent = token.slice(1, -1);
        parent.append(code);
      } else {
        const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)$/);
        const link = document.createElement("a");
        link.textContent = linkMatch[1];
        link.href = linkMatch[2];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        parent.append(link);
      }
      cursor = match.index + token.length;
    }
    if (cursor < text.length) {
      parent.append(document.createTextNode(text.slice(cursor)));
    }
  }

  function createCodeBlock(language, code) {
    const block = document.createElement("section");
    const header = document.createElement("div");
    const label = document.createElement("span");
    const copyButton = document.createElement("button");
    const pre = document.createElement("pre");
    const codeElement = document.createElement("code");
    block.className = "code-block";
    header.className = "code-header";
    label.textContent = language || "code";
    copyButton.type = "button";
    copyButton.className = "copy-code-button";
    copyButton.dataset.copyCode = code;
    copyButton.textContent = "复制";
    codeElement.textContent = code;
    header.append(label, copyButton);
    pre.append(codeElement);
    block.append(header, pre);
    return block;
  }

  function handleMessageAction(event) {
    const codeButton = event.target.closest("[data-copy-code]");
    if (codeButton) {
      copyText(codeButton.dataset.copyCode, "代码已复制");
      return;
    }
    const copyButton = event.target.closest("[data-copy-message]");
    if (copyButton) {
      const conversation = getCurrentConversation();
      const message = conversation.messages[Number(copyButton.dataset.copyMessage)];
      if (message) {
        copyText(message.content, "回答已复制");
      }
    }
  }

  function handleSubmit(event) {
    event.preventDefault();
    if (busy) {
      abortResponse();
      return;
    }
    sendCurrentMessage();
  }

  function handlePromptKeydown(event) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      if (busy) {
        abortResponse();
      } else {
        sendCurrentMessage();
      }
    }
  }

  async function sendCurrentMessage() {
    const prompt = elements.promptInput.value.trim();
    if (!prompt || busy) {
      return;
    }
    if (!isConfigured()) {
      openSettings();
      showSettingsResult("请先填写接口地址和模型名称。", "error");
      return;
    }

    const conversation = ensureConversation();
    conversation.messages.push({
      role: "user",
      content: prompt,
      createdAt: Date.now(),
    });
    if (conversation.title === "新对话") {
      conversation.title = makeConversationTitle(prompt);
    }
    conversation.messages.push({
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      pending: true,
    });
    conversation.updatedAt = Date.now();
    elements.promptInput.value = "";
    resizePrompt();
    busy = true;
    abortedByUser = false;
    setBusyState(true);
    persistChats();
    renderConversations();
    renderCurrentConversation();

    const assistantMessage = conversation.messages[conversation.messages.length - 1];
    try {
      await requestAssistant(config, apiKey, conversation.messages, function (text) {
        assistantMessage.content += text;
        scheduleStreamRender();
      });
      assistantMessage.pending = false;
      if (!assistantMessage.content) {
        assistantMessage.content = "接口没有返回文本内容。";
        assistantMessage.isError = true;
      }
      connectionConfirmed = true;
    } catch (error) {
      assistantMessage.pending = false;
      assistantMessage.isError = true;
      assistantMessage.content = formatRequestError(error, abortedByUser);
    } finally {
      assistantMessage.pending = false;
      conversation.updatedAt = Date.now();
      busy = false;
      abortController = null;
      setBusyState(false);
      persistChats();
      renderConversations();
      renderCurrentConversation();
      updateConnectionStatus();
    }
  }

  function makeConversationTitle(text) {
    const clean = text.replace(/\s+/g, " ").trim();
    return clean.length > 30 ? clean.slice(0, 30) + "…" : clean || "新对话";
  }

  function scheduleStreamRender() {
    if (streamRenderFrame) {
      return;
    }
    streamRenderFrame = window.requestAnimationFrame(function () {
      streamRenderFrame = 0;
      const conversation = getCurrentConversation();
      const nearBottom =
        elements.chatViewport.scrollHeight -
          elements.chatViewport.scrollTop -
          elements.chatViewport.clientHeight <
        150;
      elements.messages.replaceChildren();
      conversation.messages.forEach(function (message, index) {
        elements.messages.append(createMessageElement(message, index));
      });
      if (nearBottom) {
        scrollToBottom(false);
      }
    });
  }

  function scrollToBottom(instant) {
    window.requestAnimationFrame(function () {
      elements.chatViewport.scrollTo({
        top: elements.chatViewport.scrollHeight,
        behavior: instant ? "auto" : "smooth",
      });
    });
  }

  function setBusyState(isBusy) {
    elements.sendButton.classList.toggle("is-stop", isBusy);
    elements.sendButton.setAttribute("aria-label", isBusy ? "停止生成" : "发送消息");
    elements.sendButton.innerHTML = isBusy
      ? '<svg viewBox="0 0 24 24"><rect x="7" y="7" width="10" height="10" rx="1"/></svg>'
      : '<svg viewBox="0 0 24 24"><path d="m4 12 16-8-5 16-3-6-8-2Z"/><path d="m12 14 8-10"/></svg>';
  }

  function abortResponse() {
    if (!abortController) {
      return;
    }
    abortedByUser = true;
    abortController.abort();
  }

  async function requestAssistant(activeConfig, key, messages, onDelta) {
    abortController = new AbortController();
    const timeout = window.setTimeout(function () {
      if (abortController) {
        abortController.abort("timeout");
      }
    }, 180000);

    try {
      const response = await fetch(
        resolveEndpoint(activeConfig.endpoint, activeConfig.protocol),
        {
          method: "POST",
          headers: buildHeaders(key),
          body: JSON.stringify(
            buildRequestBody(activeConfig, messages.filter(isApiMessage))
          ),
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const payload = await response.json().catch(function () {
          return null;
        });
        throw new Error(extractErrorMessage(payload) || "接口返回 HTTP " + response.status);
      }

      const contentType = response.headers.get("content-type") || "";
      if (contentType.indexOf("text/event-stream") !== -1 && response.body) {
        await consumeEventStream(response, activeConfig.protocol, onDelta);
      } else {
        const payload = await response.json();
        const text = extractResponseText(payload, activeConfig.protocol);
        if (!text) {
          throw new Error("接口返回成功，但没有可读取的文本内容。");
        }
        onDelta(text);
      }
    } finally {
      window.clearTimeout(timeout);
    }
  }

  function buildHeaders(key) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "text/event-stream, application/json",
    };
    if (key) {
      headers.Authorization = "Bearer " + key;
    }
    return headers;
  }

  function buildRequestBody(activeConfig, messages) {
    if (activeConfig.protocol === "responses") {
      return {
        model: activeConfig.model,
        instructions: activeConfig.systemPrompt,
        input: messages.map(function (message) {
          return { role: message.role, content: message.content };
        }),
        max_output_tokens: activeConfig.maxTokens,
        temperature: activeConfig.temperature,
        stream: activeConfig.stream,
      };
    }
    return {
      model: activeConfig.model,
      messages: [
        { role: "system", content: activeConfig.systemPrompt },
      ].concat(
        messages.map(function (message) {
          return { role: message.role, content: message.content };
        })
      ),
      max_tokens: activeConfig.maxTokens,
      temperature: activeConfig.temperature,
      stream: activeConfig.stream,
    };
  }

  function isApiMessage(message) {
    return (
      (message.role === "user" || message.role === "assistant") &&
      !message.pending &&
      !message.isError &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    );
  }

  function resolveEndpoint(endpoint, protocol) {
    const trimmed = String(endpoint || "").trim().replace(/\/+$/, "");
    if (
      /\/chat\/completions$/i.test(trimmed) ||
      /\/responses$/i.test(trimmed) ||
      /\/api\/chat$/i.test(trimmed)
    ) {
      return trimmed;
    }
    return trimmed + (protocol === "responses" ? "/responses" : "/chat/completions");
  }

  async function consumeEventStream(response, protocol, onDelta) {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let done = false;

    while (!done) {
      const result = await reader.read();
      done = result.done;
      buffer += decoder.decode(result.value || new Uint8Array(), { stream: !done });
      const blocks = buffer.split(/\r?\n\r?\n/);
      buffer = blocks.pop() || "";
      blocks.forEach(function (block) {
        processEventBlock(block, protocol, onDelta);
      });
    }

    if (buffer.trim()) {
      processEventBlock(buffer, protocol, onDelta);
    }
  }

  function processEventBlock(block, protocol, onDelta) {
    const dataLines = [];
    block.split(/\r?\n/).forEach(function (line) {
      if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trimStart());
      }
    });
    if (dataLines.length === 0) {
      return;
    }
    const data = dataLines.join("\n");
    if (data === "[DONE]") {
      return;
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch (_error) {
      return;
    }

    if (payload && payload.error) {
      throw new Error(extractErrorMessage(payload) || "流式响应返回错误。");
    }
    if (payload && payload.type === "response.failed") {
      throw new Error(extractErrorMessage(payload) || "Responses API 返回失败。");
    }

    const delta = extractStreamDelta(payload, protocol);
    if (delta) {
      onDelta(delta);
    }
  }

  function extractStreamDelta(payload, protocol) {
    if (!payload) {
      return "";
    }
    if (protocol === "responses") {
      if (payload.type === "response.output_text.delta" && typeof payload.delta === "string") {
        return payload.delta;
      }
      if (payload.type === "response.output_text.done" && typeof payload.text === "string") {
        return "";
      }
      return "";
    }

    const choice = payload.choices && payload.choices[0];
    if (!choice) {
      return "";
    }
    const content = choice.delta && choice.delta.content;
    if (typeof content === "string") {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .map(function (part) {
          return part && typeof part.text === "string" ? part.text : "";
        })
        .join("");
    }
    return "";
  }

  function extractResponseText(payload, protocol) {
    if (!payload) {
      return "";
    }
    if (protocol === "responses") {
      if (typeof payload.output_text === "string") {
        return payload.output_text;
      }
      if (Array.isArray(payload.output)) {
        return payload.output
          .flatMap(function (item) {
            return Array.isArray(item.content) ? item.content : [];
          })
          .map(function (part) {
            return typeof part.text === "string" ? part.text : "";
          })
          .join("");
      }
      return "";
    }
    const message = payload.choices && payload.choices[0] && payload.choices[0].message;
    if (!message) {
      return "";
    }
    if (typeof message.content === "string") {
      return message.content;
    }
    if (Array.isArray(message.content)) {
      return message.content
        .map(function (part) {
          return part && typeof part.text === "string" ? part.text : "";
        })
        .join("");
    }
    return "";
  }

  function extractErrorMessage(payload) {
    if (!payload) {
      return "";
    }
    if (typeof payload.error === "string") {
      return payload.error;
    }
    if (payload.error && typeof payload.error.message === "string") {
      return payload.error.message;
    }
    if (payload.response && payload.response.error && payload.response.error.message) {
      return payload.response.error.message;
    }
    if (typeof payload.message === "string") {
      return payload.message;
    }
    return "";
  }

  function formatRequestError(error, wasAborted) {
    if (wasAborted) {
      return "生成已停止。";
    }
    const message = error && error.message ? error.message : "未知错误";
    if (/failed to fetch|load failed|networkerror/i.test(message)) {
      return (
        "无法连接接口。请检查地址、网络和第三方服务的跨域设置。\n\n" +
        "浏览器直连要求对方允许 CORS；如果仍失败，需要部署代理。\n\n技术信息：" +
        message
      );
    }
    return "请求失败：" + message;
  }

  function isConfigured() {
    return Boolean(config.endpoint && config.model);
  }

  function updateConnectionStatus() {
    const ready = isConfigured();
    elements.topSettingsButton.textContent = ready ? config.model : "未连接";
    elements.sidebarConnection.textContent = ready
      ? (config.protocol === "responses" ? "Responses API" : "Chat Completions")
      : "还没连接";
    elements.connectionStatus.classList.toggle("is-ready", connectionConfirmed);
    elements.connectionStatus.innerHTML = "";
    const dot = document.createElement("i");
    const text = document.createElement("span");
    text.textContent = !ready
      ? "等待配置接口"
      : connectionConfirmed
        ? "刚刚连接成功"
        : "已配置 · 等待请求";
    elements.connectionStatus.append(dot, text);
  }

  function openSettings() {
    elements.endpointInput.value = config.endpoint;
    elements.protocolInput.value = config.protocol;
    elements.modelInput.value = config.model;
    elements.apiKeyInput.value = "";
    elements.apiKeyInput.placeholder = apiKey ? "已保存，留空则保持当前 Key" : "只保存在你的 iPad 上";
    elements.systemPromptInput.value = config.systemPrompt;
    elements.maxTokensInput.value = String(config.maxTokens);
    elements.temperatureInput.value = String(config.temperature);
    elements.rememberKeyInput.checked = config.rememberKey;
    elements.streamInput.checked = config.stream;
    elements.settingsResult.textContent = "";
    elements.settingsResult.className = "settings-result";
    closeSidebar();

    if (typeof elements.settingsDialog.showModal === "function") {
      elements.settingsDialog.showModal();
    } else {
      elements.settingsDialog.setAttribute("open", "");
    }
  }

  function closeSettings() {
    if (typeof elements.settingsDialog.close === "function") {
      elements.settingsDialog.close();
    } else {
      elements.settingsDialog.removeAttribute("open");
    }
  }

  function getDraftConfig() {
    return {
      endpoint: elements.endpointInput.value.trim(),
      protocol: elements.protocolInput.value === "responses" ? "responses" : "chat",
      model: elements.modelInput.value.trim(),
      systemPrompt:
        elements.systemPromptInput.value.trim() || DEFAULT_SYSTEM_PROMPT,
      maxTokens: clampNumber(elements.maxTokensInput.value, 128, 32768, 4096),
      temperature: clampNumber(elements.temperatureInput.value, 0, 2, 0.7),
      rememberKey: elements.rememberKeyInput.checked,
      stream: elements.streamInput.checked,
    };
  }

  function validateDraft(draft) {
    let parsed;
    try {
      parsed = new URL(draft.endpoint);
    } catch (_error) {
      return "接口地址格式不正确。";
    }
    const localHttp =
      parsed.protocol === "http:" &&
      (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost");
    if (parsed.protocol !== "https:" && !localHttp) {
      return "接口地址必须使用 HTTPS。";
    }
    if (!draft.model) {
      return "请填写模型名称。";
    }
    return "";
  }

  function saveSettings(event) {
    event.preventDefault();
    const draft = getDraftConfig();
    const validationError = validateDraft(draft);
    if (validationError) {
      showSettingsResult(validationError, "error");
      return;
    }

    const newKey = elements.apiKeyInput.value.trim();
    if (newKey) {
      apiKey = newKey;
    }
    config = draft;
    try {
      localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
      if (draft.rememberKey) {
        localStorage.setItem(KEY_STORAGE_KEY, apiKey);
        sessionStorage.removeItem(KEY_STORAGE_KEY);
      } else {
        sessionStorage.setItem(KEY_STORAGE_KEY, apiKey);
        localStorage.removeItem(KEY_STORAGE_KEY);
      }
    } catch (_error) {
      showSettingsResult("浏览器无法保存设置，请检查存储权限。", "error");
      return;
    }

    connectionConfirmed = false;
    updateConnectionStatus();
    closeSettings();
    showToast("接口设置已保存。");
  }

  async function testConnection() {
    const draft = getDraftConfig();
    const validationError = validateDraft(draft);
    if (validationError) {
      showSettingsResult(validationError, "error");
      return;
    }
    const key = elements.apiKeyInput.value.trim() || apiKey;
    elements.testConnectionButton.disabled = true;
    showSettingsResult("正在连接并请求一个最小回复…", "");

    try {
      let output = "";
      await requestAssistant(
        Object.assign({}, draft, { stream: false, maxTokens: Math.min(draft.maxTokens, 128) }),
        key,
        [{ role: "user", content: "只回复：连接成功" }],
        function (text) {
          output += text;
        }
      );
      showSettingsResult("连接成功" + (output ? "：" + output.slice(0, 80) : ""), "success");
    } catch (error) {
      showSettingsResult(formatRequestError(error, false), "error");
    } finally {
      elements.testConnectionButton.disabled = false;
    }
  }

  function showSettingsResult(message, type) {
    elements.settingsResult.textContent = message;
    elements.settingsResult.className =
      "settings-result" +
      (type === "error" ? " is-error" : type === "success" ? " is-success" : "");
  }

  function clearLocalData() {
    if (
      !window.confirm(
        "这会删除所有本机对话、接口配置和已保存的 API Key。是否继续？"
      )
    ) {
      return;
    }
    try {
      localStorage.removeItem(CONFIG_STORAGE_KEY);
      localStorage.removeItem(KEY_STORAGE_KEY);
      localStorage.removeItem(CHAT_STORAGE_KEY);
      sessionStorage.removeItem(KEY_STORAGE_KEY);
    } catch (_error) {
      // Reloading still gives the user a clean session.
    }
    chatStore = { activeId: "", items: [] };
    config = Object.assign({}, DEFAULT_CONFIG);
    apiKey = "";
    connectionConfirmed = false;
    ensureConversation();
    renderConversations();
    renderCurrentConversation();
    updateConnectionStatus();
    closeSettings();
    showToast("本机数据已清除。");
  }

  function persistChats() {
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      try {
        localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatStore));
      } catch (_error) {
        showToast("对话保存失败，请导出重要内容。");
      }
    }, 180);
  }

  function resizePrompt() {
    elements.promptInput.style.height = "auto";
    elements.promptInput.style.height =
      Math.min(elements.promptInput.scrollHeight, 170) + "px";
  }

  function openSidebar() {
    elements.sidebar.classList.add("is-open");
    elements.backdrop.hidden = false;
  }

  function closeSidebar() {
    elements.sidebar.classList.remove("is-open");
    elements.backdrop.hidden = true;
  }

  function copyText(text, message) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () {
          showToast(message);
        },
        function () {
          showToast("复制失败，请长按内容手动复制。");
        }
      );
      return;
    }
    const field = document.createElement("textarea");
    field.value = text;
    field.style.position = "fixed";
    field.style.opacity = "0";
    document.body.append(field);
    field.select();
    const copied = document.execCommand("copy");
    field.remove();
    showToast(copied ? message : "复制失败，请长按内容手动复制。");
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.classList.add("is-visible");
    toastTimer = window.setTimeout(function () {
      elements.toast.classList.remove("is-visible");
    }, 3000);
  }

  function clampNumber(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
      return fallback;
    }
    return Math.min(max, Math.max(min, number));
  }

  function registerServiceWorker() {
    if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
      window.addEventListener("load", function () {
        navigator.serviceWorker.register("./sw.js").catch(function () {
          // Online chat still works when offline installation is unavailable.
        });
      });
    }
  }
})();
