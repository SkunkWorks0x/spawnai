(function () {
  "use strict";

  // ── Config from script tag ──────────────────────────────────────────
  var scriptTag =
    document.currentScript ||
    document.querySelector('script[data-agent][src*="embed.js"]');
  if (!scriptTag) return;

  var AGENT_SLUG = scriptTag.getAttribute("data-agent");
  if (!AGENT_SLUG) return;

  var BASE_URL = scriptTag.src.replace(/\/embed\.js.*$/, "");
  var POSITION = scriptTag.getAttribute("data-position") || "bottom-right";
  var BRAND_COLOR = scriptTag.getAttribute("data-color") || "#6366f1";
  var GREETING_OVERRIDE = scriptTag.getAttribute("data-greeting") || "";

  var STORAGE_KEY = "spawnai_" + AGENT_SLUG;

  // ── Helpers ─────────────────────────────────────────────────────────
  function store(key, val) {
    try {
      localStorage.setItem(STORAGE_KEY + "_" + key, JSON.stringify(val));
    } catch (_) {}
  }
  function load(key) {
    try {
      var v = localStorage.getItem(STORAGE_KEY + "_" + key);
      return v ? JSON.parse(v) : null;
    } catch (_) {
      return null;
    }
  }
  function uuid() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
    });
  }

  // ── State ───────────────────────────────────────────────────────────
  var agentName = "";
  var agentDesc = "";
  var welcomeMsg = "";
  var sessionId = load("session_id") || uuid();
  store("session_id", sessionId);
  var conversationId = load("conversation_id") || null;
  var messages = load("messages") || [];
  var isOpen = load("widget_open") === true;
  var configLoaded = false;
  var sending = false;

  // ── CSS ─────────────────────────────────────────────────────────────
  var posRight = POSITION === "bottom-left" ? "auto" : "20px";
  var posLeft = POSITION === "bottom-left" ? "20px" : "auto";
  var originX = POSITION === "bottom-left" ? "left bottom" : "right bottom";

  var css = '\
@keyframes spawnai-pulse{0%,100%{box-shadow:0 0 0 0 ' + BRAND_COLOR + '66}70%{box-shadow:0 0 0 12px ' + BRAND_COLOR + '00}}\
@keyframes spawnai-slidein{from{opacity:0;transform:translateY(16px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}\
@keyframes spawnai-slideout{from{opacity:1;transform:translateY(0) scale(1)}to{opacity:0;transform:translateY(16px) scale(0.95)}}\
@keyframes spawnai-bounce1{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}\
@keyframes spawnai-bounce2{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}\
@keyframes spawnai-bounce3{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}}\
#spawnai-widget *{margin:0;padding:0;box-sizing:border-box;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;-webkit-font-smoothing:antialiased}\
#spawnai-toggle{position:fixed;bottom:20px;right:' + posRight + ';left:' + posLeft + ';width:56px;height:56px;border-radius:50%;background:' + BRAND_COLOR + ';border:none;cursor:pointer;z-index:999999;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,0.3);transition:transform 0.2s;animation:spawnai-pulse 2s ease-in-out 3}\
#spawnai-toggle:hover{transform:scale(1.08)}\
#spawnai-toggle svg{width:26px;height:26px;fill:white}\
#spawnai-toggle .spawnai-close-icon{display:none}\
#spawnai-toggle.spawnai-active .spawnai-chat-icon{display:none}\
#spawnai-toggle.spawnai-active .spawnai-close-icon{display:block}\
#spawnai-toggle .spawnai-tooltip{position:absolute;bottom:64px;' + (POSITION === "bottom-left" ? "left" : "right") + ':0;background:#1e293b;color:#f1f5f9;font-size:13px;padding:6px 12px;border-radius:8px;white-space:nowrap;opacity:0;pointer-events:none;transition:opacity 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.3)}\
#spawnai-toggle:hover .spawnai-tooltip{opacity:1}\
#spawnai-panel{position:fixed;bottom:88px;right:' + posRight + ';left:' + posLeft + ';width:380px;height:520px;background:#0f172a;border:1px solid #1e293b;border-radius:16px;z-index:999999;display:none;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px rgba(0,0,0,0.5);transform-origin:' + originX + '}\
#spawnai-panel.spawnai-open{display:flex;animation:spawnai-slidein 0.25s ease-out forwards}\
#spawnai-panel.spawnai-closing{display:flex;animation:spawnai-slideout 0.2s ease-in forwards}\
#spawnai-header{padding:14px 16px;background:#1e293b;display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #334155}\
#spawnai-header-info h3{color:#f1f5f9;font-size:15px;font-weight:600}\
#spawnai-header-info p{color:#94a3b8;font-size:12px;margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:260px}\
#spawnai-header button{background:none;border:none;cursor:pointer;color:#94a3b8;padding:4px}\
#spawnai-header button:hover{color:white}\
#spawnai-messages{flex:1;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px}\
#spawnai-messages::-webkit-scrollbar{width:4px}\
#spawnai-messages::-webkit-scrollbar-track{background:transparent}\
#spawnai-messages::-webkit-scrollbar-thumb{background:#334155;border-radius:4px}\
.spawnai-msg{max-width:85%;padding:10px 14px;border-radius:16px;font-size:14px;line-height:1.5;word-wrap:break-word;white-space:pre-wrap}\
.spawnai-msg-assistant{align-self:flex-start;background:#1e293b;color:#e2e8f0}\
.spawnai-msg-user{align-self:flex-end;background:' + BRAND_COLOR + ';color:white}\
.spawnai-typing{display:inline-flex;gap:4px;padding:10px 14px;align-self:flex-start;background:#1e293b;border-radius:16px}\
.spawnai-typing span{width:7px;height:7px;background:#64748b;border-radius:50%;display:block}\
.spawnai-typing span:nth-child(1){animation:spawnai-bounce1 1.2s infinite}\
.spawnai-typing span:nth-child(2){animation:spawnai-bounce2 1.2s infinite 0.15s}\
.spawnai-typing span:nth-child(3){animation:spawnai-bounce3 1.2s infinite 0.3s}\
.spawnai-error{align-self:center;color:#f87171;font-size:13px;cursor:pointer;padding:6px 12px;border-radius:8px;background:#1e293b}\
#spawnai-input-row{display:flex;gap:8px;padding:12px 16px;border-top:1px solid #1e293b;background:#0f172a}\
#spawnai-input{flex:1;background:#1e293b;border:1px solid #334155;border-radius:12px;padding:10px 14px;color:#f1f5f9;font-size:14px;outline:none;resize:none}\
#spawnai-input::placeholder{color:#64748b}\
#spawnai-input:focus{border-color:' + BRAND_COLOR + '}\
#spawnai-send{width:40px;height:40px;border-radius:10px;background:' + BRAND_COLOR + ';border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:opacity 0.15s}\
#spawnai-send:disabled{opacity:0.4;cursor:not-allowed}\
#spawnai-send svg{width:18px;height:18px;fill:white}\
#spawnai-footer{text-align:center;padding:8px;border-top:1px solid #1e293b}\
#spawnai-footer a{color:#64748b;font-size:11px;text-decoration:none;transition:color 0.15s}\
#spawnai-footer a:hover{color:#94a3b8}\
@media(max-width:640px){\
#spawnai-panel.spawnai-open,#spawnai-panel.spawnai-closing{position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;border-radius:0;border:none}\
#spawnai-header{padding:16px}\
#spawnai-back-btn{display:block !important}\
}\
';

  // ── DOM ──────────────────────────────────────────────────────────────
  var container = document.createElement("div");
  container.id = "spawnai-widget";

  var style = document.createElement("style");
  style.textContent = css;
  container.appendChild(style);

  // Toggle button
  var toggle = document.createElement("button");
  toggle.id = "spawnai-toggle";
  toggle.setAttribute("aria-label", "Open chat");
  toggle.innerHTML = '\
<span class="spawnai-tooltip"></span>\
<svg class="spawnai-chat-icon" viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z"/><path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z"/></svg>\
<svg class="spawnai-close-icon" viewBox="0 0 24 24" width="22" height="22"><path d="M18.3 5.71a1 1 0 00-1.41 0L12 10.59 7.11 5.7A1 1 0 005.7 7.11L10.59 12 5.7 16.89a1 1 0 101.41 1.41L12 13.41l4.89 4.89a1 1 0 001.41-1.41L13.41 12l4.89-4.89a1 1 0 000-1.4z"/></svg>';
  container.appendChild(toggle);

  // Panel
  var panel = document.createElement("div");
  panel.id = "spawnai-panel";
  panel.innerHTML = '\
<div id="spawnai-header">\
<div style="display:flex;align-items:center;gap:10px;min-width:0">\
<button id="spawnai-back-btn" style="display:none;background:none;border:none;color:#94a3b8;cursor:pointer;padding:2px" aria-label="Close">\
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5"/></svg>\
</button>\
<div id="spawnai-header-info"><h3></h3><p></p></div>\
</div>\
<button id="spawnai-close-btn" aria-label="Close">\
<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>\
</button>\
</div>\
<div id="spawnai-messages"></div>\
<div id="spawnai-input-row">\
<input id="spawnai-input" type="text" placeholder="Type a message..." />\
<button id="spawnai-send" aria-label="Send"><svg viewBox="0 0 24 24"><path d="M3.27 20.88L21.49 12 3.27 3.12v6.97l12.34 1.9-12.34 1.9v6.99z"/></svg></button>\
</div>\
<div id="spawnai-footer"><a href="' + BASE_URL + '/?ref=embed&agent=' + AGENT_SLUG + '" target="_blank" rel="noopener">Powered by SpawnAI \u2726</a></div>';
  container.appendChild(panel);

  document.body.appendChild(container);

  // ── Refs ─────────────────────────────────────────────────────────────
  var msgContainer = panel.querySelector("#spawnai-messages");
  var inputEl = panel.querySelector("#spawnai-input");
  var sendBtn = panel.querySelector("#spawnai-send");
  var headerName = panel.querySelector("#spawnai-header-info h3");
  var headerDesc = panel.querySelector("#spawnai-header-info p");
  var closeBtn = panel.querySelector("#spawnai-close-btn");
  var backBtn = panel.querySelector("#spawnai-back-btn");
  var tooltip = toggle.querySelector(".spawnai-tooltip");

  // ── Render messages ─────────────────────────────────────────────────
  function renderMessages() {
    msgContainer.innerHTML = "";
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      var el = document.createElement("div");
      el.className = "spawnai-msg spawnai-msg-" + m.role;
      el.textContent = m.content;
      msgContainer.appendChild(el);
    }
    scrollToBottom();
  }

  function appendMessage(role, content) {
    messages.push({ role: role, content: content });
    store("messages", messages);
    var el = document.createElement("div");
    el.className = "spawnai-msg spawnai-msg-" + role;
    el.textContent = content;
    msgContainer.appendChild(el);
    scrollToBottom();
    return el;
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "spawnai-typing";
    el.id = "spawnai-typing-indicator";
    el.innerHTML = "<span></span><span></span><span></span>";
    msgContainer.appendChild(el);
    scrollToBottom();
  }

  function hideTyping() {
    var el = msgContainer.querySelector("#spawnai-typing-indicator");
    if (el) el.remove();
  }

  function showError() {
    var el = document.createElement("div");
    el.className = "spawnai-error";
    el.textContent = "Connection lost. Try again.";
    el.onclick = function () {
      el.remove();
    };
    msgContainer.appendChild(el);
    scrollToBottom();
  }

  function showLimitError() {
    var el = document.createElement("div");
    el.className = "spawnai-msg spawnai-msg-assistant";
    el.style.background = "#422006";
    el.style.color = "#fcd34d";
    el.style.fontSize = "13px";
    el.textContent = "This agent has reached its daily limit. It\u2019ll be back tomorrow, or the owner can upgrade at spawnai.now/pricing.";
    msgContainer.appendChild(el);
    inputEl.disabled = true;
    sendBtn.disabled = true;
    scrollToBottom();
  }

  function scrollToBottom() {
    requestAnimationFrame(function () {
      msgContainer.scrollTop = msgContainer.scrollHeight;
    });
  }

  // ── Open / Close ────────────────────────────────────────────────────
  function openWidget() {
    isOpen = true;
    store("widget_open", true);
    panel.classList.remove("spawnai-closing");
    panel.classList.add("spawnai-open");
    toggle.classList.add("spawnai-active");
    inputEl.focus();
    if (!configLoaded) fetchConfig();
  }

  function closeWidget() {
    isOpen = false;
    store("widget_open", false);
    toggle.classList.remove("spawnai-active");
    panel.classList.add("spawnai-closing");
    panel.addEventListener(
      "animationend",
      function handler() {
        panel.removeEventListener("animationend", handler);
        panel.classList.remove("spawnai-open", "spawnai-closing");
      },
      { once: true }
    );
  }

  toggle.onclick = function () {
    if (isOpen) closeWidget();
    else openWidget();
  };

  closeBtn.onclick = closeWidget;
  backBtn.onclick = closeWidget;

  // ── Fetch agent config ──────────────────────────────────────────────
  function fetchConfig() {
    fetch(BASE_URL + "/api/agents/" + AGENT_SLUG, {
      mode: "cors",
      credentials: "omit",
    })
      .then(function (r) {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then(function (data) {
        configLoaded = true;
        agentName = data.name || AGENT_SLUG;
        agentDesc = data.short_description || "";
        welcomeMsg = GREETING_OVERRIDE || data.welcome_message || "Hi! How can I help?";

        headerName.textContent = agentName;
        headerDesc.textContent = agentDesc;
        tooltip.textContent = agentName;

        if (messages.length === 0) {
          appendMessage("assistant", welcomeMsg);
        }
      })
      .catch(function () {
        configLoaded = true;
        headerName.textContent = AGENT_SLUG;
        tooltip.textContent = AGENT_SLUG;
        if (messages.length === 0) {
          appendMessage("assistant", GREETING_OVERRIDE || "Hi! How can I help?");
        }
      });
  }

  // ── Send message ────────────────────────────────────────────────────
  function sendMessage() {
    var text = inputEl.value.trim();
    if (!text || sending) return;
    sending = true;
    sendBtn.disabled = true;

    appendMessage("user", text);
    inputEl.value = "";
    showTyping();

    fetch(BASE_URL + "/api/chat", {
      method: "POST",
      mode: "cors",
      credentials: "omit",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_slug: AGENT_SLUG,
        message: text,
        session_id: sessionId,
        conversation_id: conversationId,
      }),
    })
      .then(function (res) {
        if (!res.ok) throw new Error("request failed");
        var reader = res.body.getReader();
        var decoder = new TextDecoder();
        var buffer = "";
        var assistantEl = null;
        var assistantText = "";
        var firstChunk = true;

        function read() {
          reader.read().then(function (result) {
            if (result.done) {
              finishSend(assistantText);
              return;
            }

            buffer += decoder.decode(result.value, { stream: true });
            var lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (var i = 0; i < lines.length; i++) {
              var line = lines[i].trim();
              if (!line.startsWith("data: ")) continue;
              try {
                var data = JSON.parse(line.slice(6));
                if (data.text) {
                  if (firstChunk) {
                    hideTyping();
                    assistantEl = document.createElement("div");
                    assistantEl.className = "spawnai-msg spawnai-msg-assistant";
                    msgContainer.appendChild(assistantEl);
                    firstChunk = false;
                  }
                  assistantText += data.text;
                  assistantEl.textContent = assistantText;
                  scrollToBottom();
                }
                if (data.done && data.conversation_id) {
                  conversationId = data.conversation_id;
                  store("conversation_id", conversationId);
                }
                if (data.error === "limit_reached") {
                  hideTyping();
                  showLimitError();
                } else if (data.error) {
                  hideTyping();
                  showError();
                }
              } catch (_) {}
            }
            read();
          }).catch(function () {
            hideTyping();
            showError();
            finishSend(assistantText);
          });
        }

        read();
      })
      .catch(function () {
        hideTyping();
        showError();
        finishSend("");
      });
  }

  function finishSend(text) {
    sending = false;
    sendBtn.disabled = false;
    if (text) {
      messages.push({ role: "assistant", content: text });
      store("messages", messages);
    }
    inputEl.focus();
  }

  // ── Event Listeners ─────────────────────────────────────────────────
  sendBtn.onclick = sendMessage;

  inputEl.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) closeWidget();
  });

  // ── Init ────────────────────────────────────────────────────────────
  tooltip.textContent = AGENT_SLUG;

  if (messages.length > 0) {
    renderMessages();
    // Restore header from config
    fetchConfig();
  }

  if (isOpen) {
    openWidget();
  }
})();
