/**
 * AnchorNote Embed — drop-in script for any demo page.
 *
 * window.ANCHORNOTE_CONFIG {
 *   pageId, pageTitle, pageUrl, articleSelector,
 *   mode: 'article'|'doc'   (default 'article'; 'doc' = persistent inline annotations)
 *   seedBookmarks: [{ type, selectedText, section, note, contextText, source? }]
 * }
 */
(function () {
  'use strict';

  /* ── config ─────────────────────────────────────────────────────────── */
  const cfg = window.ANCHORNOTE_CONFIG || {};
  const PAGE = {
    id:    cfg.pageId    || location.pathname,
    title: cfg.pageTitle || document.title,
    url:   cfg.pageUrl   || location.href
  };
  const ARTICLE_SEL = cfg.articleSelector || '#article';
  const MODE = cfg.mode || 'article';   // 'article' | 'doc'
  const STORAGE_KEY = 'anchornote.embed.' + PAGE.id;

  const COLORS = [
    { bg: '#fff5cf', accent: '#f6bd18', text: '#7a5200' },
    { bg: '#e7f8ff', accent: '#1f6feb', text: '#1559ce' },
    { bg: '#e5fbf4', accent: '#18b99a', text: '#087967' },
    { bg: '#ffe8ef', accent: '#f45b69', text: '#bf2541' },
    { bg: '#f0e9ff', accent: '#8757e8', text: '#6533c9' }
  ];

  const INTENT_ICON = { '问题痛点':'🔍','技术实现':'⚙️','产品价值':'💡','数据洞察':'📊','政策法规':'⚖️','战略建议':'🎯','个人经历':'💭','关键内容':'📌' };
  const NEXT_ACT = {
    '问题痛点': '建议对照找"解决方案"段落一并标记，形成问题-解法对。',
    '技术实现': '建议找实现细节补充一个断点，方便后续深挖。',
    '产品价值': '适合在产品提案中引用，建议同时标记一段数据支撑。',
    '数据洞察': '可与其他数据书签交叉比对，寻找规律或矛盾。',
    '政策法规': '建议关注该政策的后续细则更新，定期回访。',
    '战略建议': '结合自身场景判断可行性，再保存执行步骤。',
    '个人经历': '值得与自身经历对照，多次重读。',
  };

  /* ── css ─────────────────────────────────────────────────────────────── */
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    /* ── selection bubble ── */
    .an-sel-bubble {
      position: fixed; z-index: 9999;
      display: flex; flex-direction: column; gap: 8px;
      padding: 10px 12px;
      border: 1px solid #b7cdf2; border-radius: 14px;
      background: #fff;
      box-shadow: 0 18px 48px rgba(26,68,133,.22);
      font-family: -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
      min-width: 220px;
    }
    .an-sel-quote {
      font-size: 12px; color: #68758f; line-height: 1.5;
      max-height: 38px; overflow: hidden;
      padding-bottom: 6px; border-bottom: 1px solid #edf2ff;
    }
    .an-sel-colors { display: flex; gap: 6px; align-items: center; }
    .an-sel-colors-lbl { font-size: 11px; color: #99a3b4; margin-right: 2px; }
    .an-color-dot {
      width: 18px; height: 18px; border-radius: 999px;
      border: 2px solid transparent; cursor: pointer; padding: 0;
      transition: transform .12s;
    }
    .an-color-dot:hover { transform: scale(1.18); }
    .an-color-dot.an-selected { border-color: #17233d; transform: scale(1.22); }
    .an-sel-note {
      width: 100%; box-sizing: border-box;
      resize: none; border: 1px solid #d0dffa; border-radius: 8px;
      padding: 7px 9px; font: inherit; font-size: 13px; color: #17233d;
      background: #f8fbff; outline: none;
    }
    .an-sel-note:focus { border-color: #1f6feb; background: #fff; }
    .an-sel-actions { display: flex; gap: 8px; }
    .an-sel-actions button {
      flex: 1; min-height: 32px; padding: 0 8px;
      border: 0; border-radius: 9px;
      font: inherit; font-size: 13px; font-weight: 800; cursor: pointer;
    }
    .an-btn-mark  { background: #fff5cf; color: #7a5200; }
    .an-btn-mark:hover  { background: #f6bd18; color: #fff; }
    .an-btn-cp   { background: #e7f8ff; color: #1559ce; }
    .an-btn-cp:hover   { background: #1f6feb; color: #fff; }
    .an-sel-close {
      position: absolute; top: 6px; right: 8px;
      border: 0; background: none; cursor: pointer;
      font-size: 15px; color: #aab4c8; padding: 0;
    }
    .an-sel-close:hover { color: #445566; }

    /* ── toast ── */
    .an-toast {
      position: fixed; bottom: 28px; left: 50%; z-index: 11000;
      transform: translateX(-50%) translateY(16px);
      padding: 10px 20px; border-radius: 99px;
      background: rgba(23,35,61,.88); color: #fff;
      font-family: -apple-system,"PingFang SC",sans-serif;
      font-size: 14px; font-weight: 600;
      box-shadow: 0 10px 30px rgba(10,30,80,.30);
      opacity: 0; transition: opacity .22s, transform .22s;
      pointer-events: none; white-space: nowrap;
    }
    .an-toast.an-toast-show { opacity: 1; transform: translateX(-50%) translateY(0); }

    /* ── right rail ── */
    .an-rail {
      position: fixed; right: 0; top: 170px; z-index: 9000;
      display: grid; justify-items: end; gap: 8px;
      max-height: calc(100vh - 210px); overflow-y: auto; overflow-x: visible;
      pointer-events: none;
    }
    .an-rail::-webkit-scrollbar { width: 4px; }
    .an-rail::-webkit-scrollbar-thumb { background: rgba(0,0,0,.18); border-radius: 2px; }
    .an-rail > * { pointer-events: auto; }
    .an-rail-launcher {
      display: grid; place-items: center;
      width: 58px; min-height: 96px; padding: 10px 6px;
      border: 1px solid rgba(123,92,0,.16); border-right: 0;
      border-radius: 16px 0 0 16px;
      background: #fff6d6; color: #7b5200;
      font-weight: 900; writing-mode: vertical-rl;
      cursor: pointer; font-size: 13px;
      box-shadow: 0 12px 30px rgba(24,48,91,.16);
      font-family: -apple-system,"PingFang SC",sans-serif;
    }
    .an-rail-launcher:hover { background: #ffe89e; }
    .an-rail-cp-btn {
      display: grid; place-items: center;
      width: 58px; min-height: 56px; padding: 6px;
      border: 1px solid rgba(31,111,235,.22); border-right: 0;
      border-radius: 14px 0 0 14px;
      background: #e7f8ff; color: #1559ce;
      font-weight: 900; writing-mode: vertical-rl;
      cursor: pointer; font-size: 12px;
      box-shadow: 0 8px 20px rgba(24,48,91,.12);
      font-family: -apple-system,"PingFang SC",sans-serif;
    }
    .an-rail-cp-btn:hover { background: #1f6feb; color: #fff; }
    .an-rail-hide-btn {
      display: grid; place-items: center;
      width: 58px; min-height: 36px; padding: 4px 6px;
      border: 1px solid rgba(100,100,100,.18); border-right: 0;
      border-radius: 10px 0 0 10px;
      background: #f0f4fb; color: #8fa3c2;
      font-weight: 700; writing-mode: vertical-rl;
      cursor: pointer; font-size: 11px;
      box-shadow: 0 4px 12px rgba(24,48,91,.08);
      font-family: -apple-system,"PingFang SC",sans-serif;
    }
    .an-rail-hide-btn:hover { background: #e0e8f8; color: #445a7a; }
    .an-rail.an-rail-hidden > *:not(.an-rail-hide-btn) { display: none !important; }

    .an-sticky {
      position: relative;
      width: 62px; min-height: 86px; padding: 10px 7px;
      border: 1px solid rgba(123,92,0,.14); border-right: 0;
      border-left: 6px solid var(--an-accent);
      border-radius: 14px 0 0 14px;
      background: var(--an-bg); color: var(--an-text);
      font-weight: 900; writing-mode: vertical-rl;
      text-align: center; cursor: default;
      box-shadow: 0 8px 24px rgba(24,48,91,.14);
      font-family: -apple-system,"PingFang SC",sans-serif;
    }
    .an-site-badge {
      position: absolute; top: 5px; left: 50%; transform: translateX(-50%);
      font-size: 9px; font-weight: 700; color: #1d4ed8;
      background: rgba(0,110,255,.13); border-radius: 3px;
      padding: 1px 4px; letter-spacing: .02em; line-height: 1.4;
      writing-mode: horizontal-tb; white-space: nowrap; pointer-events: none;
    }
    .an-del {
      position: absolute; top: -7px; left: -9px;
      display: none; width: 22px; height: 22px;
      border: 0; border-radius: 999px;
      background: #fff; color: #d7263d;
      font-weight: 900; cursor: pointer; font-size: 13px; line-height: 1;
      box-shadow: 0 6px 16px rgba(30,60,120,.18);
    }
    .an-sticky:hover .an-del { display: grid; place-items: center; }
    .an-sticky-detail {
      position: fixed; right: 66px; top: 0;
      display: none; width: 290px; padding: 16px;
      border: 1px solid rgba(102,141,204,.34); border-radius: 14px;
      background: color-mix(in srgb, var(--an-bg) 80%, #fff);
      box-shadow: 0 20px 56px rgba(21,55,113,.24);
      color: var(--an-text); writing-mode: horizontal-tb;
      text-align: left; font-weight: 400;
      font-family: -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
      font-size: 14px; z-index: 9100; line-height: 1.6;
    }
    .an-sticky:hover .an-sticky-detail,
    .an-sticky:focus-within .an-sticky-detail { display: block; }
    .an-sticky-detail h3 { margin: 0 0 8px; font-size: 15px; font-weight: 700; }
    .an-sticky-detail p { margin: 0 0 8px; }
    .an-sticky-detail mark {
      border-radius: 4px;
      background: color-mix(in srgb, var(--an-accent) 26%, #fff);
      color: inherit; font-style: normal;
    }
    .an-d-actions { display: flex; gap: 6px; margin-top: 10px; flex-wrap: wrap; }
    .an-d-actions button {
      min-height: 26px; padding: 0 9px;
      border: 0; border-radius: 8px;
      background: rgba(255,255,255,.85); color: #21416d;
      font-weight: 700; cursor: pointer; font: inherit; font-size: 12px;
    }
    .an-d-actions button:hover { background: #1f6feb; color: #fff; }

    /* ── doc mode inline annotations ── */
    .an-doc-hi {
      border-radius: 3px;
      padding: 0 1px;
    }
    .an-has-anno { position: relative; }
    .an-doc-dot {
      position: absolute; right: -22px; top: 6px;
      width: 14px; height: 14px; border-radius: 999px;
      border: 2px solid rgba(255,255,255,.9);
      box-shadow: 0 2px 8px rgba(0,0,0,.22);
      cursor: pointer; z-index: 200;
      transition: transform .15s;
    }
    .an-doc-dot:hover { transform: scale(1.3); }

    /* ── library ── */
    .an-lib-backdrop {
      position: fixed; inset: 0; z-index: 10000;
      background: rgba(8,22,50,.48); backdrop-filter: blur(7px);
    }
    .an-lib-panel {
      position: fixed; top: 0; right: 0; bottom: 0; z-index: 10001;
      width: min(640px, 100vw); background: #f4f8ff;
      box-shadow: -20px 0 60px rgba(10,30,80,.26);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
    }
    .an-lib-head {
      padding: 20px 22px 14px; background: #fff;
      border-bottom: 1px solid #d8e5f8; flex-shrink: 0;
    }
    .an-lib-head-row {
      display: flex; align-items: center;
      justify-content: space-between; gap: 12px; margin-bottom: 12px;
    }
    .an-lib-head h2 { margin: 0; font-size: 20px; color: #17233d; }
    .an-lib-close {
      border: 0; border-radius: 8px; background: #eaf2ff; color: #1f6feb;
      padding: 6px 14px; cursor: pointer;
      font-weight: 700; font: inherit; font-size: 13px; white-space: nowrap;
    }
    .an-lib-close:hover { background: #1f6feb; color: #fff; }
    .an-lib-search {
      width: 100%; border: 1px solid #d0dffa; border-radius: 999px;
      padding: 8px 16px; outline: none;
      font: inherit; font-size: 14px; background: #f4f8ff; color: #17233d;
    }
    .an-lib-search:focus { border-color: #1f6feb; background: #fff; }
    .an-lib-body { flex: 1; overflow-y: auto; padding: 18px 22px 40px; }

    .an-lib-card {
      border: 1px solid rgba(182,205,243,.72); border-radius: 14px;
      background: rgba(255,255,255,.93);
      box-shadow: 0 8px 28px rgba(26,68,133,.08);
      padding: 18px; margin-bottom: 16px;
    }
    .an-lib-card h2 { margin: 0 0 4px; font-size: 17px; color: #17233d; line-height: 1.4; }
    .an-lib-url { color: #68758f; font-size: 12px; margin-bottom: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .an-lib-ai {
      padding: 12px 14px; border: 1px solid #d9e8ff; border-radius: 10px;
      background: linear-gradient(180deg, #f3f8ff, #fff);
      color: #27456e; line-height: 1.65; font-size: 14px; margin-bottom: 12px;
    }
    .an-lib-ai.an-warn {
      border-color: #fcd34d; background: linear-gradient(180deg, #fff8e6, #fff);
      color: #78350f;
    }
    .an-lib-actions {
      display: flex; align-items: center;
      justify-content: space-between; margin-bottom: 14px; gap: 10px;
    }
    .an-lib-actions button {
      min-height: 34px; padding: 0 14px; border: 0; border-radius: 9px;
      background: #1f6feb; color: #fff;
      font-weight: 700; cursor: pointer; font: inherit; font-size: 13px;
    }
    .an-lib-actions button:hover { background: #1559ce; }
    .an-lib-actions span { color: #68758f; font-size: 13px; }

    /* clustering */
    .an-cluster-section { margin-bottom: 14px; }
    .an-cluster-head {
      display: flex; align-items: center; gap: 6px;
      font-size: 12px; font-weight: 700; color: #445a7a;
      padding: 6px 10px; background: #eef4ff; border-radius: 8px;
      margin-bottom: 8px;
    }
    .an-cluster-head span { margin-left: auto; color: #8fa3c2; font-size: 11px; }

    .an-bm-list { display: grid; gap: 10px; }
    .an-bm-item {
      border: 1px solid rgba(182,205,243,.7); border-radius: 10px;
      background: #fff; padding: 12px 14px;
    }
    .an-bm-row {
      display: flex; align-items: center;
      justify-content: space-between; gap: 8px; margin-bottom: 6px;
    }
    .an-bm-type { font-size: 12px; color: #68758f; font-weight: 600; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
    .an-src-badge {
      font-size: 10px; font-weight: 600; padding: 1px 7px; border-radius: 10px;
      background: #eef4ff; color: #3b5f9e;
    }
    .an-bm-jump {
      min-height: 26px; padding: 0 10px; border: 0; border-radius: 7px;
      background: #eaf2ff; color: #1f6feb;
      font-weight: 700; cursor: pointer; font: inherit; font-size: 12px; flex-shrink: 0;
    }
    .an-bm-jump:hover { background: #1f6feb; color: #fff; }
    .an-bm-open {
      min-height: 26px; padding: 0 8px; border: 0; border-radius: 7px;
      background: #f4f8ff; color: #68758f;
      font-weight: 700; cursor: pointer; font: inherit; font-size: 13px; flex-shrink: 0;
    }
    .an-bm-open:hover { background: #e5fbf4; color: #087967; }
    .an-bm-item h3 { margin: 0 0 5px; font-size: 14px; color: #17233d; font-weight: 700; }
    .an-bm-item p { margin: 0 0 4px; color: #5b6980; font-size: 13px; line-height: 1.55; }

    .an-search-hit { border-radius: 3px; background: #fff0a8; color: inherit; }
    .an-hi {
      display: inline !important;
      border-radius: 4px;
      background: rgba(246,189,24,.35);
      box-shadow: inset 0 -0.35em 0 rgba(246,189,24,.28);
    }
    .an-pulse { animation: an-pa .85s ease-out; }
    @keyframes an-pa {
      0%   { outline: 3px solid rgba(31,111,235,.6); outline-offset: 2px; }
      100% { outline: 3px solid rgba(31,111,235,0);  outline-offset: 8px; }
    }

    /* ensure [hidden] always wins over display:flex/grid on panel elements */
    #an-overlay-root [hidden] { display: none !important; }

    /* ── rail drag handle ── */
    .an-rail-launcher { cursor: grab; }
    .an-rail-launcher.an-dragging { cursor: grabbing; opacity: .7; }

    /* ── sticky drag-to-reorder ── */
    .an-sticky[draggable] { cursor: grab; }
    .an-sticky.an-drag-over { outline: 2px dashed #1f6feb; outline-offset: 2px; }

    /* ── library item extras ── */
    .an-bm-edit {
      min-height: 26px; padding: 0 8px; border: 0; border-radius: 7px;
      background: #f4f8ff; color: #68758f;
      font-weight: 700; cursor: pointer; font: inherit; font-size: 12px; flex-shrink: 0;
    }
    .an-bm-edit:hover { background: #fff5cf; color: #7a5200; }
    .an-bm-del {
      min-height: 26px; padding: 0 8px; border: 0; border-radius: 7px;
      background: #fff0f0; color: #d7263d;
      font-weight: 900; cursor: pointer; font: inherit; font-size: 13px; flex-shrink: 0;
    }
    .an-bm-del:hover { background: #d7263d; color: #fff; }
    .an-bm-note-input {
      width: 100%; box-sizing: border-box; resize: none;
      border: 1px solid #d0dffa; border-radius: 7px;
      padding: 6px 8px; font: inherit; font-size: 13px; color: #17233d;
      background: #f8fbff; outline: none; margin-bottom: 4px; display: block;
    }
    .an-bm-note-input:focus { border-color: #1f6feb; background: #fff; }
    .an-bm-note-save {
      min-height: 26px; padding: 0 12px; border: 0; border-radius: 7px;
      background: #1f6feb; color: #fff;
      font-weight: 700; cursor: pointer; font: inherit; font-size: 12px;
    }
    .an-bm-note-save:hover { background: #1559ce; }
    .an-bm-colors {
      display: flex; gap: 5px; align-items: center;
      margin-top: 8px; padding-top: 8px;
      border-top: 1px solid #edf2fb;
    }
    .an-bm-colors-lbl { font-size: 11px; color: #aab4c8; margin-right: 2px; }
    .an-bm-cdot {
      width: 16px; height: 16px; border-radius: 999px;
      border: 2px solid transparent; cursor: pointer; padding: 0;
      transition: transform .12s;
    }
    .an-bm-cdot:hover { transform: scale(1.2); }
    .an-bm-cdot.an-sel { border-color: #17233d; transform: scale(1.25); }

    /* ── checkpoint context brief ── */
    .an-cp-brief {
      margin-top: 8px; padding: 8px 10px;
      background: #f4f8ff; border-left: 3px solid #1f6feb; border-radius: 4px;
      font-size: 12px; color: #4a6a9c; line-height: 1.6;
    }
    .an-cp-brief-lbl { font-weight: 700; color: #8fa3c2; font-size: 10px; letter-spacing: .06em; }

    /* ── notes export modal ── */
    .an-notes-backdrop {
      position: fixed; inset: 0; z-index: 10200;
      background: rgba(8,22,50,.55); backdrop-filter: blur(8px);
    }
    .an-notes-panel {
      position: fixed; top: 50%; left: 50%; z-index: 10201;
      transform: translate(-50%, -50%);
      width: min(700px, 96vw); max-height: 88vh;
      background: #fff; border-radius: 16px;
      box-shadow: 0 28px 80px rgba(10,30,80,.34);
      display: flex; flex-direction: column; overflow: hidden;
      font-family: -apple-system,"PingFang SC","Microsoft YaHei",sans-serif;
    }
    .an-notes-head {
      padding: 18px 22px 16px;
      background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 60%, #1f6feb 100%);
      flex-shrink: 0; display: flex; align-items: center; gap: 12px;
    }
    .an-notes-head h2 {
      flex: 1; margin: 0; font-size: 17px; color: #fff; display: flex; align-items: center; gap: 8px;
    }
    .an-notes-head h2 small { font-size: 12px; color: rgba(255,255,255,.55); font-weight: 400; }
    .an-notes-copy {
      padding: 7px 14px; border: 1px solid rgba(255,255,255,.3); border-radius: 9px;
      background: rgba(255,255,255,.12); color: #fff;
      font-weight: 700; cursor: pointer; font: inherit; font-size: 13px; white-space: nowrap;
    }
    .an-notes-copy:hover { background: rgba(255,255,255,.25); }
    .an-notes-copy.an-copied { background: #10b981; border-color: #10b981; }
    .an-notes-close-btn {
      padding: 7px 12px; border: 1px solid rgba(255,255,255,.22); border-radius: 9px;
      background: rgba(255,255,255,.1); color: rgba(255,255,255,.8);
      font-weight: 700; cursor: pointer; font: inherit; font-size: 13px;
    }
    .an-notes-close-btn:hover { background: rgba(255,255,255,.2); color: #fff; }
    .an-notes-body { flex: 1; overflow-y: auto; padding: 22px 24px 32px; background: #f8fafc; }
    .an-notes-section { margin-bottom: 22px; }
    .an-notes-section-title {
      font-size: 11px; font-weight: 700; color: #94a3b8;
      letter-spacing: .08em; text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 12px;
    }
    .an-notes-overview {
      background: linear-gradient(135deg, #f0f7ff, #f8f0ff);
      border: 1px solid #bfdbfe; border-left: 4px solid #1f6feb;
      border-radius: 0 10px 10px 0; padding: 14px 16px;
      font-size: 14px; color: #1e3a5f; line-height: 1.7;
    }
    .an-notes-tags { display: flex; flex-wrap: wrap; gap: 7px; }
    .an-notes-tag {
      padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;
      background: #eef4ff; color: #3b5f9e; border: 1px solid #dbeafe;
    }
    .an-notes-tag.an-tag-tech   { background: #f0fdf4; color: #166534; border-color: #bbf7d0; }
    .an-notes-tag.an-tag-data   { background: #fffbeb; color: #92400e; border-color: #fde68a; }
    .an-notes-tag.an-tag-prod   { background: #fdf4ff; color: #6b21a8; border-color: #e9d5ff; }
    .an-notes-km {
      background: #fff; border: 1px solid #e2e8f0; border-radius: 12px;
      padding: 16px 18px; margin-bottom: 12px;
      box-shadow: 0 2px 8px rgba(26,68,133,.05);
    }
    .an-notes-km-header {
      display: flex; align-items: center; gap: 8px; margin-bottom: 10px;
    }
    .an-notes-km-num {
      width: 24px; height: 24px; border-radius: 50%;
      background: #1f6feb; color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 11px; font-weight: 800; flex-shrink: 0;
    }
    .an-notes-km-intent {
      font-size: 11px; font-weight: 700; padding: 2px 9px; border-radius: 10px;
      background: #eef4ff; color: #3b5f9e;
    }
    .an-notes-km-title { font-size: 14px; font-weight: 700; color: #17233d; flex: 1; }
    .an-notes-km-quote {
      background: #f8fafc; border-left: 3px solid #cbd5e1;
      border-radius: 0 6px 6px 0; padding: 8px 12px; margin-bottom: 10px;
      font-size: 13px; color: #475569; line-height: 1.6; font-style: italic;
    }
    .an-notes-km-explain {
      font-size: 13.5px; color: #334155; line-height: 1.7; margin-bottom: 8px;
    }
    .an-notes-km-next {
      font-size: 12px; color: #64748b; padding-top: 8px;
      border-top: 1px solid #f1f5f9; display: flex; align-items: flex-start; gap: 6px;
    }
    .an-notes-km-next::before { content: '→'; color: #1f6feb; font-weight: 800; flex-shrink: 0; }
    .an-notes-km-note {
      font-size: 12px; color: #7c3aed; margin-bottom: 6px;
      background: #fdf4ff; border-radius: 6px; padding: 5px 10px;
    }

    /* ── resume brief ── */
    .an-resume {
      margin-bottom: 14px; padding: 14px 16px;
      background: linear-gradient(135deg, #f0f4ff 0%, #f8f0ff 100%);
      border: 1px solid #d6e4ff; border-radius: 12px;
    }
    .an-resume-title {
      font-size: 12px; font-weight: 700; color: #445a7a;
      letter-spacing: .05em; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;
    }
    .an-resume-focus {
      font-size: 13px; font-weight: 700; color: #17233d; margin-bottom: 8px;
    }
    .an-resume-points { list-style: none; margin: 0 0 8px; padding: 0; display: grid; gap: 4px; }
    .an-resume-points li {
      font-size: 12px; color: #3d5070; line-height: 1.5;
      display: flex; gap: 6px;
    }
    .an-resume-points li::before { content: '·'; color: #1f6feb; font-weight: 900; flex-shrink: 0; }
    .an-resume-suggest {
      font-size: 12px; color: #68758f; padding-top: 8px;
      border-top: 1px solid rgba(31,111,235,.15);
    }
  `;
  document.head.appendChild(styleEl);

  /* ── overlay DOM ────────────────────────────────────────────────────── */
  const overlay = document.createElement('div');
  overlay.id = 'an-overlay-root';
  overlay.innerHTML = `
    <div id="an-sel" class="an-sel-bubble" hidden>
      <button class="an-sel-close" id="an-sel-cls">✕</button>
      <div id="an-sel-quote" class="an-sel-quote"></div>
      <div class="an-sel-colors">
        <span class="an-sel-colors-lbl">颜色</span>
        ${COLORS.map((c,i)=>`<button class="an-color-dot${i===0?' an-selected':''}" data-ci="${i}" style="background:${c.accent}"></button>`).join('')}
      </div>
      <textarea id="an-sel-note" class="an-sel-note" rows="2" placeholder="写备注（可选）…"></textarea>
      <div class="an-sel-actions">
        <button class="an-btn-mark" data-save-type="mark">🔖 书签</button>
        <button class="an-btn-cp"   data-save-type="checkpoint">📍 断点</button>
      </div>
    </div>
    <div id="an-rail" class="an-rail"></div>
    <div id="an-lib-bd" class="an-lib-backdrop" hidden></div>
    <div id="an-lib-pn" class="an-lib-panel" hidden>
      <div class="an-lib-head">
        <div class="an-lib-head-row">
          <h2>AnchorNote 书签库</h2>
          <div style="display:flex;gap:8px;flex-shrink:0">
            <button id="an-lib-notes" class="an-lib-close" style="background:#f0e9ff;color:#7c3aed">📝 AI 笔记</button>
            <button id="an-lib-cls" class="an-lib-close">✕ 返回阅读</button>
          </div>
        </div>
        <input id="an-lib-q" class="an-lib-search" type="search" placeholder="搜索原文、摘要、备注…" />
      </div>
      <div id="an-lib-body" class="an-lib-body"></div>
    </div>
    <div id="an-notes-bd" class="an-notes-backdrop" hidden></div>
    <div id="an-notes-pn" class="an-notes-panel" hidden>
      <div class="an-notes-head">
        <h2>📝 AI 阅读笔记 <small>由书签自动生成</small></h2>
        <button id="an-notes-copy" class="an-notes-copy">复制 Markdown</button>
        <button id="an-notes-cls" class="an-notes-close-btn">✕</button>
      </div>
      <div id="an-notes-body" class="an-notes-body"></div>
    </div>
    <div id="an-toast" class="an-toast"></div>
  `;
  document.body.appendChild(overlay);

  /* ── refs & state ───────────────────────────────────────────────────── */
  const $ = id => document.getElementById(id);
  const article = () => document.querySelector(ARTICLE_SEL);

  const RAIL_TOP_KEY    = 'anchornote.rail-top.'    + PAGE.id;
  const RAIL_HIDDEN_KEY = 'anchornote.rail-hidden.' + PAGE.id;
  let railTop    = Math.min(window.innerHeight - 120, Math.max(60, parseInt(localStorage.getItem(RAIL_TOP_KEY) || '170', 10)));
  let railHidden = localStorage.getItem(RAIL_HIDDEN_KEY) === '1';

  const state = {
    bookmarks: loadBMs(),
    pending: null,
    selectedColorIndex: 0,
    query: '',
    editingBmId: null    // tracks which library note editor is open
  };

  /* ── boot ───────────────────────────────────────────────────────────── */
  function boot() {
    if (!article()) { setTimeout(boot, 120); return; }
    seedBMs();
    renderAll();
    wire();
    handleDeepLink();
  }

  function handleDeepLink() {
    const m = location.hash.match(/^#an-jump=(.+)/);
    if (!m) return;
    const id = decodeURIComponent(m[1]);
    const bm = state.bookmarks.find(b => b.id === id);
    // clear hash after jump so refresh doesn't re-trigger
    if (bm) setTimeout(() => { jumpTo(bm); history.replaceState(null, '', location.pathname + location.search); }, 500);
    else      history.replaceState(null, '', location.pathname + location.search);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* ── wiring ─────────────────────────────────────────────────────────── */
  let _bubbleDown = false;   // true while pointer is held inside the bubble

  function wire() {
    // Suppress selectionchange-triggered hide while the user is pressing
    // inside the bubble (mousedown clears selection before click fires).
    $('an-sel').addEventListener('mousedown', () => { _bubbleDown = true; });
    document.addEventListener('mouseup', () => { setTimeout(() => { _bubbleDown = false; }, 0); });

    document.addEventListener('selectionchange', () => {
      if (_bubbleDown) return;
      if ($('an-sel').contains(document.activeElement)) return;
      const s = window.getSelection();
      if (!s || !s.toString().trim()) hideBubble();
    });

    document.addEventListener('mouseup', e => {
      if ($('an-sel').contains(e.target)) return;
      const sel = window.getSelection();
      const txt = norm(sel?.toString());
      if (!sel || sel.rangeCount === 0 || txt.length < 2) return;
      const art = article();
      if (!art) return;
      const range = sel.getRangeAt(0);
      if (!art.contains(range.commonAncestorContainer)) return;
      state.pending = buildPayload(sel, range);
      positionBubble(range);
      $('an-sel-quote').textContent = clip(txt, 48);
      $('an-sel-note').value = '';
      $('an-sel').hidden = false;
    });

    $('an-sel').addEventListener('click', e => {
      const dot = e.target.closest('.an-color-dot');
      if (dot) {
        state.selectedColorIndex = +dot.dataset.ci;
        $('an-sel').querySelectorAll('.an-color-dot').forEach(d => d.classList.remove('an-selected'));
        dot.classList.add('an-selected');
        return;
      }
      const btn = e.target.closest('[data-save-type]');
      if (btn) saveFromBubble(btn.dataset.saveType);
    });

    $('an-sel-cls').addEventListener('click', hideBubble);

    $('an-sel-note').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveFromBubble('mark'); }
    });

    $('an-lib-bd').addEventListener('click', closeLib);
    $('an-lib-cls').addEventListener('click', closeLib);
    $('an-lib-notes').addEventListener('click', openNotes);
    $('an-notes-bd').addEventListener('click', closeNotes);
    $('an-notes-cls').addEventListener('click', closeNotes);
    $('an-notes-copy').addEventListener('click', copyNotesMarkdown);
    $('an-lib-q').addEventListener('input', () => {
      state.query = norm($('an-lib-q').value).toLowerCase();
      renderLib();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') { closeNotes(); closeLib(); hideBubble(); }
    });

    window.addEventListener('pageshow', e => {
      if (e.persisted) { hideBubble(); closeLib(); }
    });

    // rail drag — _railDrag and _railMoved are module-level so renderRail doesn't leak listeners
    let _railDrag = null;
    wire._railMoved = false;
    document.addEventListener('mousemove', e => {
      if (_railDrag && Math.abs(e.clientY - _railDrag.startY) > 4) wire._railMoved = true;
      if (!_railDrag) return;
      const newTop = Math.max(60, Math.min(window.innerHeight - 120, _railDrag.startTop + e.clientY - _railDrag.startY));
      railTop = newTop;
      $('an-rail').style.top = newTop + 'px';
      $('an-rail').style.maxHeight = `calc(100vh - ${newTop + 40}px)`;
    });
    document.addEventListener('mouseup', () => {
      if (!_railDrag) return;
      $('an-rail').querySelector('.an-rail-launcher')?.classList.remove('an-dragging');
      if (wire._railMoved) localStorage.setItem(RAIL_TOP_KEY, String(railTop));
      _railDrag = null;
    });
    wire._startRailDrag = (e) => {
      _railDrag = { startY: e.clientY, startTop: railTop };
      wire._railMoved = false;
      $('an-rail').querySelector('.an-rail-launcher')?.classList.add('an-dragging');
    };
  }

  /* ── bubble ─────────────────────────────────────────────────────────── */
  function positionBubble(range) {
    const rect = range.getBoundingClientRect();
    const bw = 224;
    let left = rect.left + rect.width / 2 - bw / 2;
    left = Math.max(8, Math.min(window.innerWidth - bw - 8, left));
    const top = rect.top > 220 ? rect.top - 182 : rect.bottom + 10;
    $('an-sel').style.left = left + 'px';
    $('an-sel').style.top  = Math.max(60, top) + 'px';
  }

  function hideBubble() { $('an-sel').hidden = true; state.pending = null; }

  function saveFromBubble(type) {
    if (!state.pending) { hideBubble(); return; }
    const bm = makeBM({ ...state.pending, type, note: norm($('an-sel-note').value), colorIndex: state.selectedColorIndex });
    if (type === 'checkpoint') state.bookmarks = state.bookmarks.filter(b => b.type !== 'checkpoint');
    state.bookmarks.push(bm);
    persist();
    hideBubble();
    window.getSelection()?.removeAllRanges();
    state.pending = null;
    renderAll();
    const related = findRelated(bm);
    if (related.length > 0) {
      showToast(`${type === 'checkpoint' ? '📍 断点' : '🔖 书签'}已保存 · 💡 ${related.length} 个相关书签`, 3200);
    } else {
      showToast(type === 'checkpoint' ? '📍 阅读断点已保存' : '🔖 书签已保存');
    }
  }

  /* ── position-only checkpoint ───────────────────────────────────────── */
  function savePositionCP() {
    const art = article();
    if (!art) return;
    const pct = Math.round(window.scrollY / Math.max(1, document.body.scrollHeight - window.innerHeight) * 100);
    const el = findVisibleEl(art);
    const sect = el?.closest('[data-section]');
    const nearTxt = norm(el?.textContent || '').slice(0, 80);
    const bm = makeBM({
      type: 'checkpoint',
      selectedText: nearTxt || `第 ${pct}% 处`,
      section: sect?.dataset.section || 'article',
      contextText: nearTxt, beforeText: '', afterText: '',
      note: `滚动位置 ${pct}%`, colorIndex: 1
    });
    state.bookmarks = state.bookmarks.filter(b => b.type !== 'checkpoint');
    state.bookmarks.push(bm);
    persist(); renderAll();
    showToast('📍 当前位置已存为阅读断点');
  }

  function findVisibleEl(root) {
    const mid = window.innerHeight / 2;
    let best = null, bestDist = Infinity;
    root.querySelectorAll('p,h1,h2,h3,h4,li').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 80 || r.top > window.innerHeight - 80) return;
      const d = Math.abs(r.top + r.height / 2 - mid);
      if (d < bestDist && el.textContent.trim().length > 8) { best = el; bestDist = d; }
    });
    return best;
  }

  /* ── return checkpoint ───────────────────────────────────────────────── */
  function autoSaveReturn() {
    const art = article();
    if (!art) return;
    const el = findVisibleEl(art);
    const nearTxt = norm(el?.textContent || '').slice(0, 80);
    if (!nearTxt) return;
    const sect = el?.closest('[data-section]');
    const existing = state.bookmarks.find(b => b.type === 'return');
    if (existing) {
      Object.assign(existing, {
        selectedText: nearTxt,
        section: sect?.dataset.section || 'article',
        createdAt: new Date().toISOString()
      });
    } else {
      state.bookmarks.push(makeBM({
        type: 'return', selectedText: nearTxt,
        section: sect?.dataset.section || 'article',
        contextText: nearTxt, beforeText: '', afterText: '',
        note: '跳转前自动保存的返回点', colorIndex: 2
      }));
    }
    persist();
  }

  /* ── library ────────────────────────────────────────────────────────── */
  function openLib() { $('an-lib-bd').hidden = false; $('an-lib-pn').hidden = false; renderLib(); }
  function closeLib() { $('an-lib-bd').hidden = true; $('an-lib-pn').hidden = true; }

  /* ── notes export ───────────────────────────────────────────────────── */
  function openNotes() {
    const bms = orderedVisible().filter(b => b.type !== 'return');
    if (!bms.length) { showToast('还没有书签，先保存几个再生成笔记吧 📝'); return; }
    $('an-notes-body').innerHTML = buildNotesHTML(bms);
    $('an-notes-pn').hidden = false;
    $('an-notes-bd').hidden = false;
    $('an-notes-copy').dataset.md = buildNotesMarkdown(bms);
    $('an-notes-copy').classList.remove('an-copied');
    $('an-notes-copy').textContent = '复制 Markdown';
  }

  function closeNotes() {
    $('an-notes-pn').hidden = true;
    $('an-notes-bd').hidden = true;
  }

  function copyNotesMarkdown() {
    const md = $('an-notes-copy').dataset.md || '';
    navigator.clipboard.writeText(md).then(() => {
      $('an-notes-copy').textContent = '✓ 已复制';
      $('an-notes-copy').classList.add('an-copied');
      setTimeout(() => {
        $('an-notes-copy').textContent = '复制 Markdown';
        $('an-notes-copy').classList.remove('an-copied');
      }, 2400);
    }).catch(() => showToast('复制失败，请手动选取文本'));
  }

  function articleOverview(bms) {
    const art = article();
    const headings = art
      ? [...art.querySelectorAll('h1,h2,h3')].map(h => norm(h.textContent)).filter(Boolean).slice(0, 5)
      : [];
    const allKws = [...new Set(bms.flatMap(b => b.keywords || []))].slice(0, 8);
    const intents = [...new Set(bms.map(b => b.intent).filter(Boolean))];
    const topicStr = headings.length ? headings.slice(0, 3).join('、') : allKws.slice(0, 4).join('、');
    const intentStr = intents.length ? `涉及${intents.slice(0, 3).join('、')}等议题` : '';
    return `本文《${PAGE.title}》围绕「${topicStr || '核心议题'}」展开，${intentStr}。` +
      `你共在 ${bms.length} 处保存了书签，AI 识别到你重点关注「${allKws.slice(0, 4).join('、') || '关键内容'}」。` +
      `以下是各书签位置的知识点解读，帮助你在不重读全文的情况下快速恢复和深化理解。`;
  }

  function buildNotesHTML(bms) {
    const overview = articleOverview(bms);
    const allKws = [...new Set(bms.flatMap(b => b.keywords || []))].slice(0, 12);
    const intentColorMap = { '技术实现': 'an-tag-tech', '数据洞察': 'an-tag-data', '产品价值': 'an-tag-prod' };
    const marks = bms.filter(b => b.type === 'mark');
    const cps   = bms.filter(b => b.type === 'checkpoint');

    let html = `
      <div class="an-notes-section">
        <div class="an-notes-section-title">文章概述</div>
        <div class="an-notes-overview">${esc(overview)}</div>
      </div>`;

    if (allKws.length) {
      html += `<div class="an-notes-section">
        <div class="an-notes-section-title">主题关键词</div>
        <div class="an-notes-tags">
          ${allKws.map(k => `<span class="an-notes-tag">${esc(k)}</span>`).join('')}
        </div>
      </div>`;
    }

    if (marks.length) {
      html += `<div class="an-notes-section">
        <div class="an-notes-section-title">书签知识点（${marks.length} 处）</div>`;
      marks.forEach((bm, i) => {
        const icon = intentIcon(bm.intent || '关键内容');
        html += `<div class="an-notes-km">
          <div class="an-notes-km-header">
            <div class="an-notes-km-num">${i + 1}</div>
            <div class="an-notes-km-title">${esc(bm.title)}</div>
            <span class="an-notes-km-intent">${icon} ${esc(bm.intent || '关键内容')}</span>
          </div>
          <div class="an-notes-km-quote">${esc(bm.selectedText)}</div>
          <div class="an-notes-km-explain">${esc(buildKnowledgePoint(bm))}</div>
          ${bm.note ? `<div class="an-notes-km-note">💬 你的备注：${esc(bm.note)}</div>` : ''}
          <div class="an-notes-km-next">${esc(bm.nextAction)}</div>
        </div>`;
      });
      html += `</div>`;
    }

    if (cps.length) {
      html += `<div class="an-notes-section">
        <div class="an-notes-section-title">阅读断点（${cps.length} 处）</div>`;
      cps.forEach(bm => {
        html += `<div class="an-notes-km" style="border-left:3px solid #1f6feb">
          <div class="an-notes-km-header">
            <div class="an-notes-km-num" style="background:#1f6feb">📍</div>
            <div class="an-notes-km-title">断点位置：${esc(clip(bm.selectedText, 30))}</div>
          </div>
          <div class="an-notes-km-next">${esc(bm.note || '下次继续从这里阅读')}</div>
        </div>`;
      });
      html += `</div>`;
    }

    return html;
  }

  function buildKnowledgePoint(bm) {
    const kws = (bm.keywords || []).slice(0, 3).join('、');
    const intent = bm.intent || '关键内容';
    const expand = {
      '问题痛点':  `这段揭示了"${kws || bm.title}"方面的核心问题，是理解整篇文章立论基础的关键位置。理解这里有助于你判断作者提出方案的必要性和针对性。`,
      '技术实现':  `这段描述了"${kws || bm.title}"的具体实现方式。技术细节类书签通常有较高的复访价值——回来时重点关注实现的前提条件和局限边界。`,
      '产品价值':  `这段阐明了"${kws || bm.title}"所带来的用户或商业价值。产品价值类内容适合在汇报或提案时直接引用，建议同时找一段数据支撑配合使用。`,
      '数据洞察':  `这段提供了关于"${kws || bm.title}"的关键数据或量化结论。数据书签的核心用法是横向比对——搭配其他数据书签看趋势和矛盾，单独看容易缺乏上下文。`,
      '政策法规':  `这段涉及"${kws || bm.title}"的政策要点或合规要求。法规类内容时效性较强，建议标注阅读日期，后续关注政策细则的更新动态。`,
      '战略建议':  `这段给出了关于"${kws || bm.title}"的可操作方向或策略建议。战略类书签的核心价值在于结合自身场景判断落地可行性，而不是照搬。`,
      '个人经历':  `这段记录了与"${kws || bm.title}"有关的真实经历或感受。个人叙事类内容最适合反复品读，注意作者在细节选取上的倾向性，这往往揭示了深层观点。`,
    };
    return expand[intent] || `这段围绕"${kws || clip(bm.selectedText, 16)}"展开，${bm.summary}回访时可结合上下文段落一起重读，以恢复完整的阅读语境。`;
  }

  function buildNotesMarkdown(bms) {
    const overview = articleOverview(bms);
    const allKws = [...new Set(bms.flatMap(b => b.keywords || []))].slice(0, 12);
    const marks = bms.filter(b => b.type === 'mark');
    const cps   = bms.filter(b => b.type === 'checkpoint');
    const date  = new Date().toLocaleDateString('zh-CN');

    let md = `# ${PAGE.title} · AI 阅读笔记\n\n`;
    md += `> 由 AnchorNote 根据 ${bms.length} 条书签自动生成 · ${date}\n\n`;
    md += `## 📖 文章概述\n\n${overview}\n\n`;
    if (allKws.length) md += `## 🏷️ 主题关键词\n\n${allKws.map(k => `\`${k}\``).join('  ')}\n\n`;
    if (marks.length) {
      md += `## 📌 书签知识点\n\n`;
      marks.forEach((bm, i) => {
        md += `### ${i + 1}. ${bm.title}\n\n`;
        md += `> ${bm.selectedText}\n\n`;
        md += `**分类**：${intentIcon(bm.intent || '关键内容')} ${bm.intent || '关键内容'}\n\n`;
        md += `${buildKnowledgePoint(bm)}\n\n`;
        if (bm.note) md += `**备注**：${bm.note}\n\n`;
        md += `**→ 下一步**：${bm.nextAction}\n\n`;
        md += `---\n\n`;
      });
    }
    if (cps.length) {
      md += `## 📍 阅读断点\n\n`;
      cps.forEach(bm => {
        md += `- **${clip(bm.selectedText, 40)}** — ${bm.note || '下次继续从这里阅读'}\n`;
      });
      md += '\n';
    }
    md += `---\n*由 [AnchorNote](${PAGE.url}) 生成 · ${date}*\n`;
    return md;
  }

  /* ── toast ──────────────────────────────────────────────────────────── */
  function showToast(msg, dur = 2200) {
    const t = $('an-toast');
    t.textContent = msg;
    t.classList.add('an-toast-show');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('an-toast-show'), dur);
  }

  /* ── render ─────────────────────────────────────────────────────────── */
  function renderAll() {
    renderRail();
    renderLib();
    if (MODE === 'doc') renderDocAnnotations();
  }

  function renderRail() {
    const rail = $('an-rail');
    rail.textContent = '';
    rail.style.top = railTop + 'px';
    rail.style.maxHeight = `calc(100vh - ${railTop + 40}px)`;
    if (railHidden) rail.classList.add('an-rail-hidden');
    else rail.classList.remove('an-rail-hidden');

    // hide / show toggle — always visible even when rail is collapsed
    const hideBtn = mkEl('button', 'an-rail-hide-btn');
    hideBtn.title = railHidden ? '显示书签便签' : '隐藏书签便签';
    hideBtn.textContent = railHidden ? '显\n示' : '隐\n藏';
    hideBtn.addEventListener('click', () => {
      railHidden = !railHidden;
      localStorage.setItem(RAIL_HIDDEN_KEY, railHidden ? '1' : '0');
      renderRail();
    });
    rail.appendChild(hideBtn);

    if (railHidden) return;   // skip rendering stickies when hidden

    // launcher doubles as drag handle
    const launcher = mkEl('button', 'an-rail-launcher');
    launcher.title = '点击打开书签库 · 拖拽调整位置';
    launcher.innerHTML = `<span>${orderedVisible().length} 书签</span>`;
    launcher.addEventListener('mousedown', e => {
      wire._startRailDrag?.(e);
      e.preventDefault();
    });
    launcher.addEventListener('click', () => {
      if (!wire._railMoved) openLib();
    });
    rail.appendChild(launcher);

    const cpBtn = mkEl('button', 'an-rail-cp-btn');
    cpBtn.textContent = '存\n断点';
    cpBtn.title = '保存当前阅读位置为断点（无需选中文字）';
    cpBtn.addEventListener('click', savePositionCP);
    rail.appendChild(cpBtn);

    let _dragSrc = null;
    orderedVisible().forEach((bm, idx, arr) => {
      const c = COLORS[bm.colorIndex % COLORS.length];
      const note = mkEl('div', 'an-sticky');
      note.style.setProperty('--an-bg', c.bg);
      note.style.setProperty('--an-accent', c.accent);
      note.style.setProperty('--an-text', c.text);
      note.tabIndex = 0;
      note.setAttribute('draggable', 'true');
      note.dataset.bmId = bm.id;
      note.innerHTML = `
        <button class="an-del" type="button">×</button>
        ${bm.crossPage ? '<div class="an-site-badge">本站↗</div>' : ''}
        <span style="${bm.crossPage ? 'margin-top:16px' : ''}">${esc(shortLbl(bm))}</span>
        <div class="an-sticky-detail">
          ${bm.crossPage ? '<div style="font-size:11px;color:#1d4ed8;font-weight:700;margin-bottom:6px;background:rgba(0,110,255,.08);border-radius:5px;padding:3px 8px;display:inline-block">📎 本站书签 · 跨页跳转</div>' : ''}
          <h3>${esc(bm.title)}</h3>
          <p><mark>${esc(bm.selectedText)}</mark></p>
          <p>${esc(bm.summary)}</p>
          <p>${esc(bm.aiReason)}</p>
          ${bm.note ? `<p><strong>备注：</strong>${esc(bm.note)}</p>` : ''}
          <p>${esc(bm.nextAction)}</p>
          <div class="an-d-actions">
            <button class="an-jump-s">${bm.crossPage ? '跳转页面' : '跳转'}</button>
            <button class="an-edit-s">备注</button>
            ${idx > 0            ? '<button class="an-up-s">↑</button>' : ''}
            ${idx < arr.length-1 ? '<button class="an-dn-s">↓</button>' : ''}
          </div>
        </div>`;

      // drag-to-reorder
      note.addEventListener('dragstart', e => {
        _dragSrc = bm.id;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => note.classList.add('an-drag-over'), 0);
      });
      note.addEventListener('dragend',   () => { _dragSrc = null; note.classList.remove('an-drag-over'); });
      note.addEventListener('dragover',  e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; note.classList.add('an-drag-over'); });
      note.addEventListener('dragleave', () => note.classList.remove('an-drag-over'));
      note.addEventListener('drop', e => {
        e.preventDefault();
        note.classList.remove('an-drag-over');
        if (!_dragSrc || _dragSrc === bm.id) return;
        const srcIdx = state.bookmarks.findIndex(b => b.id === _dragSrc);
        const dstIdx = state.bookmarks.findIndex(b => b.id === bm.id);
        if (srcIdx < 0 || dstIdx < 0) return;
        const [moved] = state.bookmarks.splice(srcIdx, 1);
        state.bookmarks.splice(dstIdx, 0, moved);
        persist(); renderAll();
      });

      note.querySelector('.an-jump-s').addEventListener('click', () => jumpTo(bm));
      note.querySelector('.an-del').addEventListener('click', e => {
        e.stopPropagation();
        state.bookmarks = state.bookmarks.filter(b => b.id !== bm.id);
        persist(); renderAll();
      });
      note.querySelector('.an-edit-s').addEventListener('click', () => {
        const v = prompt('修改备注，可留空', bm.note || '');
        if (v === null) return;
        bm.note = norm(v); persist(); renderAll();
      });
      note.querySelector('.an-up-s')?.addEventListener('click', e => { e.stopPropagation(); moveInArray(bm.id, -1); });
      note.querySelector('.an-dn-s')?.addEventListener('click', e => { e.stopPropagation(); moveInArray(bm.id,  1); });
      note.addEventListener('dblclick', () => jumpTo(bm));

      // position the fixed detail panel vertically when the note is hovered/focused
      const detail = note.querySelector('.an-sticky-detail');
      const pinDetail = () => {
        const r = note.getBoundingClientRect();
        const maxTop = window.innerHeight - detail.offsetHeight - 12;
        detail.style.top = Math.max(8, Math.min(isFinite(maxTop) ? maxTop : r.top, r.top)) + 'px';
      };
      note.addEventListener('mouseenter', pinDetail);
      note.addEventListener('focus', pinDetail);

      rail.appendChild(note);
    });
  }

  function renderLib() {
    const body = $('an-lib-body');
    body.textContent = '';
    const visible = orderedVisible();
    const matched = visible.filter(matchQ);
    const hasReturn = state.bookmarks.find(b => b.type === 'return');
    const hasSources = visible.some(b => b.source);
    const isDense = visible.length >= 8;

    const card = mkEl('div', 'an-lib-card');
    card.innerHTML = `
      <h2>${hi(PAGE.title)}</h2>
      <div class="an-lib-url">${hi(PAGE.url)}</div>
      <div class="an-lib-ai${isDense ? ' an-warn' : ''}">${hi(pageSumm(matched.length ? matched : visible, visible.length))}</div>
      ${visible.length >= 2 ? resumeBriefHTML(visible) : ''}
      <div class="an-lib-actions">
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button id="an-goto-cp">回到阅读断点</button>
          ${hasReturn ? '<button id="an-goto-ret" style="background:#e5fbf4;color:#087967">↩ 返回上次位置</button>' : ''}
        </div>
        <span>${matched.length} 个书签位置</span>
      </div>
      <div id="an-bm-list" class="an-bm-list"></div>`;

    card.querySelector('#an-goto-cp').addEventListener('click', () => {
      const cp = state.bookmarks.find(b => b.type === 'checkpoint') || visible[0];
      if (cp) jumpTo(cp);
    });
    card.querySelector('#an-goto-ret')?.addEventListener('click', () => {
      const ret = state.bookmarks.find(b => b.type === 'return');
      if (!ret) return;
      closeLib(); clearHi();
      const target = hiText(ret.selectedText, article()) || article();
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      state.bookmarks = state.bookmarks.filter(b => b.type !== 'return');
      persist(); renderAll();
    });

    const list = card.querySelector('#an-bm-list');
    if (hasSources)           renderBySource(matched, list);
    else if (matched.length >= 3) renderByIntent(matched, list);
    else                      matched.forEach(bm => list.appendChild(renderBmItem(bm)));

    body.appendChild(card);
  }

  function renderBySource(bms, container) {
    const groups = {};
    bms.forEach(bm => { const k = bm.source || '当前文章'; (groups[k] = groups[k] || []).push(bm); });
    Object.entries(groups).forEach(([src, items]) => {
      const sec = mkEl('div', 'an-cluster-section');
      sec.innerHTML = `<div class="an-cluster-head">📄 ${esc(src)}<span>${items.length} 条</span></div>`;
      const sub = mkEl('div', 'an-bm-list');
      items.forEach(bm => sub.appendChild(renderBmItem(bm)));
      sec.appendChild(sub); container.appendChild(sec);
    });
  }

  function renderByIntent(bms, container) {
    const groups = {};
    bms.forEach(bm => { const k = bm.intent || '关键内容'; (groups[k] = groups[k] || []).push(bm); });
    Object.entries(groups).forEach(([intent, items]) => {
      const sec = mkEl('div', 'an-cluster-section');
      sec.innerHTML = `<div class="an-cluster-head">${intentIcon(intent)} ${esc(intent)}<span>${items.length} 条</span></div>`;
      const sub = mkEl('div', 'an-bm-list');
      items.forEach(bm => sub.appendChild(renderBmItem(bm)));
      sec.appendChild(sub); container.appendChild(sec);
    });
  }

  function renderBmItem(bm) {
    const item = mkEl('div', 'an-bm-item');
    const colorDots = COLORS.map((c, i) =>
      `<button class="an-bm-cdot${bm.colorIndex === i ? ' an-sel' : ''}" data-ci="${i}" style="background:${c.accent}" title="${['黄','蓝','绿','红','紫'][i]}"></button>`
    ).join('');
    item.innerHTML = `
      <div class="an-bm-row">
        <span class="an-bm-type">
          ${bm.type === 'checkpoint' ? '📍 阅读断点' : '🔖 标记书签'}
          ${bm.source ? `<span class="an-src-badge">${esc(bm.source)}</span>` : ''}
        </span>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="an-bm-jump">跳转</button>
          <button class="an-bm-open" title="在新标签页打开原文">↗</button>
          <button class="an-bm-edit" title="编辑备注">✏️</button>
          <button class="an-bm-del" title="删除书签">×</button>
        </div>
      </div>
      <h3>${hi(bm.title)}</h3>
      <p>${hi(bm.summary)}</p>
      <p>${hi(bm.selectedText)}</p>
      <div class="an-bm-note-area">${bm.note ? `<p class="an-bm-note-txt">${hi('备注：' + bm.note)}</p>` : ''}</div>
      <div class="an-bm-colors">
        <span class="an-bm-colors-lbl">颜色</span>
        ${colorDots}
      </div>`;
    item.querySelector('.an-bm-jump').addEventListener('click', () => jumpTo(bm));
    item.querySelector('.an-bm-open').addEventListener('click', () => window.open(bm.pageUrl || PAGE.url, '_blank'));
    item.querySelector('.an-bm-del').addEventListener('click', () => {
      state.bookmarks = state.bookmarks.filter(b => b.id !== bm.id);
      persist(); renderAll();
    });
    item.querySelector('.an-bm-edit').addEventListener('click', () => openNoteEditor(bm, item));
    // re-open editor if this bm was being edited before renderAll
    if (state.editingBmId === bm.id) openNoteEditor(bm, item);
    item.querySelectorAll('.an-bm-cdot').forEach(dot => {
      dot.addEventListener('click', () => {
        bm.colorIndex = +dot.dataset.ci;
        persist(); renderAll();
      });
    });
    return item;
  }

  function openNoteEditor(bm, item) {
    const area = item.querySelector('.an-bm-note-area');
    if (!area) return;
    const existing = area.querySelector('.an-bm-note-input');
    if (existing) { existing.focus(); return; }
    state.editingBmId = bm.id;
    const ta = document.createElement('textarea');
    ta.className = 'an-bm-note-input';
    ta.value = bm.note || '';
    ta.rows = 2;
    ta.placeholder = '写备注（可留空）…';
    const saveBtn = mkEl('button', 'an-bm-note-save');
    saveBtn.textContent = '保存';
    area.textContent = '';
    area.appendChild(ta);
    area.appendChild(saveBtn);
    ta.focus();
    const doSave = () => {
      bm.note = norm(ta.value);
      state.editingBmId = null;
      persist(); renderAll();
    };
    const doCancel = () => { state.editingBmId = null; renderAll(); };
    saveBtn.addEventListener('click', doSave);
    ta.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); doSave(); }
      if (e.key === 'Escape') doCancel();
    });
  }

  /* ── doc mode annotations ───────────────────────────────────────────── */
  function renderDocAnnotations() {
    clearDocAnnotations();
    const art = article();
    if (!art) return;
    orderedVisible().forEach(bm => {
      const c = COLORS[bm.colorIndex % COLORS.length];
      const mark = hiTextDoc(bm.selectedText, art, c);
      if (!mark) return;
      const para = mark.closest('p,h1,h2,h3,h4,h5,h6,li') || mark.parentElement;
      if (!para) return;
      if (!para.style.position) para.style.position = 'relative';
      para.classList.add('an-has-anno');
      const dot = mkEl('span', 'an-doc-dot');
      dot.style.background = c.accent;
      dot.title = clip(bm.note || bm.title, 32);
      dot.addEventListener('click', e => { e.stopPropagation(); jumpTo(bm); });
      para.appendChild(dot);
    });
  }

  function clearDocAnnotations() {
    document.querySelectorAll('.an-doc-dot').forEach(d => d.remove());
    document.querySelectorAll('.an-doc-hi').forEach(m => {
      if (m.parentNode) {
        m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
        m.parentNode.normalize();
      }
    });
    document.querySelectorAll('.an-has-anno').forEach(el => el.classList.remove('an-has-anno'));
  }

  function hiTextDoc(text, container, color) {
    const n = norm(text);
    if (!n || !container) return null;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!norm(node.nodeValue).includes(n)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest('script,style,.an-doc-hi,.an-hi')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const node = walker.nextNode();
    if (!node) return null;
    // prefer exact match; fall back to normalised-text index if whitespace differs
    let startIdx = node.nodeValue.indexOf(text);
    let matchLen = text.length;
    if (startIdx < 0) {
      startIdx = norm(node.nodeValue).indexOf(n);
      matchLen  = n.length;
    }
    if (startIdx < 0) return node.parentElement;
    const range = document.createRange();
    range.setStart(node, startIdx);
    range.setEnd(node, startIdx + matchLen);
    const mark = document.createElement('mark');
    mark.className = 'an-doc-hi';
    mark.style.cssText = `background:${color.bg};border-bottom:2px solid ${color.accent};border-radius:3px;padding:0 1px;`;
    try { range.surroundContents(mark); return mark; } catch { return node.parentElement; }
  }

  /* ── jump ───────────────────────────────────────────────────────────── */
  function jumpTo(bm) {
    autoSaveReturn();
    closeLib();
    clearHi();
    const art = article();
    let scrollTarget, pulseTarget;

    if (MODE === 'doc') {
      const n = norm(bm.selectedText).slice(0, 16);
      const docMark = [...document.querySelectorAll('.an-doc-hi')]
        .find(m => norm(m.textContent).startsWith(n));
      if (docMark) {
        scrollTarget = docMark;
        /* pulse the stable paragraph, not the mark that renderAll() will rebuild */
        pulseTarget = docMark.closest('p,h1,h2,h3,h4,h5,h6,li') || docMark.parentElement;
      }
    }
    if (!scrollTarget) {
      const textHit = hiText(bm.selectedText, art);
      if (!textHit && cfg.onJumpFail) {
        // crossPage bookmarks navigate away — skip the lazy-load toast
        if (!bm.crossPage) showToast('⏳ 内容尚未加载，正在自动滚动加载…', 3500);
        cfg.onJumpFail(bm, function retryJump() {
          clearHi();
          const target = hiText(bm.selectedText, article());
          if (target) {
            const pulse = target.closest('article,.news-card,p,h1,h2,h3,li') || target;
            pulse.scrollIntoView({ behavior: 'smooth', block: 'center' });
            pulse.classList.add('an-pulse');
            setTimeout(() => pulse.classList.remove('an-pulse'), 1400);
          }
          renderAll();
        });
        return;
      }
      if (!textHit && cfg.semanticRelocate) {
        semanticRelocate(bm, art);
        return;
      }
      scrollTarget = textHit || art?.querySelector(`[data-section="${bm.section}"]`) || art;
      pulseTarget = scrollTarget;
    }
    if (!scrollTarget) return;
    scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (pulseTarget) {
      pulseTarget.classList.add('an-pulse');
      setTimeout(() => pulseTarget.classList.remove('an-pulse'), 900);
    }
    renderAll();
  }

  function hiText(text, container) {
    const n = norm(text);
    if (!n || !container) return null;
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        if (!norm(node.nodeValue).includes(n)) return NodeFilter.FILTER_REJECT;
        if (node.parentElement.closest('script,style,mark,.an-hi')) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const node = walker.nextNode();
    if (!node) return null;
    let startIdx = node.nodeValue.indexOf(text);
    let matchLen = text.length;
    if (startIdx < 0) {
      startIdx = norm(node.nodeValue).indexOf(n);
      matchLen  = n.length;
    }
    if (startIdx < 0) return node.parentElement;
    const range = document.createRange();
    range.setStart(node, startIdx);
    range.setEnd(node, startIdx + matchLen);
    const mark = document.createElement('mark');
    mark.className = 'an-hi';
    mark.style.display = 'inline';
    try { range.surroundContents(mark); return mark; } catch { return node.parentElement; }
  }

  function clearHi() {
    document.querySelectorAll('.an-hi').forEach(m => {
      if (m.parentNode) {
        m.parentNode.replaceChild(document.createTextNode(m.textContent), m);
        m.parentNode.normalize();
      }
    });
  }

  /* ── AI semantic relocation ─────────────────────────────────────────── */
  function semanticRelocate(bm, art) {
    showToast('🔍 AI 语义匹配中，正在遍历段落…', 2500);

    function bigrams(str) {
      const clean = str.replace(/[\s\n\r\t，。、！？：；""''【】（）《》\[\]·…]/g, '');
      const s = new Set();
      for (let i = 0; i < clean.length - 1; i++) s.add(clean.slice(i, i + 2));
      return s;
    }
    function simScore(a, b) {
      const ba = bigrams(a), bb = bigrams(b);
      if (!ba.size || !bb.size) return 0;
      let inter = 0;
      ba.forEach(g => { if (bb.has(g)) inter++; });
      return 2 * inter / (ba.size + bb.size);
    }

    // Build query from saved text + context
    const query = ((bm.selectedText || '') + ' ' + (bm.contextText || '')).trim();

    // Candidates: paragraph-level elements in article
    const root = art || document.body;
    const candidates = [...root.querySelectorAll('p, h2, h3, h4, li, blockquote')]
      .filter(el => {
        const t = el.textContent.trim();
        return t.length > 20 && !el.closest('script,style,.an-hi');
      });

    let best = null, bestScore = 0;
    candidates.forEach(el => {
      const score = simScore(query, el.textContent);
      if (score > bestScore) { bestScore = score; best = el; }
    });

    const THRESHOLD = 0.18;
    setTimeout(() => {
      if (best && bestScore >= THRESHOLD) {
        best.scrollIntoView({ behavior: 'smooth', block: 'center' });
        best.classList.add('an-pulse');
        setTimeout(() => best.classList.remove('an-pulse'), 1600);
        // brief scan-highlight outline on best match
        const prev = best.style.outline;
        best.style.outline = '2px dashed rgba(0,110,255,.6)';
        best.style.outlineOffset = '4px';
        setTimeout(() => { best.style.outline = prev; best.style.outlineOffset = ''; }, 2000);
        showToast('✅ 原文已更新，已定位到最相似位置 ↓', 5000);
      } else {
        showToast('⚠️ 未找到相似段落，原文内容可能已被删除', 4000);
      }
      renderAll();
    }, 900);
  }

  /* ── order ──────────────────────────────────────────────────────────── */
  function moveInArray(id, dir) {
    const vis = orderedVisible();
    const idx = vis.findIndex(b => b.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= vis.length) return;
    const ai = state.bookmarks.indexOf(vis[idx]);
    const bi = state.bookmarks.indexOf(vis[swapIdx]);
    if (ai < 0 || bi < 0) return;
    [state.bookmarks[ai], state.bookmarks[bi]] = [state.bookmarks[bi], state.bookmarks[ai]];
    persist(); renderAll();
  }

  /* ── related bookmarks ───────────────────────────────────────────────── */
  function findRelated(bm) {
    const kws = new Set(bm.keywords || []);
    return state.bookmarks.filter(b =>
      b.id !== bm.id && b.type !== 'return' &&
      (b.keywords || []).some(k => kws.has(k))
    );
  }

  /* ── bookmark helpers ───────────────────────────────────────────────── */
  function buildPayload(sel, range) {
    const txt = norm(sel.toString());
    const anc = range.commonAncestorContainer;
    const el  = anc.nodeType === Node.TEXT_NODE ? anc.parentElement : anc;
    const sect = el?.closest?.('[data-section]');
    const art  = article();
    const secTxt = norm(sect?.textContent || art?.textContent || '');
    return {
      selectedText: txt,
      section: sect?.dataset.section || 'article',
      contextText:  clip(secTxt, 360),
      beforeText:   clip(secTxt.slice(0, Math.max(0, secTxt.indexOf(txt))), 140),
      afterText:    clip(secTxt.slice(secTxt.indexOf(txt) + txt.length), 180)
    };
  }

  function makeBM(input) {
    const meta = genMeta(input);
    return {
      id:          input.id || crypto.randomUUID(),
      pageId:      PAGE.id,
      pageTitle:   PAGE.title,
      pageUrl:     PAGE.url,
      type:        input.type || 'mark',
      section:     input.section || 'article',
      source:      norm(input.source || ''),
      selectedText: norm(input.selectedText),
      contextText:  norm(input.contextText || ''),
      beforeText:   norm(input.beforeText  || ''),
      afterText:    norm(input.afterText   || ''),
      note:         norm(input.note        || ''),
      colorIndex:   input.colorIndex ?? 0,
      createdAt:    input.createdAt || new Date().toISOString(),
      crossPage:    input.crossPage || false,
      sourceUrl:    input.sourceUrl || '',
      ...meta
    };
  }

  function genMeta(bm) {
    const txt      = norm(bm.selectedText);
    const ctx      = norm(bm.contextText || txt);
    const keywords = kwds(`${txt} ${ctx}`).slice(0, 4);
    const intent   = infer(`${txt} ${ctx}`);
    const isSpecial = bm.type === 'checkpoint' || bm.type === 'return';
    const pfx  = isSpecial ? '读到' : intent;
    const next = bm.afterText
      ? `接下来重点看：${clip(bm.afterText, 46)}`
      : (NEXT_ACT[intent] || '继续阅读这段前后的上下文。');
    return {
      title:      `${pfx}：${clip(txt, 18)}`,
      summary:    buildSumm(intent, keywords, txt),
      aiReason:   `AI 理解这块更像"${intent}"，和"${keywords.join('、') || clip(txt,12)}"有关。`,
      nextAction: next,
      keywords,
      intent
    };
  }

  function seedBMs() {
    const seeds = cfg.seedBookmarks || [];
    if (!seeds.length) return;

    // If seedVersion in config is higher than what's stored, force a full reseed.
    const cfgVer   = cfg.seedVersion || 0;
    const storedVer = parseInt(localStorage.getItem(STORAGE_KEY + '.sv') || '0', 10);
    if (cfgVer > storedVer) {
      state.bookmarks = seeds.map((s, i) => makeBM({ ...s, colorIndex: s.colorIndex ?? i % COLORS.length }));
      localStorage.setItem(STORAGE_KEY + '.sv', String(cfgVer));
      persist();
      return;
    }

    // In doc mode, reseed if the stored bookmarks no longer match the article text
    // (stale localStorage from a previous version of the page)
    if (state.bookmarks.length && MODE === 'doc') {
      const art = article();
      const stale = art && state.bookmarks.every(b =>
        !b.selectedText || !art.textContent.includes(b.selectedText.slice(0, 10))
      );
      if (!stale) return;
    } else if (state.bookmarks.length) {
      return;
    }
    state.bookmarks = seeds.map((s, i) => makeBM({ ...s, colorIndex: i % COLORS.length }));
    persist();
  }

  function ordered() {
    const checkpoints = state.bookmarks.filter(b => b.type === 'checkpoint');
    const normals     = state.bookmarks.filter(b => b.type !== 'checkpoint' && b.type !== 'return');
    const ret         = state.bookmarks.filter(b => b.type === 'return');
    return [...checkpoints, ...normals, ...ret];
  }
  function orderedVisible() { return ordered().filter(b => b.type !== 'return'); }
  function matchQ(bm) {
    if (!state.query) return true;
    return [bm.title, bm.summary, bm.selectedText, bm.note, bm.aiReason, bm.source, ...(bm.keywords||[])]
      .join(' ').toLowerCase().includes(state.query);
  }

  function resumeBriefHTML(bms) {
    const marks = bms.filter(b => b.type === 'mark');
    if (marks.length < 2) return '';
    const kws  = [...new Set(bms.flatMap(b => b.keywords || []))].slice(0, 6);
    const focus = kws.slice(0, 3).join('、') || '关键内容';
    const points = marks.slice(0, 4).map(b => `<li>${esc(clip(b.title, 28))}</li>`).join('');
    // suggest based on dominant intent
    const intents = bms.map(b => b.intent).filter(Boolean);
    const topIntent = intents.sort((a,b)=>intents.filter(v=>v===b).length-intents.filter(v=>v===a).length)[0];
    const suggest = NEXT_ACT[topIntent] || '继续深入阅读，挖掘书签间的关联。';
    return `<div class="an-resume">
      <div class="an-resume-title">✨ AI 回访简报</div>
      <div class="an-resume-focus">关注焦点：${esc(focus)}</div>
      <ul class="an-resume-points">${points}</ul>
      <div class="an-resume-suggest">📌 ${esc(suggest)}</div>
    </div>`;
  }

  function pageSumm(bms, total) {
    const kws = [...new Set(bms.flatMap(b => b.keywords || []))].slice(0, 5);
    if (total >= 8) {
      return `⚠️ 书签密度较高（${total} 个）——AI 建议合并同类项，减少认知负担。当前关注重心：「${kws.slice(0,3).join('、')}」。`;
    }
    return `AI 总结：你在这里保存了 ${bms.length} 个位置，主要关注「${kws.join('、') || '阅读内容'}」。书签帮你恢复阅读现场，而不只是回到页面顶部。`;
  }

  function buildSumm(intent, keywords, txt) {
    const core = keywords.slice(0, 2).join('、') || clip(txt, 12);
    const map = {
      '问题痛点': `这段指出"${core}"相关痛点，是理解项目必要性的关键位置。`,
      '技术实现': `这段在讲"${core}"的实现方式，适合回来深入理解。`,
      '产品价值': `这段说明"${core}"带来的产品价值，可用于表达产品核心竞争力。`,
      '数据洞察': `这段提供了关于"${core}"的关键数据，值得保存对比参考。`,
      '政策法规': `这段涉及"${core}"的政策要点，适合合规研究时回访。`,
      '个人经历': `这段记录了关于"${core}"的真实经历，值得反复思考。`,
      '战略建议': `这段提出了关于"${core}"的可操作建议，适合制定方向时参考。`,
    };
    return map[intent] || `这段内容围绕"${core}"展开，适合恢复当时的阅读关注点。`;
  }

  function infer(txt) {
    if (/问题|失效|不够|痛点|只能|困难|挑战|断点|失准/.test(txt)) return '问题痛点';
    if (/AI|定位|相似度|上下文|语义|算法|模型|技术|实现/.test(txt)) return '技术实现';
    if (/竞争力|价值|助手|恢复|留存|增长|用户需求/.test(txt))      return '产品价值';
    if (/数据|%|亿|增速|规模|市场|调研|完读率|留存率/.test(txt))  return '数据洞察';
    if (/政策|法规|监管|合规|条例|办法|治理/.test(txt))           return '政策法规';
    if (/建议|策略|路径|推荐|应当|应该|部署/.test(txt))           return '战略建议';
    if (/我|感受|记得|经历|那一年|那时|第.*年/.test(txt))          return '个人经历';
    return '关键内容';
  }

  function kwds(txt) {
    const stop = new Set(['一个','这段','用户','网页','可以','需要','如果','什么','进行','相关','通过','实现','已经','没有','我们','这个','那个']);
    return [...new Set((norm(txt).match(/[一-龥]{2,8}|[A-Za-z]{3,}/g)||[]).filter(w=>!stop.has(w)))];
  }

  function intentIcon(intent) { return INTENT_ICON[intent] || '📌'; }

  function shortLbl(bm) {
    if (bm.type === 'checkpoint') return '阅读\n断点';
    return clip(bm.note || bm.title.replace(/^.*?：/, ''), 6);
  }

  /* ── storage & utils ─────────────────────────────────────────────────── */
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state.bookmarks)); }
    catch { showToast('⚠️ 存储失败：空间不足或被浏览器限制'); }
  }
  function loadBMs()  { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return []; } }

  function norm(v)  { return String(v||'').replace(/\s+/g,' ').trim(); }
  function clip(v,n){ const t=norm(v); return t.length>n?t.slice(0,n)+'…':t; }
  function esc(v)   { return String(v||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function hi(v) {
    const t = esc(v);
    if (!state.query) return t;
    return t.replace(new RegExp(`(${escRe(state.query)})`,'gi'),'<mark class="an-search-hit">$1</mark>');
  }
  function escRe(v) { return v.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  function mkEl(tag,cls) { const e=document.createElement(tag); if(cls) e.className=cls; return e; }

})();
