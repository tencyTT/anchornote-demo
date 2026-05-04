# AnchorNote Demo — 技术参考文档

> 本文档覆盖所有 demo 页面的技术细节。项目背景、AI 设计理念和 Chrome 扩展完整实现请参阅根目录 `README.md`。

---

## 快速启动

```bash
# 方式一：直接打开（部分 deep link 跳转在 file:// 下可能受限）
open /path/to/demo/index.html

# 方式二：HTTP 服务（推荐，支持全部功能）
python3 -m http.server 3000 --directory /path/to/demo
# 访问 http://localhost:3000
```

访问页面后，如果书签显示异常，请先清除对应 pageId 的 localStorage：
```js
// 在浏览器控制台执行，pageId 见下表
localStorage.removeItem('anchornote.embed.tencent-news-deep');
```

---

## 页面清单与 pageId 对照

| 文件路径 | pageId | 演示场景 | mode |
|----------|--------|---------|------|
| `pages/tencent-news-deep.html` | `tencent-news-deep` | 长文阅读、书签保存、AI 意图分析 | `article` |
| `pages/tencent-news-yaowen.html` | `tencent-news-yaowen` | 跨页断点继续阅读、懒加载书签定位 | `article` |
| `pages/tencent-research-index.html` | —（无 embed） | 断点汇总侧边栏（读其他页 localStorage） | 无 |
| `pages/research-report.html` | `research-report-2024` | 多来源书签、AI 回访简报 | `article` |
| `pages/tencent-doc.html` | `tencent-doc-anchornote-v23` | 正文持久高亮、边距圆点 | `doc` |
| `pages/penguin-article.html` | `penguin-article-dachang` | 个人叙事长文标注 | `article` |
| `pages/content-research.html` | `content-research-ai-reader-2024` | 多来源书签聚合、按来源分组 | `article` |
| `dashboard.html`（上一级） | —（读取所有页面） | 全局书签聚合、跨页搜索与跳转 | 无 |

---

## anchornote-embed.js 完整功能说明

### ANCHORNOTE_CONFIG 配置项

```js
window.ANCHORNOTE_CONFIG = {
  // ── 必填 ──
  pageId:          'unique-page-id',   // localStorage 键后缀，必须全局唯一
  pageTitle:       '页面显示标题',
  pageUrl:         '展示用 URL（非真实请求）',

  // ── 可选 ──
  articleSelector: '#article',         // 指定可选文字的容器（默认 #article）
  mode:            'article',          // 'article' | 'doc'

  // ── 懒加载钩子（可选）──
  // 当书签文本在当前 DOM 中找不到时调用
  // bm: 书签对象, retryJump: 加载完成后调用以重新定位
  onJumpFail: function(bm, retryJump) { },

  // ── 预置书签（可选）──
  // localStorage 为空时生效（首次访问）
  seedBookmarks: [
    {
      type:         'mark',            // 'mark' | 'checkpoint'
      selectedText: '原文文字（必须与 HTML 完全一致）',
      section:      'data-section 值', // hiText 失败时的章节级降级
      note:         '备注',
      contextText:  '上下文（约200字，用于 AI 元数据生成）',
      source:       '来源标注',        // 有值时书签库自动按来源分组
      colorIndex:   0,                 // 0-4，对应5种颜色
      id:           'custom-id',       // 可选，默认 crypto.randomUUID()
      createdAt:    'ISO-string',      // 可选，默认 new Date().toISOString()
    }
  ]
};
```

### AI 元数据自动生成

每条书签保存时，embed 脚本自动计算并附加以下字段：

```js
bm.title       // 意图前缀 + 选中文字摘要（如"技术实现：语义定位…"）
bm.summary     // 一句话解释这条书签的价值
bm.aiReason    // AI 判断意图的说明文字
bm.nextAction  // 下一步阅读建议（基于意图定制）
bm.keywords    // 语义关键词数组（2-4 个）
bm.intent      // 7 类意图之一（见下表）
```

**7 类意图分类规则**：

| 意图标签 | 触发关键词 | 典型内容 |
|---------|-----------|---------|
| 问题痛点 | 问题、失效、痛点、挑战、断点 | 文章指出的用户需求或行业问题 |
| 技术实现 | AI、定位、语义、算法、模型、技术 | 具体技术路径或工程实现 |
| 产品价值 | 竞争力、价值、用户需求、留存、增长 | 产品的商业或用户价值 |
| 数据洞察 | 数据、%、亿、增速、调研、留存率 | 量化的研究结论或市场数据 |
| 政策法规 | 政策、监管、合规、条例、治理 | 法规环境或监管动态 |
| 战略建议 | 建议、策略、路径、推荐、应当 | 可操作的方向或决策建议 |
| 个人经历 | 我、感受、记得、经历、那一年 | 叙事性的个人视角内容 |

### 主要函数索引

| 函数 | 作用 |
|------|------|
| `boot()` | 初始化入口，等待 article 元素就绪 |
| `seedBMs()` | 首次访问时播种预置书签，doc 模式有 stale 检测 |
| `saveFromBubble(type)` | 从气泡保存书签（type='mark'\|'checkpoint'） |
| `savePositionCP()` | 无选文字保存当前位置为断点 |
| `autoSaveReturn()` | 跳转前自动保存返回点 |
| `jumpTo(bm)` | 跳转到书签位置，含 `cfg.onJumpFail` 懒加载钩子 |
| `hiText(text, container)` | 精确字符串搜索 + 临时高亮注入，返回 mark 元素或 null |
| `hiTextDoc(text, container, color)` | doc 模式持久高亮注入 |
| `renderDocAnnotations()` | 重建 doc 模式所有正文高亮和边距圆点 |
| `renderRail()` | 渲染右侧便签栏 |
| `renderLib()` | 渲染书签库面板内容 |
| `openNotes()` | 打开 AI 阅读笔记模态框 |
| `buildNotesHTML(bms)` | 生成笔记 HTML（文章概述 + 关键词 + 知识点） |
| `buildNotesMarkdown(bms)` | 生成笔记 Markdown（用于复制导出） |
| `articleOverview(bms)` | 基于标题结构 + 书签推断文章主旨 |
| `buildKnowledgePoint(bm)` | 针对意图类型生成专项知识点解读 |
| `resumeBriefHTML(bms)` | 生成 AI 回访简报 HTML（≥2 个 mark 书签时） |
| `renderByIntent(bms, container)` | 按意图分组渲染书签列表 |
| `renderBySource(bms, container)` | 按来源分组渲染书签列表 |
| `ordered()` | 书签排序：断点 → 标记 → 返回点 |
| `genMeta(bm)` | 调用本地规则生成 AI 元数据 |
| `infer(txt)` | 从文本推断意图 |
| `kwds(txt)` | 提取关键词（中文词组 + 停用词过滤） |
| `persist()` | 写入 localStorage |
| `loadBMs()` | 从 localStorage 读取书签 |
| `handleDeepLink()` | 处理 `#an-jump=ID` hash 跳转 |

---

## 页面间数据流

```
tencent-news-deep.html
  └── localStorage['anchornote.embed.tencent-news-deep']
        ↓ 读取（checkpoint）
  tencent-news-yaowen.html（cr-bar 继续阅读横幅）
  
各 demo 页面的 localStorage
        ↓ 全部读取（all pageIds）
  tencent-research-index.html（断点汇总侧边栏）
  dashboard.html（全局书签 Dashboard）
```

### 跨页 deep link 路径

```
dashboard.html 点「跳转」
  → 在新标签页打开 pages/xxx.html#an-jump=BOOKMARK_ID
  → handleDeepLink() 解析 hash
  → setTimeout 500ms 等页面就绪
  → jumpTo(bm) 定位高亮
  → history.replaceState 清除 hash
```

---

## 各页面技术细节

### tencent-news-deep.html（主演示页）

**预置书签（3 条）**：
1. `checkpoint`："被用户列为排名第一的痛点，超越了" — 演示断点保存位置
2. `mark`："语义书签是阅读现场的快照" — intent: 产品价值
3. `mark`："超过八成的内容在用户的视野中" — intent: 数据洞察

**导航**：顶部有「要闻」链接 → `tencent-news-yaowen.html`，用于演示跨页继续阅读。

**article 区域**：`<main id="article">`，包含 `data-section` 属性便于降级跳转。

---

### tencent-news-yaowen.html（要闻页 + 懒加载演示）

**功能 A：跨页断点继续阅读**
- `initContinueReading()` 读取 `anchornote.embed.tencent-news-deep` 的 checkpoint
- 找到 checkpoint 则显示 `.cr-bar`（蓝色横幅），展示断点摘要文字
- 「继续阅读 →」链接：`tencent-news-deep.html#an-jump={cpId}`
- 监听 `storage` 事件，deep 页保存断点后横幅实时更新

**功能 B：懒加载书签演示**
- 预置书签第 4 条 selectedText = `"阅读断点跨版本精准还原：语义向量定位的工程实践"`
- 该文字**不存在**于页面初始 DOM（仅存在于 `BATCH2_CARDS` JS 数组中）
- 点击该书签时，`jumpTo` → `hiText` 返回 null → 调用 `cfg.onJumpFail`
- `onJumpFail` 执行流程：
  1. `btn.scrollIntoView()` — 滚动到「加载更多」按钮（700ms 延迟，让用户看到过程）
  2. 按钮状态切为「⏳ 加载中…」
  3. `loadMoreContent()` — 将 6 张新闻卡片追加到 `.news-grid`，每张有 90ms 错开的 CSS 过渡动画
  4. 1600ms 后调用 `retryJump()` — embed 脚本重新执行 `hiText`，此时文本已在 DOM 中
  5. 找到目标 `<a class="nc-title">` → 闭合到 `.news-card` 触发 `an-pulse` 蓝色边框动画

**BATCH2_CARDS 数组**（6 张卡，第 3 张 `isTarget:true` 即目标书签）：
```js
var BATCH2_CARDS = [
  { label:'AI技术',   ... },
  { label:'数据洞察', ... },
  { label:'技术深度', isTarget: true, title:'阅读断点跨版本精准还原：语义向量定位的工程实践', ... },
  { label:'财报解读', ... },
  { label:'消费趋势', ... },
  { label:'产品深度', ... }
];
```

**懒加载防重**：`_batch2Loaded` 变量防止重复追加卡片（手动点「加载更多」后再点书签不会再次加载）。

---

### tencent-research-index.html（研究院导航 + 断点侧边栏）

**不使用 anchornote-embed.js**，有独立的侧边栏 JS。

**`ALL_PAGES` 数组**（6 个 demo 页面 ID 和文件名）：
```js
var ALL_PAGES = [
  { id: 'research-report-2024',         title: '研究报告',   icon: '📊', file: 'research-report.html' },
  { id: 'tencent-news-deep',            title: 'AI深度报道', icon: '📰', file: 'tencent-news-deep.html' },
  { id: 'tencent-news-yaowen',          title: '腾讯新闻要闻', icon: '🗞️', file: 'tencent-news-yaowen.html' },
  { id: 'tencent-doc-anchornote-v23',   title: '腾讯文档',   icon: '📄', file: 'tencent-doc.html' },
  { id: 'penguin-article-dachang',      title: '企鹅号长文', icon: '✍️', file: 'penguin-article.html' },
  { id: 'content-research-ai-reader-2024', title: '书签聚合', icon: '🗂️', file: 'content-research.html' },
];
```

**`renderSidebar()`**：遍历 ALL_PAGES，读取各自的 localStorage，提取 `type === 'checkpoint'` 的书签，按 `createdAt` 降序排列，渲染为可点击的 `.cp-item` 条目。点击跳转到 `file + '#an-jump=' + cp.id`。

---

### tencent-doc.html（doc 模式）

**mode: 'doc' 的行为差异**：

1. 页面加载时 `renderDocAnnotations()` 自动运行，将所有书签的 `selectedText` 包裹在 `<mark class="an-doc-hi">` 中，并在所在段落右侧追加 `<span class="an-doc-dot">` 彩色圆点
2. 圆点 `position:absolute`，段落需要 `position:relative`（渲染时自动设置）
3. 跳转时不重新注入临时高亮，而是找到已有的 `.an-doc-hi` mark 并对其父段落触发 `an-pulse` 动画
4. Stale 检测：若 localStorage 中所有书签的 `selectedText` 前10字符都不在文章 `textContent` 中，视为陈旧数据，重新播种

**预置书签（4 条）**：均为 `mark` 类型，selectedText 涵盖文档中关于 AnchorNote 功能描述的段落。

---

### research-report.html（多来源聚合）

**预置书签**中含 `source` 字段（如 `'第三章·核心功能'`），`renderLib()` 检测到 `hasSources` 时调用 `renderBySource()` 按来源分组。

**demo-goal 位置**：moved 到 `</nav>` 后、`.report-hero` 前，确保通过 deep link 进入时 demo-goal 在视口内可见（不被 hero 区域推出屏幕）。

---

### dashboard.html（全局 Dashboard）

**读取逻辑**：`PAGES` 数组（含 5 个 pageId + 文件名），遍历读取 `localStorage['anchornote.embed.{id}']`。

**实时同步**：`window.addEventListener('storage', ...)` 监听，其他标签页保存书签后自动刷新。

**跳转机制**：「跳转」按钮 `window.open(page.file + '#an-jump=' + bm.id, '_blank')`，目标页面的 `handleDeepLink()` 负责解析 hash 并执行跳转。

**删除书签**：读取对应 pageId 的 localStorage，过滤掉目标 bm.id，写回，触发 `storage` 事件使其他标签页同步。

---

## CSS 命名空间

所有 embed 注入的 CSS 使用 `an-` 前缀：

| 前缀 | 说明 |
|------|------|
| `.an-sel-*` | 选文气泡 |
| `.an-rail` | 右侧便签栏容器 |
| `.an-rail-launcher` | 「N 书签」入口按钮 |
| `.an-rail-cp-btn` | 「存断点」按钮 |
| `.an-rail-hide-btn` | 「隐藏/显示」按钮 |
| `.an-sticky` | 单个便签卡片 |
| `.an-sticky-detail` | 便签悬停详情浮层 |
| `.an-lib-*` | 书签库面板 |
| `.an-notes-*` | AI 阅读笔记模态框 |
| `.an-doc-hi` | doc 模式正文持久高亮 |
| `.an-doc-dot` | doc 模式段落边距圆点 |
| `.an-hi` | article 模式临时高亮 |
| `.an-pulse` | 跳转脉冲动画 |
| `.an-toast` | Toast 提示 |
| `.an-resume` | AI 回访简报区块 |
| `.an-cluster-*` | 书签意图聚类分组 |

---

## seedBookmarks 编写规范

### 必须完全匹配

`selectedText` 必须与 HTML 渲染后的文字**逐字一致**，包括全角/半角标点、引号类型、空格。

```js
// ✅ 正确
{ selectedText: '用户对"AI帮我总结"的接受度远低于预期（仅41%）' }

// ❌ 引号类型不一致
{ selectedText: '用户对"AI帮我总结"的接受度远低于预期（仅41%）' }
```

### 跨行内元素边界会导致高亮失败（降级不崩溃）

`hiText` 使用 `TreeWalker` 搜索文本节点。如果 selectedText 横跨 `<strong>`、`<em>` 等行内元素边界，`range.surroundContents()` 会抛出异常，`hiText` catch 后返回父元素（降级为跳转到包含文字的段落，无高亮）。

```js
// HTML: 而是<strong>回来的成本够不够低</strong>
// ❌ 跨元素边界，高亮失败，降级跳转到段落
{ selectedText: '而是回来的成本够不够低' }

// ✅ 只选 strong 内部的文字，或选 strong 之前/之后的纯文本
{ selectedText: '回来的成本够不够低' }
```

### 重复文字处理

若文章中同一段文字出现多次，`hiText` 返回第一个匹配。如需指向特定位置，应包含前后文让 selectedText 唯一化：

```js
// 文章中有两处"立即体验"
// ❌ 可能跳到错误位置
{ selectedText: '立即体验' }

// ✅ 包含足够的上下文使其唯一
{ selectedText: '第二阶段的用户立即体验' }
```

---

## 常见问题

### Q: demo-goal 不显示或显示位置错误

检查 `position:sticky; top:Npx;` 中的 `top` 值是否与 sticky header 高度匹配：
- `tencent-news-deep.html`、`tencent-news-yaowen.html`、`tencent-doc.html`：header 高度 50px
- `research-report.html`、`content-research.html`、`dashboard.html`：header 高度 52px
- `penguin-article.html`：header 高度 54px

### Q: doc 模式高亮不出现

原因通常是 localStorage 中存有陈旧书签（selectedText 与当前文章不匹配）。解决：
```js
localStorage.removeItem('anchornote.embed.tencent-doc-anchornote-v23');
// 刷新页面，seed 书签重新播种
```

### Q: 跨页继续阅读横幅不出现

确认：
1. 已在 `tencent-news-deep.html` 保存过书签（localStorage 有数据）
2. 通过 HTTP 服务访问（`python3 -m http.server 3000`），file:// 协议下 localStorage 跨目录访问有限制
3. 浏览器未开启无痕模式（无痕模式下 localStorage 独立）

### Q: 懒加载书签（要闻页第4条）点击没有触发加载

检查：
1. `#load-more-btn` 元素是否存在（`document.getElementById('load-more-btn')`）
2. `_batch2Loaded` 是否为 false（若已手动点过「加载更多」，内容已加载，书签应能直接定位）
3. seed 书签的 selectedText 与 BATCH2_CARDS 中 `isTarget:true` 的 title 是否完全一致

### Q: Dashboard 显示书签数为 0

Dashboard 通过 pageId 读取 localStorage。确认：
- 已访问过对应 demo 页面（访问时播种 seed 书签）
- 页面的 `pageId` 配置与 Dashboard 的 `PAGES` 数组中的 `id` 完全一致

---

## 演示视频脚本

文件：`demo/script.html` / `demo/script.pdf`

6 个场景 + 开场收尾，总时长 3 分钟，包含：
- 场景②「AI 定位兜底」（重点场景，含定位决策流程图）
- AI 能力格（5 项能力含边界说明，★ AI 定位兜底重点标注）
- 能力边界声明（AI 不做什么）

如需重新生成 PDF：
```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --print-to-pdf=demo/script.pdf \
  --no-pdf-header-footer \
  demo/script.html
```
