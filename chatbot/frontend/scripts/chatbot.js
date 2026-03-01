const OPENROUTER_API_KEY = "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";
const CHATBOT_SITE_URL  = "https://ravenchatbot.com";
const CHATBOT_SITE_NAME = "Vertiscan";
const CHATBOT_MODEL     = "openai/gpt-3.5-turbo";

/* ════════════════════════════════════════════════════════════════════════════
   USER NAME  (localStorage)
   ════════════════════════════════════════════════════════════════════════════ */
const NAME_KEY = "veritascan_user_name";

function getSavedName() {
  return localStorage.getItem(NAME_KEY) || null;
}

function saveName(name) {
  localStorage.setItem(NAME_KEY, name.trim());
}

function applyUserName(name) {
  const greetingDisplay = document.getElementById("greeting-display");
  if (greetingDisplay) {
    greetingDisplay.textContent = `Hello, ${name}!`;
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   GREETING OVERLAY — CONVERSATIONAL TYPING SEQUENCE
   ════════════════════════════════════════════════════════════════════════════ */

/* Utility: type text character by character into an element */
function typeInto(el, text, speed = 28) {
  return new Promise(resolve => {
    let i = 0;
    el.textContent = "";
    const tick = () => {
      if (i < text.length) {
        el.textContent += text[i++];
        setTimeout(tick, speed);
      } else {
        resolve();
      }
    };
    tick();
  });
}

/* Utility: show a typing indicator bubble, returns the bubble element */
function showTypingIndicator(container) {
  const msg = document.createElement("div");
  msg.classList.add("greeting-msg");

  const avatar = document.createElement("div");
  avatar.classList.add("greeting-msg-avatar");
  avatar.innerHTML = `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="10" cy="10" r="6"/><path d="m21 21-4.35-4.35"/><path d="m7.5 10 2 2 3-3"/>
  </svg>`;

  const bubble = document.createElement("div");
  bubble.classList.add("greeting-msg-bubble");
  bubble.innerHTML = `<div class="greeting-typing-dots">
    <span></span><span></span><span></span>
  </div>`;

  msg.appendChild(avatar);
  msg.appendChild(bubble);
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;

  return { msg, bubble };
}

/* Utility: replace typing indicator with real text, typed out */
async function resolveTypingBubble(bubble, text, speed = 26) {
  bubble.innerHTML = "";
  await typeInto(bubble, text, speed);
}

/* Utility: append a user reply bubble (right-aligned) */
function appendUserBubble(container, text) {
  const msg = document.createElement("div");
  msg.classList.add("greeting-msg", "user-reply");
  const bubble = document.createElement("div");
  bubble.classList.add("greeting-msg-bubble");
  bubble.textContent = text;
  msg.appendChild(bubble);
  container.appendChild(msg);
  container.scrollTop = container.scrollHeight;
}

/* The full conversational sequence */
async function runGreetingSequence() {
  const overlay   = document.getElementById("greeting-overlay");
  const container = document.getElementById("greeting-messages");
  const inputArea = document.getElementById("greeting-input-area");
  const nameInput = document.getElementById("greeting-name-input");
  const submitBtn = document.getElementById("greeting-submit-btn");

  if (!overlay || !container || !inputArea || !nameInput || !submitBtn) return;

  /* Messages the AI will "say" one by one */
  const messages = [
    { text: "Hey there! 👋", delay: 500,  typingPause: 650 },
    { text: "I'm Veritascan — your AI fact-checking assistant.", delay: 900,  typingPause: 1100 },
    { text: "Before we start, what should I call you?", delay: 800, typingPause: 950 },
  ];

  for (const msg of messages) {
    /* Wait before showing typing indicator */
    await new Promise(r => setTimeout(r, msg.delay));

    /* Show typing dots */
    const { bubble } = showTypingIndicator(container);

    /* Simulate thinking time */
    await new Promise(r => setTimeout(r, msg.typingPause));

    /* Replace dots with typed-out text */
    await resolveTypingBubble(bubble, msg.text);
  }

  /* Reveal input after a short beat */
  await new Promise(r => setTimeout(r, 300));
  inputArea.classList.add("visible");
  setTimeout(() => nameInput.focus(), 350);

  /* Enable / disable send button */
  nameInput.addEventListener("input", () => {
    submitBtn.disabled = nameInput.value.trim().length === 0;
  });

  /* Dismiss handler */
  const dismiss = async () => {
    const name = nameInput.value.trim();
    if (!name) return;

    saveName(name);
    applyUserName(name);

    /* Show user's reply bubble */
    appendUserBubble(container, name);

    /* Wait a beat, then show final AI message */
    await new Promise(r => setTimeout(r, 500));
    const { bubble: lastBubble } = showTypingIndicator(container);
    await new Promise(r => setTimeout(r, 700));
    await resolveTypingBubble(lastBubble, `Nice to meet you, ${name}! Let's get started. 🔍`);

    /* Dismiss overlay after a moment */
    await new Promise(r => setTimeout(r, 900));
    overlay.classList.add("hide");
    setTimeout(() => { overlay.style.display = "none"; }, 520);
  };

  submitBtn.addEventListener("click", dismiss);
  nameInput.addEventListener("keydown", e => {
    if (e.key === "Enter" && nameInput.value.trim().length > 0) dismiss();
  });
}

function initGreetingOverlay() {
  const overlay = document.getElementById("greeting-overlay");
  if (!overlay) return;

  const savedName = getSavedName();

  if (savedName) {
    overlay.style.display = "none";
    applyUserName(savedName);
    return;
  }

  /* Kick off the conversational sequence */
  runGreetingSequence();
}

/* ════════════════════════════════════════════════════════════════════════════
   CHAT HISTORY  (localStorage — no database needed)
   ════════════════════════════════════════════════════════════════════════════ */
const HISTORY_KEY  = "veritascan_chat_history";
const MAX_HISTORY  = 30;

function loadHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(history) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
  catch { console.warn("localStorage write failed."); }
}

function addToHistory(userText, botText) {
  const history = loadHistory();
  history.unshift({
    id       : Date.now(),
    userText : userText.slice(0, 120),
    botText  : botText.slice(0, 400),
    timestamp: new Date().toLocaleString("en-PH", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit"
    })
  });
  if (history.length > MAX_HISTORY) history.splice(MAX_HISTORY);
  saveHistory(history);
  renderHistory();
}

function deleteHistoryEntry(id) {
  saveHistory(loadHistory().filter(e => e.id !== id));
  renderHistory();
}

function renderHistory() {
  const list    = document.getElementById("history-list");
  const empty   = document.getElementById("history-empty");
  const history = loadHistory();
  if (!list) return;

  list.querySelectorAll(".history-item").forEach(el => el.remove());

  if (history.length === 0) {
    if (empty) empty.style.display = "flex";
    return;
  }
  if (empty) empty.style.display = "none";

  history.forEach(entry => {
    const item = document.createElement("div");
    item.classList.add("history-item");
    item.dataset.id = entry.id;

    const preview = entry.userText.length > 52
      ? entry.userText.slice(0, 52) + "…"
      : entry.userText;

    item.innerHTML = `
      <div class="history-item-body">
        <span class="history-item-preview">${escHtml(preview)}</span>
        <span class="history-item-time">${entry.timestamp}</span>
      </div>
      <button class="history-item-del" data-id="${entry.id}" title="Remove">
        <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>`;

    item.addEventListener("click", e => {
      if (e.target.closest(".history-item-del")) return;
      restoreEntry(entry);
    });

    item.querySelector(".history-item-del").addEventListener("click", e => {
      e.stopPropagation();
      deleteHistoryEntry(entry.id);
    });

    list.appendChild(item);
  });
}

function restoreEntry(entry) {
  const mainContainer = document.querySelector(".main-conversation");
  const introBox      = document.querySelector(".conversation-box");
  if (!mainContainer) return;

  if (introBox) introBox.remove();
  mainContainer.innerHTML = "";

  const userDiv = document.createElement("div");
  userDiv.classList.add("user");
  const userP = document.createElement("p");
  userP.textContent = entry.userText;
  userDiv.appendChild(userP);
  mainContainer.appendChild(userDiv);

  const botDiv = document.createElement("div");
  botDiv.classList.add("chatbot");
  const botP = document.createElement("p");
  botP.innerHTML = formatVeritascanOutput(entry.botText)
    + `<span class="history-restored-badge">📂 Restored from history</span>`;
  botDiv.appendChild(botP);
  mainContainer.appendChild(botDiv);

  mainContainer.scrollTop = mainContainer.scrollHeight;
}

function escHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ════════════════════════════════════════════════════════════════════════════
   INIT ON DOM READY
   ════════════════════════════════════════════════════════════════════════════ */
document.addEventListener("DOMContentLoaded", () => {
  const container = document.querySelector(".chatpane-container");
  const input     = document.getElementById("user-chatbox-input");

  /* ── Greeting overlay ── */
  initGreetingOverlay();

  /* Focus ring on input */
  if (container && input) {
    input.addEventListener("focus", () => container.classList.add("focused"));
    input.addEventListener("blur",  () => {
      if (!input.value.trim()) container.classList.remove("focused");
    });
    document.addEventListener("keydown", e => {
      if (e.key === "Escape" && document.activeElement === input) input.blur();
    });
  }

  /* Render history sidebar */
  renderHistory();

  /* Clear all history */
  document.getElementById("history-clear-btn")?.addEventListener("click", () => {
    if (confirm("Clear all chat history?")) {
      localStorage.removeItem(HISTORY_KEY);
      renderHistory();
    }
  });

  /* Prompt chips — fill input and focus */
  document.querySelectorAll(".prompt-item[data-prompt]").forEach(btn => {
    btn.addEventListener("click", () => {
      const prompt = btn.dataset.prompt || "";
      if (input) {
        input.value = prompt;
        input.focus();
        input.selectionStart = input.selectionEnd = input.value.length;
      }
    });
  });
});

/* ════════════════════════════════════════════════════════════════════════════
   HELPERS
   ════════════════════════════════════════════════════════════════════════════ */
function scrollToBottom() {
  const c = document.querySelector(".main-conversation");
  if (c) c.scrollTop = c.scrollHeight;
}

/* ════════════════════════════════════════════════════════════════════════════
   TYPING ANIMATION
   ════════════════════════════════════════════════════════════════════════════ */
function typingAnimation() {
  const heading = document.querySelector(".asking-section");
  if (!heading) return;

  const text = " How can I help?";
  let index = 0, deleting = false;

  function type() {
    if (!deleting) {
      heading.textContent += text[index++];
      if (index === text.length) { deleting = true; setTimeout(type, 2000); return; }
      setTimeout(type, 70);
    } else {
      heading.textContent = heading.textContent.slice(0, -1);
      index--;
      if (index === 0) { deleting = false; setTimeout(type, 1000); return; }
      setTimeout(type, 35);
    }
  }
  type();
}
typingAnimation();

/* ════════════════════════════════════════════════════════════════════════════
   MESSAGE RENDERING
   ════════════════════════════════════════════════════════════════════════════ */
function userMessage(msg) {
  const c = document.querySelector(".main-conversation");
  if (!c) return;
  const div = document.createElement("div");
  div.classList.add("user");
  const p = document.createElement("p");
  p.textContent = msg;
  div.appendChild(p);
  c.appendChild(div);
  c.scrollTop = c.scrollHeight;
}

export function userMessageImg(src) {
  const c = document.querySelector(".main-conversation");
  if (!c) return;
  const div = document.createElement("div");
  div.classList.add("user");
  const inner = document.createElement("div");
  inner.classList.add("user-image-container");
  const img = document.createElement("img");
  img.src = src;
  inner.appendChild(img);
  div.appendChild(inner);
  c.appendChild(div);
  img.onload = () => { c.scrollTop = c.scrollHeight; };
}

/* ════════════════════════════════════════════════════════════════════════════
   FORMAT VERITASCAN OUTPUT
   ════════════════════════════════════════════════════════════════════════════ */
function formatVeritascanOutput(text) {
  if (!isFormattedAnalysis(text)) return text.replace(/\n/g, "<br>");

  // Escape HTML FIRST, before any replacements
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // ── STEP 1: Bold the section headers BEFORE converting \n to <br>
  // This way we can still use line-based matching cleanly
  const headers = [
    "VERITASCAN AI — CREDIBILITY ANALYSIS REPORT",
    "Claim Summary:",
    "Final Classification:",
    "Credibility Score:",
    "Factual Verification Result:",
    "Explanation:",
    "Supporting Evidence and References:",
    "Final Verdict:",
    "Overall Confidence:",
  ];

  headers.forEach(h => {
    const esc   = h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Match the header at the start of a line (after newline or at start)
    const regex = new RegExp(`(^|\\n)(${esc})(\\n|$)`, "gm");
    html = html.replace(regex, (_, before, header, after) => {
      if (header === "Final Verdict:")
        return `${before}<strong class="header final-verdict-header">${header}</strong>${after}`;
      if (header === "Overall Confidence:")
        return `${before}<strong class="confidence-line">${header}</strong>${after}`;
      return `${before}<strong class="header">${header}</strong>${after}`;
    });
  });

  // ── STEP 2: Colorize inline verdict tags like [REAL], [FAKE], etc.
  // Do this BEFORE \n→<br> so lines are still clean
  html = html.replace(
    /\[(REAL|LIKELY REAL|UNCERTAIN|UNVERIFIABLE|MISLEADING|LIKELY FAKE|FAKE)\]/gi,
    (_, verdict) => {
      const key = verdict.toLowerCase().replace(/\s+/g, "-");
      return `<strong class="verdict-${key}">[${verdict}]</strong>`;
    }
  );

  // ── STEP 3: Now convert newlines to <br>
  html = html.replace(/\n/g, "<br>");

  // ── STEP 4: Colorize the verdict line AFTER "Final Verdict:" header
  // Now we match across <br> tags
  html = html.replace(
    /(<strong[^>]*class="[^"]*final-verdict-header[^"]*"[^>]*>Final Verdict:<\/strong>)(<br>)?\s*(REAL|LIKELY REAL|UNCERTAIN|UNVERIFIABLE|MISLEADING|LIKELY FAKE|FAKE)/gi,
    (_, headerPart, br, verdictText) => {
      const verdict = verdictText.trim();
      const key     = verdict.toLowerCase().replace(/\s+/g, "-");
      return `${headerPart}<br><strong class="verdict-${key}">${verdict}</strong>`;
    }
  );

  // ── STEP 5: Colorize confidence/score line after "Final Classification:"
  // e.g. "Final Classification:\nFAKE\nConfidence Level: 85%"
  html = html.replace(
    /(<strong[^>]*>Final Classification:<\/strong>)(<br>)?\s*(REAL|LIKELY REAL|UNCERTAIN|UNVERIFIABLE|MISLEADING|LIKELY FAKE|FAKE)/gi,
    (_, headerPart, br, verdictText) => {
      const verdict = verdictText.trim();
      const key     = verdict.toLowerCase().replace(/\s+/g, "-");
      return `${headerPart}<br><strong class="verdict-${key}">${verdict}</strong>`;
    }
  );

  // ── STEP 6: Colorize Factual Verification Result values
  html = html.replace(
    /(<strong[^>]*>Factual Verification Result:<\/strong>)(<br>)?\s*(CONFIRMED ACCURATE|CONFIRMED INACCURATE|PARTIALLY ACCURATE|CANNOT BE VERIFIED|DECEPTIVE FRAMING)/gi,
    (_, headerPart, br, resultText) => {
      const result = resultText.trim();
      const key    = result.toLowerCase().replace(/\s+/g, "-");
      return `${headerPart}<br><strong class="verdict-${key}">${result}</strong>`;
    }
  );

  return html;
}

function isFormattedAnalysis(text) {
  return (
    text.includes("VERITASCAN AI") ||
    text.includes("CREDIBILITY ANALYSIS REPORT") ||
    text.includes("Final Classification:") ||
    text.includes("Credibility Score:") ||
    text.includes("Final Verdict:")
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   NEWS REFERENCE CARD
   ════════════════════════════════════════════════════════════════════════════ */
function buildNewsCard(articles) {
  if (!articles?.length) return null;
  const links = articles.map(a =>
    `<a class="newsapi-link" href="${a.url}" target="_blank" rel="noopener">
       <span class="newsapi-link-source">${a.source || ""}</span>
       <span class="newsapi-link-title">${a.title || ""}</span>
     </a>`
  ).join("");
  return `<div class="newsapi-card">
    <span class="newsapi-label">📡 Related Articles</span>
    <div class="newsapi-links">${links}</div>
  </div>`;
}

function appendNewsReferences(articles, chatbotDiv) {
  const c = document.querySelector(".main-conversation");
  if (!articles?.length) return;
  const html = buildNewsCard(articles);
  if (!html) return;
  const w = document.createElement("div");
  w.innerHTML = html;
  chatbotDiv.appendChild(w.firstElementChild);
  if (c) c.scrollTop = c.scrollHeight;
}

/* ════════════════════════════════════════════════════════════════════════════
   MAIN sendToChatbot
   ════════════════════════════════════════════════════════════════════════════ */
export async function sendToChatbot(userMsg, existingP = null) {
  const c = document.querySelector(".main-conversation");
  if (!c) return;

  const messageDiv = document.createElement("div");
  messageDiv.classList.add("chatbot");

  let p;
  if (existingP) {
    p = existingP;
    messageDiv.appendChild(p);
  } else {
    p = document.createElement("p");
    p.textContent = "Typing...";
    messageDiv.appendChild(p);
  }

  c.appendChild(messageDiv);
  c.scrollTop = c.scrollHeight;

  try {
    const response = await fetch("http://localhost:3000/chat", {
      method : "POST",
      headers: { "Content-Type": "application/json" },
      body   : JSON.stringify({ message: userMsg, userName: getSavedName() || "User" })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data    = await response.json();
    const botText = data.message || "No reply received.";
    p.innerHTML   = formatVeritascanOutput(botText);

    console.log("RAW BOT RESPONSE:", botText);

    scrollToBottom();

    /* Save to localStorage history */
    addToHistory(userMsg, botText);

    if (isFormattedAnalysis(botText) && data.newsArticles?.length) {
      appendNewsReferences(data.newsArticles, messageDiv);
    }

  } catch (err) {
    console.error("Chat error:", err);
    p.textContent = "Error: Could not connect to chatbot. Is the server running?";
  }

  c.scrollTop = c.scrollHeight;
}

/* ════════════════════════════════════════════════════════════════════════════
   SEND MESSAGE HANDLER
   ════════════════════════════════════════════════════════════════════════════ */
function sendMessage() {
  const sendBtn = document.getElementById("send-btn");
  const input   = document.getElementById("user-chatbox-input");
  let introBox  = document.querySelector(".conversation-box");

  if (!sendBtn || !input) return;

  // ── Auto-resize textarea ──
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 150) + "px";
  });

  const handleSend = () => {
    const value = input.value.trim();
    if (!value) return;

    userMessage(value);
    sendToChatbot(value);

    input.value = "";
    input.style.height = "auto"; // reset pabalik sa 1 linya
    input.focus();

    if (introBox) { introBox.remove(); introBox = null; }
  };

  sendBtn.addEventListener("click", handleSend);
  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  });
}
sendMessage();

/* ════════════════════════════════════════════════════════════════════════════
   MIC / SPEECH TO TEXT
   ════════════════════════════════════════════════════════════════════════════ */
document.getElementById("mic-btn")?.addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Your browser does not support Speech Recognition"); return; }

  const r = new SR();
  r.continuous = false;
  r.interimResults = false;
  r.start();

  r.onresult = e => {
    const text = e.results[0][0].transcript;

    // ← dagdag lang ito
    const introBox = document.querySelector(".conversation-box");
    if (introBox) introBox.remove();

    userMessage(text);
    sendToChatbot(text);
  };
  r.onerror = e => console.error("Speech error:", e.error);
});

/* ════════════════════════════════════════════════════════════════════════════
   LINK BUTTON HANDLER
   ════════════════════════════════════════════════════════════════════════════ */
function extractText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  ["script","style","nav","footer","header","aside","iframe","noscript"]
    .forEach(t => doc.querySelectorAll(t).forEach(el => el.remove()));
  const main = doc.querySelector("article") || doc.querySelector("main") || doc.body;
  let text = (main?.innerText || main?.textContent || "").replace(/\s{2,}/g, " ").trim();
  if (text.length > 4000) text = text.slice(0, 4000) + "... [truncated]";
  return text.length > 100 ? text : null;
}

const linkBtn    = document.getElementById("link-btn-chatbot");
const linkModal  = document.getElementById("link-modal");
const linkInput  = document.getElementById("link-modal-input");
const linkSubmit = document.getElementById("link-modal-submit");
const linkClose  = document.getElementById("link-modal-close");

if (linkBtn && linkModal) {
  linkBtn.addEventListener("click", () => {
    linkModal.classList.add("active");
    linkInput.value = "";
    linkInput.focus();
  });
  linkClose.addEventListener("click", () => linkModal.classList.remove("active"));
  linkModal.addEventListener("click", e => {
    if (e.target === linkModal) linkModal.classList.remove("active");
  });

  const submitLink = async () => {
    const url = linkInput.value.trim();
    if (!url) return;

    try { new URL(url); } catch {
      linkInput.style.borderColor = "var(--danger)";
      linkInput.placeholder = "Invalid URL. Try again...";
      return;
    }

    linkInput.style.borderColor = "";
    linkModal.classList.remove("active");

    document.querySelector(".conversation-box")?.remove();

    userMessage(`🔗 ${url}`);

    const c           = document.querySelector(".main-conversation");
    const loadingDiv  = document.createElement("div");
    loadingDiv.classList.add("chatbot");
    const loadingP = document.createElement("p");
    loadingP.textContent = "🔍 Fetching and analyzing the link...";
    loadingDiv.appendChild(loadingP);
    c.appendChild(loadingDiv);
    c.scrollTop = c.scrollHeight;

    const blocked = ["facebook.com","fb.com","instagram.com","twitter.com","x.com","tiktok.com","linkedin.com"];
    if (blocked.some(d => url.includes(d))) {
      loadingDiv.remove();
      const div = document.createElement("div");
      div.classList.add("chatbot");
      const p = document.createElement("p");
      p.textContent = `⚠️ Content from ${new URL(url).hostname} cannot be directly accessed because it requires login or is restricted.\n\n📋 Try instead:\n• Copy and paste the text here\n• Upload a screenshot\n• Summarize the claim`;
      div.appendChild(p);
      c.appendChild(div);
      c.scrollTop = c.scrollHeight;
      return;
    }

    let content = null;
    try {
      const r = await fetch(url, { mode: "cors" });
      if (r.ok) content = extractText(await r.text());
    } catch { console.log("Client-side fetch blocked, trying server..."); }

    if (!content) {
      try {
        const r    = await fetch("http://localhost:3000/fetch-url", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url })
        });
        const data = await r.json();
        if (data.error) {
          loadingDiv.remove();
          const div = document.createElement("div");
          div.classList.add("chatbot");
          const p = document.createElement("p");
          p.textContent = "❌ This link could not be accessed.\n\nTry copying the article text and pasting it here instead.";
          div.appendChild(p);
          c.appendChild(div);
          c.scrollTop = c.scrollHeight;
          return;
        }
        content = data.content;
      } catch (err) {
        loadingP.textContent = "❌ Could not connect to server.";
        return;
      }
    }

    loadingDiv.remove();
    await sendToChatbot(`Please analyze and fact-check this article/content from the URL: ${url}\n\n---\n${content}`);
  };

  linkSubmit.addEventListener("click", submitLink);
  linkInput.addEventListener("keydown", e => { if (e.key === "Enter") submitLink(); });
}

const inputEl = document.getElementById("user-chatbox-input");

if (inputEl) {
  inputEl.addEventListener("input", () => {
    inputEl.style.height = "auto";           // i-reset muna
    inputEl.style.height = Math.min(inputEl.scrollHeight, 150) + "px"; // taasan hanggang max
  });
}

document.getElementById("remove-file-btn")?.addEventListener("click", () => {
  // Clear the file input
  document.getElementById("file-input").value = "";
  
  // Clear preview
  document.getElementById("preview").src = "";
  document.getElementById("file-name").textContent = "";
  
  // Hide the preview container
  document.querySelector(".file-preview-wrapper-container").style.display = "none";
});

