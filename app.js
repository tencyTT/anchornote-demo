const STORAGE_KEY = "anchornote.webDemo.bookmarks";

const colors = [
  { bg: "#fff5cf", accent: "#f6bd18", text: "#7a5200" },
  { bg: "#e7f8ff", accent: "#1f6feb", text: "#1559ce" },
  { bg: "#e5fbf4", accent: "#18b99a", text: "#087967" },
  { bg: "#ffe8ef", accent: "#f45b69", text: "#bf2541" },
  { bg: "#f0e9ff", accent: "#8757e8", text: "#6533c9" }
];

const page = {
  id: "qqnews.demo/tech/anchornote-ai-bookmark",
  title: "AI 语义书签：让网页阅读可以真正回到“当时那句话”",
  url: "qqnews.demo/tech/anchornote-ai-bookmark"
};

const els = {
  article: document.querySelector("#article"),
  readerView: document.querySelector("#readerView"),
  libraryView: document.querySelector("#libraryView"),
  libraryGrid: document.querySelector("#libraryGrid"),
  librarySearch: document.querySelector("#librarySearch"),
  libraryButton: document.querySelector("#libraryButton"),
  resetButton: document.querySelector("#resetButton"),
  selectionBubble: document.querySelector("#selectionBubble"),
  noteDialog: document.querySelector("#noteDialog"),
  dialogTitle: document.querySelector("#dialogTitle"),
  dialogQuote: document.querySelector("#dialogQuote"),
  noteInput: document.querySelector("#noteInput"),
  cancelSave: document.querySelector("#cancelSave"),
  confirmSave: document.querySelector("#confirmSave"),
  stickyRail: document.querySelector("#stickyRail")
};

const state = {
  bookmarks: loadBookmarks(),
  pendingSelection: null,
  pendingType: "mark",
  query: ""
};

seedBookmarks();
renderAll();

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !selection.toString().trim()) {
    els.selectionBubble.hidden = true;
  }
});

els.article.addEventListener("mouseup", () => {
  const selection = window.getSelection();
  const text = normalizeText(selection?.toString());
  if (!selection || selection.rangeCount === 0 || text.length < 2) return;

  const range = selection.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  state.pendingSelection = buildSelectionPayload(selection, range);
  els.selectionBubble.style.left = `${Math.min(window.innerWidth - 180, rect.right + 10)}px`;
  els.selectionBubble.style.top = `${Math.max(72, rect.top - 8)}px`;
  els.selectionBubble.hidden = false;
});

els.selectionBubble.addEventListener("click", (event) => {
  const button = event.target.closest("[data-save-type]");
  if (!button || !state.pendingSelection) return;
  openSaveDialog(button.dataset.saveType);
});

els.cancelSave.addEventListener("click", closeSaveDialog);
els.confirmSave.addEventListener("click", savePendingBookmark);

els.libraryButton.addEventListener("click", () => {
  const showLibrary = els.libraryView.hidden;
  els.readerView.hidden = showLibrary;
  els.libraryView.hidden = !showLibrary;
  els.libraryButton.textContent = showLibrary ? "阅读页" : "书签库";
  renderLibrary();
});

els.resetButton.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state.bookmarks = [];
  seedBookmarks(true);
  renderAll();
});

els.librarySearch.addEventListener("input", () => {
  state.query = normalizeText(els.librarySearch.value).toLowerCase();
  renderLibrary();
});

function seedBookmarks(force = false) {
  if (state.bookmarks.length && !force) return;
  state.bookmarks = [
    makeBookmark({
      type: "checkpoint",
      selectedText: "传统收藏夹记录的是网页地址，而很多学习场景真正需要恢复的是网页内部的阅读现场",
      section: "lead",
      note: "开头这句最能说明项目痛点",
      colorIndex: 1
    }),
    makeBookmark({
      type: "mark",
      selectedText: "AI 判断哪一段最接近用户当时标记的位置",
      section: "ai",
      note: "这里体现真正的 AI 竞争力",
      colorIndex: 2
    }),
    makeBookmark({
      type: "mark",
      selectedText: "Web Demo 会直接展示一个类似浏览器资讯页的阅读场景",
      section: "demo",
      note: "参赛 Demo 要一眼看懂",
      colorIndex: 0
    })
  ];
  persist();
}

function buildSelectionPayload(selection, range) {
  const text = normalizeText(selection.toString());
  const section = range.commonAncestorContainer.nodeType === Node.TEXT_NODE
    ? range.commonAncestorContainer.parentElement.closest("[data-section]")
    : range.commonAncestorContainer.closest?.("[data-section]");
  const sectionText = normalizeText(section?.textContent || els.article.textContent);
  return {
    selectedText: text,
    section: section?.dataset.section || "article",
    contextText: clip(sectionText, 360),
    beforeText: clip(sectionText.slice(0, Math.max(0, sectionText.indexOf(text))), 140),
    afterText: clip(sectionText.slice(sectionText.indexOf(text) + text.length), 180)
  };
}

function openSaveDialog(type) {
  state.pendingType = type;
  els.dialogTitle.textContent = type === "checkpoint" ? "保存阅读断点" : "保存标记书签";
  els.dialogQuote.textContent = state.pendingSelection.selectedText;
  els.noteInput.value = "";
  els.noteDialog.hidden = false;
  els.selectionBubble.hidden = true;
  setTimeout(() => els.noteInput.focus(), 50);
}

function closeSaveDialog() {
  els.noteDialog.hidden = true;
}

function savePendingBookmark() {
  if (!state.pendingSelection) return;
  const bookmark = makeBookmark({
    ...state.pendingSelection,
    type: state.pendingType,
    note: normalizeText(els.noteInput.value),
    colorIndex: state.bookmarks.length % colors.length
  });

  if (bookmark.type === "checkpoint") {
    state.bookmarks = state.bookmarks.filter((item) => item.type !== "checkpoint");
  }
  state.bookmarks.push(bookmark);
  persist();
  closeSaveDialog();
  window.getSelection()?.removeAllRanges();
  state.pendingSelection = null;
  renderAll();
}

function makeBookmark(input) {
  const meta = generateMeta(input);
  return {
    id: input.id || crypto.randomUUID(),
    pageId: page.id,
    pageTitle: page.title,
    pageUrl: page.url,
    type: input.type || "mark",
    section: input.section || "article",
    selectedText: normalizeText(input.selectedText),
    contextText: normalizeText(input.contextText || ""),
    beforeText: normalizeText(input.beforeText || ""),
    afterText: normalizeText(input.afterText || ""),
    note: normalizeText(input.note || ""),
    colorIndex: input.colorIndex || 0,
    createdAt: input.createdAt || new Date().toISOString(),
    ...meta
  };
}

function generateMeta(bookmark) {
  const text = normalizeText(bookmark.selectedText);
  const context = normalizeText(bookmark.contextText || text);
  const keywords = extractKeywords(`${text} ${context}`).slice(0, 4);
  const intent = inferIntent(`${text} ${context}`);
  const titlePrefix = bookmark.type === "checkpoint" ? "读到" : intent;
  const next = bookmark.afterText ? `接下来重点看：${clip(bookmark.afterText, 46)}` : "继续阅读这段前后的上下文。";
  return {
    title: `${titlePrefix}：${clip(text, 18)}`,
    summary: buildSummary(intent, keywords, text),
    aiReason: `AI 理解这块更像“${intent}”，它和“${keywords.join("、") || clip(text, 12)}”有关。`,
    nextAction: next,
    keywords,
    intent
  };
}

function renderAll() {
  renderStickyRail();
  renderLibrary();
}

function renderStickyRail() {
  els.stickyRail.textContent = "";
  const launcher = document.createElement("button");
  launcher.className = "rail-launcher";
  launcher.type = "button";
  launcher.textContent = `${state.bookmarks.length} 书签`;
  launcher.addEventListener("click", () => {
    els.readerView.hidden = true;
    els.libraryView.hidden = false;
    els.libraryButton.textContent = "阅读页";
    renderLibrary();
  });
  els.stickyRail.append(launcher);

  getOrderedBookmarks().forEach((bookmark) => {
    const color = colors[bookmark.colorIndex % colors.length];
    const note = document.createElement("article");
    note.className = "sticky-note";
    note.style.setProperty("--note-bg", color.bg);
    note.style.setProperty("--note-accent", color.accent);
    note.style.setProperty("--note-text", color.text);
    note.tabIndex = 0;
    note.innerHTML = `
      <button class="delete" type="button" aria-label="删除书签">×</button>
      <span>${escapeHtml(shortLabel(bookmark))}</span>
      <div class="sticky-detail">
        <h3>${escapeHtml(bookmark.title)}</h3>
        <p><mark>${escapeHtml(bookmark.selectedText)}</mark></p>
        <p>${escapeHtml(bookmark.summary)}</p>
        <p>${escapeHtml(bookmark.aiReason)}</p>
        ${bookmark.note ? `<p><strong>备注：</strong>${escapeHtml(bookmark.note)}</p>` : ""}
        <p>${escapeHtml(bookmark.nextAction)}</p>
        <div class="detail-actions">
          <button class="jump" type="button">跳转</button>
          <button class="edit" type="button">备注</button>
        </div>
      </div>
    `;
    note.querySelector(".jump").addEventListener("click", () => jumpToBookmark(bookmark));
    note.querySelector(".delete").addEventListener("click", (event) => {
      event.stopPropagation();
      state.bookmarks = state.bookmarks.filter((item) => item.id !== bookmark.id);
      persist();
      renderAll();
    });
    note.querySelector(".edit").addEventListener("click", () => {
      const nextNote = prompt("修改备注，可留空", bookmark.note || "");
      if (nextNote === null) return;
      bookmark.note = normalizeText(nextNote);
      persist();
      renderAll();
    });
    note.addEventListener("dblclick", () => jumpToBookmark(bookmark));
    els.stickyRail.append(note);
  });
}

function renderLibrary() {
  els.libraryGrid.textContent = "";
  const matched = getOrderedBookmarks().filter((bookmark) => matchesQuery(bookmark));
  const card = document.createElement("article");
  card.className = "library-card";
  card.innerHTML = `
    <div>
      <h2>${highlight(page.title)}</h2>
      <div class="page-url">${highlight(page.url)}</div>
    </div>
    <div class="ai-summary">${highlight(buildPageSummary(matched.length ? matched : getOrderedBookmarks()))}</div>
    <div class="library-actions">
      <button class="primary" type="button">回到阅读断点</button>
      <span>${matched.length} 个位置</span>
    </div>
    <div class="bookmark-list"></div>
  `;
  card.querySelector(".primary").addEventListener("click", () => {
    const checkpoint = state.bookmarks.find((item) => item.type === "checkpoint") || state.bookmarks[0];
    if (checkpoint) jumpToBookmark(checkpoint);
  });

  const list = card.querySelector(".bookmark-list");
  matched.forEach((bookmark) => {
    const item = document.createElement("article");
    item.className = "bookmark-mini";
    item.innerHTML = `
      <div class="bookmark-row">
        <span>${bookmark.type === "checkpoint" ? "阅读断点" : "标记书签"}</span>
        <button type="button">跳转</button>
      </div>
      <h3>${highlight(bookmark.title)}</h3>
      <p>${highlight(bookmark.summary)}</p>
      <p>${highlight(bookmark.selectedText)}</p>
      ${bookmark.note ? `<p>${highlight(`备注：${bookmark.note}`)}</p>` : ""}
    `;
    item.querySelector("button").addEventListener("click", () => jumpToBookmark(bookmark));
    list.append(item);
  });

  els.libraryGrid.append(card);
}

function jumpToBookmark(bookmark) {
  els.readerView.hidden = false;
  els.libraryView.hidden = true;
  els.libraryButton.textContent = "书签库";
  clearHighlights();

  const exact = highlightText(bookmark.selectedText);
  const target = exact || document.querySelector(`[data-section="${bookmark.section}"]`) || els.article;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("section-pulse");
  setTimeout(() => target.classList.remove("section-pulse"), 1200);
}

function highlightText(text) {
  const normalized = normalizeText(text);
  if (!normalized) return null;
  const walker = document.createTreeWalker(els.article, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!normalizeText(node.nodeValue).includes(normalized)) return NodeFilter.FILTER_REJECT;
      if (node.parentElement.closest("script, style, mark")) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    }
  });
  const node = walker.nextNode();
  if (!node) return null;
  const index = node.nodeValue.indexOf(text);
  if (index < 0) return node.parentElement;
  const range = document.createRange();
  range.setStart(node, index);
  range.setEnd(node, index + text.length);
  const mark = document.createElement("mark");
  mark.className = "demo-highlight";
  range.surroundContents(mark);
  return mark;
}

function clearHighlights() {
  document.querySelectorAll(".demo-highlight").forEach((mark) => {
    const parent = mark.parentNode;
    parent.replaceChild(document.createTextNode(mark.textContent), mark);
    parent.normalize();
  });
}

function getOrderedBookmarks() {
  return [...state.bookmarks].sort((a, b) => {
    if (a.type === "checkpoint" && b.type !== "checkpoint") return -1;
    if (a.type !== "checkpoint" && b.type === "checkpoint") return 1;
    return sectionIndex(a.section) - sectionIndex(b.section);
  });
}

function matchesQuery(bookmark) {
  if (!state.query) return true;
  return [
    bookmark.title,
    bookmark.summary,
    bookmark.selectedText,
    bookmark.note,
    bookmark.aiReason,
    bookmark.nextAction,
    ...(bookmark.keywords || [])
  ].join(" ").toLowerCase().includes(state.query);
}

function buildPageSummary(bookmarks) {
  const count = bookmarks.length;
  const keywords = [...new Set(bookmarks.flatMap((item) => item.keywords || []))].slice(0, 5);
  return `AI 总结：你在这个网页保存了 ${count} 个位置，主要关注“${keywords.join("、") || "阅读断点"}”。这些书签能帮助你恢复网页内部的阅读现场，而不是只回到网页顶部。`;
}

function buildSummary(intent, keywords, text) {
  const core = keywords.slice(0, 2).join("、") || clip(text, 12);
  const templates = {
    "问题痛点": `这段指出“${core}”相关痛点，是解释项目必要性的关键位置。`,
    "技术实现": `这段在讲“${core}”的实现方式，适合回来看定位逻辑。`,
    "产品价值": `这段说明“${core}”带来的产品价值，适合用于参赛表达。`,
    "演示设计": `这段和“${core}”有关，能帮助评审快速理解 Demo 闭环。`
  };
  return templates[intent] || `这段内容围绕“${core}”展开，适合恢复当时的阅读关注点。`;
}

function inferIntent(text) {
  if (/问题|失效|不够|痛点|只能/.test(text)) return "问题痛点";
  if (/AI|定位|相似度|上下文|判断|语义/.test(text)) return "技术实现";
  if (/Demo|演示|评审|展示|场景/.test(text)) return "演示设计";
  if (/竞争力|价值|助手|恢复/.test(text)) return "产品价值";
  return "关键内容";
}

function extractKeywords(text) {
  return [...new Set((normalizeText(text).match(/[\u4e00-\u9fa5A-Za-z0-9]{2,}/g) || [])
    .filter((word) => !["一个", "这段", "用户", "网页", "可以", "需要", "如果", "什么"].includes(word))
    .map((word) => word.slice(0, 12)))];
}

function shortLabel(bookmark) {
  if (bookmark.type === "checkpoint") return "阅读断点";
  return clip(bookmark.note || bookmark.title.replace(/^.*?：/, ""), 6);
}

function sectionIndex(section) {
  return ["lead", "pain", "ai", "demo", "value", "article"].indexOf(section);
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bookmarks));
}

function loadBookmarks() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function clip(value, length) {
  const text = normalizeText(value);
  return text.length > length ? `${text.slice(0, length)}…` : text;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlight(value) {
  const text = escapeHtml(value);
  if (!state.query) return text;
  const pattern = new RegExp(`(${escapeRegExp(state.query)})`, "gi");
  return text.replace(pattern, '<mark class="search-hit">$1</mark>');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
