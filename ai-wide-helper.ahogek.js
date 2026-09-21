// ==UserScript==
// @name         AI 宽屏助手 (Perplexity & Gemini)
// @namespace    http://tampermonkey.net/
// @version      1.5.48
// @description  Perplexity: 宽屏 + 侧边状态面板 + 设置弹窗增强 + 自动跟在请求后的回答规则 + 修复中文字体问题 + 清空官方 --pplx-sans 自定义字体 + 适配官方新增 data-font-system-cjk 字体变量（--font-family-system-cjk-sans/serif 复用简体优先栈） + 修复 iframe/内容渲染器（render.pplxusercontent.com）内 body 字体（覆盖为浏览器默认） + 修复 Space ID 提取逻辑（支持搜索页面） + 修复规则按钮选择器（适配新 DOM 结构） + 修复 Projects 页面 URL 识别（支持 /projects/ 路径）；Gemini: 宽屏 - 自动跟在请求后的回答规则 - 修复规则重复追加问题
// @author       AhogeK
// @match        https://www.perplexity.ai/*
// @match        https://render.pplxusercontent.com/*
// @match        https://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=perplexity.ai
// @grant        none
// @run-at       document-start
// @all-frames   true
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // Iframe/Renderer 专用分支：只修复 body 字体，跳过主逻辑
  // 覆盖值用 initial（浏览器默认字体），不做任何指定
  // ============================================================
  const host = globalThis.location.hostname;
  const isPplxFamily = host.includes('perplexity.ai') || host.includes('pplxusercontent.com');
  if (window.top !== window.self || host.includes('pplxusercontent.com')) {
    if (isPplxFamily) {
      const injectIframeFontFix = () => {
        if (document.getElementById('ai-widescreen-iframe-style')) return;
        const style = document.createElement('style');
        style.id = 'ai-widescreen-iframe-style';
        style.textContent = 'body { font-family: initial !important; }';
        (document.head || document.documentElement).appendChild(style);
      };
      injectIframeFontFix();
      if (!document.head) {
        document.addEventListener('DOMContentLoaded', injectIframeFontFix, { once: true });
      }
    }
    return;
  }

  // ============================================================
  // Type Definitions for VS Code IntelliSense
  // ============================================================

  /**
   * @typedef {Object} SourceLimit
   * @property {number|null} monthly_limit
   * @property {number|null} remaining
   */

  /**
   * @typedef {Object} RateLimitData
   * @property {number|null} remaining_pro
   * @property {number|null} remaining_research
   * @property {number|null} remaining_agentic_research
   * @property {number|null} remaining_labs
   * @property {{source_to_limit: Object<string, SourceLimit>}} [sources]
   */

  /**
   * @typedef {Object} Connector
   * @property {string} name
   * @property {boolean} connected
   */

  /**
   * @typedef {Object} ConnectorsData
   * @property {Connector[]} connectors
   */

  /**
   * @typedef {Object} ConnectorLimits
   * @property {number} [max_file_size_mb]
   * @property {number} [daily_attachment_limit]
   */

  /**
   * @typedef {Object} UserSettings
   * @property {number|null} upload_limit
   * @property {number|null} pages_limit
   * @property {number|null} article_image_upload_limit
   * @property {number|null} max_files_per_user
   * @property {number|null} max_files_per_repository
   * @property {boolean} disable_training
   * @property {string} [default_image_generation_model]
   * @property {string} [default_model]
   * @property {string} [time_zone]
   * @property {number} [query_count]
   * @property {number} [query_count_copilot]
   * @property {number} [query_count_mobile]
   * @property {string} [subscription_status]
   * @property {ConnectorsData} [connectors]
   * @property {ConnectorLimits} [connector_limits]
   */

  // ============================================================
  // 0. CSS Constants (Global Scope)
  // ============================================================
  const MAX_WIDTH = '1600px';

  // Application Constants
  const GEMINI_ALIGN_INTERVAL = 500; // ms
  // [DISABLED 2026-08-25] 侧边状态面板（HUD）整体停用：
  // 官方 /rest/rate-limit/all 与 /rest/user/settings 已不再按会话返回配额数据（已登录与无痕响应一致），
  // remaining_* 字段统一清零、remaining_detail.kind 为 "not_provided"，面板数据失去意义。
  // 恢复方法：1) 取消 initUI() 中 setupPerplexityStatusMonitor() 的调用注释；
  //           2) 取消下方 perplexityCSS 拼接处的注释；
  //           3) 取消网络拦截器中 ppx:refresh-quota 事件派发的注释；
  //           4) 取消本段 MAX_MODEL_HISTORY / REFRESH_QUOTA_DELAY 常量注释。
  // const MAX_MODEL_HISTORY = 5;
  // const REFRESH_QUOTA_DELAY = 2000; // ms

  const perplexityStatusCSS = `
    /* === Perplexity Status HUD - Slide Out === */
    #ppx-status-container {
      position: fixed !important;
      top: 50% !important;
      right: 0 !important;
      transform: translateY(-50%) !important;
      z-index: 999999 !important;
      display: flex !important;
      flex-direction: row-reverse !important;
      align-items: center !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      width: 12px !important;
      height: 100px !important;
    }
    #ppx-status-container:hover {
      width: 292px !important;
    }
    #ppx-status-container:hover #ppx-hud {
      transform: translateX(0) !important;
      opacity: 1 !important;
    }
    #ppx-status-container:hover #ppx-tab {
      opacity: 0 !important;
      pointer-events: none !important;
    }
    #ppx-tab {
      position: absolute !important;
      right: 0 !important;
      top: 50% !important;
      transform: translateY(-50%) !important;
      width: 12px !important;
      height: 70px !important;
      background: rgba(30, 41, 59, 0.9) !important;
      border-radius: 8px 0 0 8px !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      transition: all 0.3s ease !important;
      box-shadow: -2px 0 8px rgba(0, 0, 0, 0.3) !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      border-right: none !important;
    }
    #ppx-tab::before {
      content: '' !important;
      width: 2px !important;
      height: 24px !important;
      background: rgba(255, 255, 255, 0.4) !important;
      border-radius: 1px !important;
    }
    #ppx-hud {
      background: rgba(15, 23, 42, 0.98) !important;
      backdrop-filter: blur(12px) !important;
      border: 1px solid rgba(255, 255, 255, 0.15) !important;
      border-radius: 12px 0 0 12px !important;
      padding: 16px !important;
      box-shadow: -10px 0 30px rgba(0, 0, 0, 0.5) !important;
      font-family: -apple-system, system-ui, sans-serif !important;
      user-select: none !important;
      width: 280px !important;
      max-height: 80vh !important;
      overflow-y: auto !important;
      transform: translateX(100%) !important;
      opacity: 0 !important;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      scrollbar-width: thin !important;
      scrollbar-color: rgba(255,255,255,0.2) transparent !important;
    }
    #ppx-hud::-webkit-scrollbar { width: 4px !important; }
    #ppx-hud::-webkit-scrollbar-thumb {
      background: rgba(255,255,255,0.2) !important;
      border-radius: 2px !important;
    }
    .px-sec {
      background: rgba(255, 255, 255, 0.03) !important;
      border: 1px solid rgba(255, 255, 255, 0.05) !important;
      border-radius: 10px !important;
      padding: 12px !important;
      margin-bottom: 12px !important;
    }
    .px-sec:last-child { margin-bottom: 0 !important; }
    .px-sec-title {
      font-size: 11px !important;
      color: #64748b !important;
      text-transform: uppercase !important;
      font-weight: 600 !important;
      letter-spacing: 0.5px !important;
      margin-bottom: 10px !important;
      display: flex !important;
      align-items: center !important;
      gap: 6px !important;
    }
    .px-grid-2 {
      display: grid !important;
      grid-template-columns: 1fr 1fr !important;
      gap: 8px !important;
    }
    .px-item {
      display: flex !important;
      flex-direction: column !important;
      gap: 2px !important;
    }
    .px-label {
      font-size: 10px !important;
      color: #94a3b8 !important;
      text-transform: uppercase !important;
      letter-spacing: 0.3px !important;
    }
    .px-value {
      font-size: 16px !important;
      font-weight: 700 !important;
      color: #f8fafc !important;
      font-family: 'SF Mono', monospace !important;
    }
    .px-value.warn { color: #fbbf24 !important; }
    .px-value.zero { color: #ef4444 !important; }
    .px-value.unlimited { color: #10b981 !important; }
    .px-sub {
      font-size: 10px !important;
      color: #64748b !important;
      margin-top: 2px !important;
    }
    .px-divider {
      height: 1px !important;
      background: rgba(255, 255, 255, 0.08) !important;
      margin: 8px 0 !important;
    }
    .px-conn-list {
      display: flex !important;
      flex-wrap: wrap !important;
      gap: 4px !important;
      font-size: 11px !important;
    }
    .px-conn-item {
      padding: 2px 6px !important;
      border-radius: 4px !important;
      background: rgba(16, 185, 129, 0.15) !important;
      color: #10b981 !important;
      border: 1px solid rgba(16, 185, 129, 0.3) !important;
    }
    .px-conn-item.off {
      background: rgba(100, 116, 139, 0.15) !important;
      color: #64748b !important;
      border-color: rgba(100, 116, 139, 0.3) !important;
    }
    .px-src-grid {
      display: grid !important;
      grid-template-columns: repeat(2, 1fr) !important;
      gap: 4px !important;
    }
    .px-src-item {
      display: flex !important;
      justify-content: space-between !important;
      font-size: 10px !important;
      padding: 3px 6px !important;
      background: rgba(255, 255, 255, 0.02) !important;
      border-radius: 4px !important;
    }
    .px-src-name { color: #94a3b8 !important; }
    .px-src-val {
      font-family: monospace !important;
      color: #818cf8 !important;
      font-weight: 600 !important;
    }
    .px-model-box {
      padding: 8px !important;
      border-radius: 8px !important;
      border: 1px solid !important;
      margin-bottom: 8px !important;
    }
    .px-model-box.ok { border-color: rgba(16, 185, 129, 0.3) !important; background: rgba(16, 185, 129, 0.05) !important; }
    .px-model-box.warn { border-color: rgba(239, 68, 68, 0.3) !important; background: rgba(239, 68, 68, 0.05) !important; }
    .px-model-box.wait { border-color: rgba(100, 116, 139, 0.3) !important; background: rgba(100, 116, 139, 0.05) !important; }
    .px-model-status {
      font-size: 11px !important;
      font-weight: 600 !important;
      margin-bottom: 6px !important;
    }
    .px-model-status.ok { color: #10b981 !important; }
    .px-model-status.warn { color: #ef4444 !important; }
    .px-model-status.wait { color: #94a3b8 !important; }
    .px-model-row {
      font-size: 10px !important;
      color: #64748b !important;
      display: flex !important;
      justify-content: space-between !important;
      margin-bottom: 2px !important;
    }
    .px-model-val {
      font-family: monospace !important;
      color: #cbd5e1 !important;
      max-width: 120px !important;
      overflow: hidden !important;
      text-overflow: ellipsis !important;
      white-space: nowrap !important;
    }
    .px-actions {
      display: flex !important;
      gap: 8px !important;
      margin-top: 12px !important;
    }
    .px-btn {
      flex: 1 !important;
      padding: 6px 12px !important;
      border-radius: 6px !important;
      border: none !important;
      font-size: 11px !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      transition: all 0.2s !important;
    }
    .px-btn.primary {
      background: #3b82f6 !important;
      color: white !important;
    }
    .px-btn.primary:hover { background: #2563eb !important; }
    .px-btn.secondary {
      background: rgba(255, 255, 255, 0.1) !important;
      color: #cbd5e1 !important;
    }
    .px-btn.secondary:hover { background: rgba(255, 255, 255, 0.15) !important; }
    .px-total {
      text-align: center !important;
      font-size: 11px !important;
      color: #64748b !important;
      padding-top: 8px !important;
      border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
    }
    .px-total strong {
      color: #e2e8f0 !important;
      font-family: monospace !important;
    }
    .px-loading {
      text-align: center !important;
      color: #64748b !important;
      padding: 20px !important;
      font-size: 12px !important;
    }
    .px-sp {
      animation: px-spin 1s linear infinite !important;
      display: inline-block !important;
    }
    @keyframes px-spin {
      100% { transform: rotate(360deg) !important; }
    }
    /* Modal Styles */
    .px-m-bg {
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background: rgba(0, 0, 0, 0.85) !important;
      z-index: 1000000 !important;
      backdrop-filter: blur(4px) !important;
    }
    .px-m {
      position: fixed !important;
      top: 50% !important;
      left: 50% !important;
      transform: translate(-50%, -50%) !important;
      width: 90% !important;
      max-width: 700px !important;
      background: #1e293b !important;
      border-radius: 16px !important;
      border: 1px solid rgba(255, 255, 255, 0.1) !important;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.7) !important;
      font-family: -apple-system, system-ui, sans-serif !important;
      overflow: hidden !important;
      max-height: 90vh !important;
      display: flex !important;
      flex-direction: column !important;
    }
    .px-mh {
      padding: 20px !important;
      background: rgba(255, 255, 255, 0.03) !important;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05) !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
    }
    .px-mt {
      font-size: 18px !important;
      font-weight: 700 !important;
      color: #f1f5f9 !important;
    }
    .px-mc { display: flex !important; gap: 8px !important; }
    .px-mb {
      padding: 24px !important;
      overflow-y: auto !important;
    }
    .px-m-close {
      width: 32px !important;
      height: 32px !important;
      border-radius: 8px !important;
      border: none !important;
      background: rgba(255, 255, 255, 0.1) !important;
      color: #fff !important;
      cursor: pointer !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      font-size: 16px !important;
      transition: background 0.2s !important;
    }
    .px-m-close:hover { background: rgba(255, 255, 255, 0.2) !important; }
  `;

  const perplexityCSS = `
    /* === Widescreen === */
    .max-w-threadContentWidth, .max-w-3xl, .max-w-4xl, .max-w-5xl, .max-w-6xl {
      width: auto !important; max-width: 95% !important;
    }
    @media (min-width: 1280px) {
      .max-w-threadContentWidth, .max-w-3xl, .max-w-4xl, .max-w-5xl, .max-w-6xl {
        max-width: ${MAX_WIDTH} !important;
      }
    }

    /* === Chinese Font Fix === */
    /* 修复中文字体显示问题：覆盖 cjk 复合变量，将简体字体排在日文字体之前 */
    :root {
      --pplx-sans: ;
      --pplx-ja-sans: ;
      --pplx-cjk-sans: var(--pplx-zh-hans-sans), var(--pplx-zh-hant-sans), var(--pplx-zh-hk-sans), var(--pplx-zh-mo-sans), var(--pplx-ja-sans), var(--pplx-ko-sans);
      --pplx-cjk-serif: var(--pplx-zh-hans-serif), var(--pplx-zh-hant-serif), var(--pplx-zh-hk-serif), var(--pplx-zh-mo-serif), var(--pplx-ja-serif), var(--pplx-ko-serif);
    }
    /* 让官方 html[data-font-system-cjk=true] 引入的 --font-family-system-cjk-sans/serif 失效：
       复用到上面已修复的 --pplx-cjk-sans/serif（简体优先），官方其余逻辑不受影响 */
    html[data-font-system-cjk="true"] {
      --font-family-system-cjk-sans: var(--pplx-cjk-sans);
      --font-family-system-cjk-serif: var(--pplx-cjk-serif);
    }

    /* === Modal Optimization === */
    div[class*="duration-200"][class*="fill-mode-both"][class*="animate-in"] > div > div.bg-base.shadow-md.overflow-y-auto.scrollbar-subtle {
      min-width: 800px !important; max-width: 1000px !important; width: 1000px !important; max-height: 90vh !important;
    }

    /* === Input Area === */
    textarea[data-testid="answer-instructions-input"] {
      min-height: 350px !important; height: 350px !important; max-height: 600px !important; resize: vertical !important; overflow-y: auto !important;
    }
    div[data-test-id="answer-instructions-input"] .relative.flex.items-center,
    div[data-test-id="answer-instructions-input"] div[class*="w-full"][class*="focus:ring-subtler"] {
      min-height: 350px !important;
    }
    div.bg-base.shadow-md.overflow-y-auto.scrollbar-subtle {
      overflow-y: auto !important; scrollbar-width: thin !important;
    }

    /* === Footer Buttons === */
    div.bottom-md.right-md.fixed {
      top: auto !important; transform: none !important; bottom: 120px !important; right: 30px !important;
      display: flex !important; flex-direction: row !important; gap: 12px !important;
      opacity: 0.1 !important; transition: opacity 0.3s ease-in-out !important; z-index: 50; pointer-events: auto !important;
    }
    div.bottom-md.right-md.fixed:hover { opacity: 1 !important; }
  `; // [DISABLED 2026-08-25] 原为 ` + perplexityStatusCSS（侧窗 CSS 停用，恢复时改回）

  const geminiCSS = `
    .chat-history-scroll-container { width: 100% !important; max-width: 100% !important; }
    infinite-scroller .conversation-container, .input-area-container {
      width: 100% !important; max-width: ${MAX_WIDTH} !important; margin-left: auto !important; margin-right: auto !important;
    }
    user-query, user-query-content { display: block !important; width: 100% !important; max-width: 100% !important; }
    infinite-scroller .conversation-container { padding-left: 24px !important; padding-right: 24px !important; box-sizing: border-box !important; }
    code-block, .formatted-code-block-internal-container, .code-block pre, .code-container {
      max-width: 100% !important; overflow: visible !important; white-space: pre-wrap !important;
    }
    .user-query-container > div[style*="flex"], user-query-content > div[style*="flex"] { display: none !important; }
    user-query-content::after { content: ""; display: table; clear: both; }

    /* === Gemini 2026-09 新版内容宽度体系适配（enable-extended-and-xl-grid） ===
       Gemini 现把对话内容子元素限制为 max-width: 708px（媒体类 740px）+ margin-inline: auto 居中；
       表格则改用 .table-content 的 padding-inline: max(0px, 50% - 354px) 维持 708px 内容宽。
       与插件的全宽意图冲突：正文不变宽、表格被 padding 推右并溢出容器（约 400px），故中和该机制。 */
    .markdown > :not(#_),
    .markdown-main-panel > :not(#_) {
      max-width: 100% !important;
    }

    /* 模型回复操作栏（点赞/复制等）：解除 708px 居中限制，全宽并贴右（与用户消息操作栏对齐方式一致） */
    .response-container-footer { max-width: 100% !important; margin-inline: 0 !important; }
    message-actions { max-width: 100% !important; width: 100% !important; margin-inline: 0 !important; }
    .buttons-container-v2 { justify-content: flex-end !important; }
    .buttons-container-v2 > .spacer { display: none !important; }

    /* 思考指示器（thinking overlay）、思考内容、"三个跳动的点"、
       模型回复头部/底部/免责声明、对话内提示条：
       以上元素均吃 Gemini 的 708px + max(0px, 50% - 354px) 居中机制，统一解除（全宽贴左） */
    thinking-overlay,
    .thoughts-container,
    thinking-dots-animation,
    .response-container-header,
    .response-footer,
    model-response-disclaimers,
    prompt-flow-bar {
      max-width: 100% !important;
      margin-inline: 0 !important;
    }

    /* === Table Widescreen Support === */
    table-block, .table-block {
      width: 100% !important; max-width: 100% !important;
    }
    .table-content {
      width: auto !important; max-width: 100% !important; padding-inline: 0 !important;
    }
    .table-block table, .table-content table {
      width: 100% !important; min-width: unset !important;
    }
    .table-block.has-scrollbar .table-content,
    .table-block .table-content {
      overflow-x: auto !important; max-width: 100% !important;
    }

    /* 表格底部操作栏（"..." 更多菜单）：解除 900px 内容区居中限制（padding-inline: max(0px, 50% - 450px)），菜单贴右 */
    .table-footer {
      padding-inline: 0 !important; justify-content: flex-end !important;
    }
    /* Wide screen: expand tables to use available space */
    @media (min-width: 1280px) {
      table-block, .table-block {
        width: 100% !important;
      }
      .table-block table {
        width: 100% !important; table-layout: auto !important;
      }
    }
  `;

  // ============================================================
  // 1. Helper Functions (Hoisted to Outer Scope)
  // ============================================================

  // 共享的 Space ID 提取函数
  function getCurrentSpaceId() {
    const pathname = globalThis.location.pathname;
    if (pathname === '/spaces' || pathname === '/spaces/' || pathname === '/projects' || pathname === '/projects/') {
      return 'default';
    }
    // /spaces/ 与 /projects/ 的 {slug}_{id} 格式相同,统一用 split('-').pop() 提取,保证 key 与既有数据/chat 页 DOM 兜底一致
    const urlMatch = /\/(?:spaces|projects)\/([a-zA-Z0-9_.-]+)/.exec(pathname);
    if (urlMatch) {
      const fullId = urlMatch[1];
      return fullId.includes('-') ? fullId.split('-').pop() : fullId;
    }
    const spaceLinks = document.querySelectorAll('a[href^="/spaces/"]');
    for (const link of spaceLinks) {
      const rect = link.getBoundingClientRect();
      if (rect.top < 100 && rect.width > 0) {
        const href = link.getAttribute('href');
        const hrefMatch = /\/spaces\/([a-zA-Z0-9_.-]+)/.exec(href);
        if (hrefMatch) {
          const fullId = hrefMatch[1];
          return fullId.includes('-') ? fullId.split('-').pop() : fullId;
        }
      }
    }
    return 'default';
  }

  // 新版 Gemini 的用户消息由原生 prompt bubble 自带右对齐，旧 .user-query-bubble-container 已不存在
  function forceGeminiFullWidth() {
    const queryContents = document.querySelectorAll('user-query-content.user-query-container');
    queryContents.forEach(el => {
      if (el.style.display !== 'block' || el.style.width !== '100%') {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('width', '100%', 'important');
        el.style.removeProperty('flex-direction');
        el.style.removeProperty('justify-content');
        el.style.removeProperty('align-items');
      }
      let parent = el.parentElement;
      while (parent) {
        if (parent.tagName === 'SPAN' || parent.tagName === 'USER-QUERY') {
          if (parent.style.display !== 'block' || parent.style.width !== '100%') {
            parent.style.setProperty('display', 'block', 'important');
            parent.style.setProperty('width', '100%', 'important');
          }
        }
        if (parent.tagName === 'USER-QUERY') break;
        parent = parent.parentElement;
      }
    });
  }

  function setupPerplexityStatusMonitor() {
  // ============================================================
  // [DISABLED 2026-08-25] 侧边状态面板（HUD）：官方配额接口已停用，本函数不再被调用
  // 代码整体保留，恢复时取消 initUI() 中的调用注释即可
  // ============================================================
    const LS_KEY_MODEL = 'ppx_status_model_monitor';
    let monitorData = {d: null, h: [], t: null};
    try {
      const saved = localStorage.getItem(LS_KEY_MODEL);
      if (saved) monitorData = JSON.parse(saved);
    } catch (_) {
    }

    function saveMonitorData() {
      try {
        localStorage.setItem(LS_KEY_MODEL, JSON.stringify(monitorData));
      } catch (_) {
      }
    }

    /**
     * @param {string} text
     * @returns {{d: string}|null}
     */
    function extractModelFromText(text) {
      if (!text || !text.includes('display_model')) return null;
      try {
        const j = JSON.parse(text);

        /**
         * @param {any} v
         * @returns {{d: string}|null}
         */
        function walk(v) {
          if (!v || typeof v !== 'object') return null;
          // eslint-disable-next-line no-undef
          if (typeof v['display_model'] === 'string') return {d: v['display_model']};
          for (const k in v) {
            const result = walk(v[k]);
            if (result) return result;
          }
          return null;
        }

        const result = walk(j);
        if (result) return result;
      } catch (e) {
      }
      const dm = /"display_model"\s*:\s*"([^"]+)"/.exec(text);
      if (dm) return {d: dm[1]};
      return null;
    }

    const origFetch = globalThis.fetch;
    globalThis.fetch = function (...args) {
      return origFetch.apply(this, args).then(r => {
        try {
          r.clone().text().then(t => {
            const m = extractModelFromText(t);
            // 只关注 display_model（实际收到的模型）
            if (m && m.d) {
              if (monitorData.d !== m.d) {
                monitorData.d = m.d;
                monitorData.t = Date.now();
                // 保存到历史
                if (!monitorData.h.length || monitorData.h[0].d !== monitorData.d) {
                  monitorData.h.unshift({d: monitorData.d, t: monitorData.t});
                  if (monitorData.h.length > MAX_MODEL_HISTORY) monitorData.h.pop();
                }
                saveMonitorData();
                updateHUDContent();
              }
            }
          }).catch(() => {
          });
        } catch (_) {
        }
        return r;
      });
    };

    function removeExistingHUD() {
      const ex = document.getElementById('ppx-status-container');
      if (ex) ex.remove();
    }

    let cachedData = null;

    function fetchStatusData() {
      return Promise.all([
        fetch('/rest/rate-limit/all').then(r => r.json()),
        fetch('/rest/user/settings').then(r => r.json())
      ]).then(([rateLimit, userSettings]) => {
        cachedData = [rateLimit, userSettings];
        return cachedData;
      });
    }

    /**
     * @param {number|string|null|undefined} val
     * @param {boolean} isWarn
     * @returns {string}
     */
    function formatVal(val, isWarn) {
      if (val === null || val === undefined) return '<span class="px-value">∞</span>';
      if (val === 0) return `<span class="px-value zero">${val}</span>`;
      if (val === 'unlimited' || (typeof val === 'number' && val > 999)) return `<span class="px-value unlimited">∞</span>`;
      return `<span class="px-value${isWarn ? ' warn' : ''}">${val}</span>`;
    }

    function getModelStatusHTML() {
      // 简化版：只显示上次使用的模型，不跟踪"已选择"
      // 这样避免悖论：不发查询时显示什么已选择

      const hasModel = !!monitorData.d;

      if (!hasModel) {
        return `
          <div class="px-model-box wait">
            <div class="px-model-status wait">上次使用</div>
            <div class="px-model-row" style="justify-content:center;padding:8px 0">
              <span style="color:#64748b;font-size:12px">发送查询后显示</span>
            </div>
          </div>`;
      }

      return `
        <div class="px-model-box ok">
          <div class="px-model-status ok">上次使用</div>
          <div class="px-model-row"><span style="color:#94a3b8">模型</span><span class="px-model-val" title="${monitorData.d}">${monitorData.d}</span></div>
          <div class="px-model-row"><span style="color:#94a3b8">时间</span><span class="px-model-val">${monitorData.t ? new Date(monitorData.t).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }) : '—'}</span></div>
        </div>`;
    }

    /**
     * @param {RateLimitData} rateLimit
     * @param {UserSettings} userSettings
     * @returns {string}
     */
    function generateHUDContent(rateLimit, userSettings) {
      const proWarn = rateLimit.remaining_pro !== null && rateLimit.remaining_pro < 10;
      const researchWarn = rateLimit.remaining_research !== null && rateLimit.remaining_research < 5;
      const labsWarn = rateLimit.remaining_labs !== null && rateLimit.remaining_labs < 5;
      const uploadWarn = userSettings.upload_limit !== null && userSettings.upload_limit < 10;

      const connectedConns = userSettings.connectors?.connectors?.filter(c => c.connected) || [];
      const connHTML = connectedConns.length ?
          connectedConns.slice(0, 4).map(c => `<span class="px-conn-item">${c.name.replace(/_mcp_|_direct|_merge|_alt|_cashmere/g, '')}</span>`).join('') +
          (connectedConns.length > 4 ? `<span class="px-conn-item off">+${connectedConns.length - 4}</span>` : '') :
          '<span class="px-conn-item off">未连接</span>';

      const sourcesWithLimits = [];
      if (rateLimit.sources?.source_to_limit) {
        Object.keys(rateLimit.sources.source_to_limit).forEach(k => {
          const s = rateLimit.sources.source_to_limit[k];
          if (s.monthly_limit > 0 && s.monthly_limit !== null) {
            sourcesWithLimits.push({
              name: k.replace(/_mcp_cashmere|_mcp_merge|_direct/g, '').replace(/_/g, ''),
              val: `${s.remaining}/${s.monthly_limit}`
            });
          }
        });
      }

      const srcHTML = sourcesWithLimits.length ?
          sourcesWithLimits.slice(0, 6).map(s => `<div class="px-src-item"><span class="px-src-name">${s.name}</span><span class="px-src-val">${s.val}</span></div>`).join('') :
          '<div class="px-src-item"><span class="px-src-name">无限制源</span></div>';

      return `
        ${getModelStatusHTML()}
        
        <div class="px-sec">
          <div class="px-sec-title">📊 使用配额</div>
          <div class="px-grid-2">
            <div class="px-item">
              <span class="px-label">Pro 搜索</span>
              ${formatVal(rateLimit.remaining_pro, proWarn)}
              ${rateLimit.remaining_pro === 0 ? '<span class="px-sub">今日已用完</span>' : ''}
            </div>
            <div class="px-item">
              <span class="px-label">深度研究</span>
              ${formatVal(rateLimit.remaining_research, researchWarn)}
              <span class="px-sub">月度</span>
            </div>
            <div class="px-item">
              <span class="px-label">Agentic 研究</span>
              ${formatVal(rateLimit.remaining_agentic_research, false)}
              <span class="px-sub">月度</span>
            </div>
            <div class="px-item">
              <span class="px-label">实验室</span>
              ${formatVal(rateLimit.remaining_labs, labsWarn)}
              <span class="px-sub">月度</span>
            </div>
            <div class="px-item">
              <span class="px-label">文件上传</span>
              ${formatVal(userSettings.upload_limit, uploadWarn)}
              <span class="px-sub">每周</span>
            </div>
            <div class="px-item">
              <span class="px-label">页面</span>
              ${formatVal(userSettings.pages_limit, false)}
              <span class="px-sub">上限</span>
            </div>
          </div>
        </div>

        <div class="px-sec">
          <div class="px-sec-title">🔗 连接器 (${connectedConns.length})</div>
          <div class="px-conn-list">${connHTML}</div>
        </div>

        ${sourcesWithLimits.length ? `
        <div class="px-sec">
          <div class="px-sec-title">📈 源限制 (月)</div>
          <div class="px-src-grid">${srcHTML}</div>
        </div>
        ` : ''}

        <div class="px-sec">
          <div class="px-sec-title">⚙️ 账户设置</div>
          <div class="px-grid-2">
            <div class="px-item">
              <span class="px-label">训练数据</span>
              <span class="px-value${userSettings.disable_training ? '' : ' warn'}">${userSettings.disable_training ? '已关闭' : '开启 ⚠️'}</span>
            </div>
            <div class="px-item">
              <span class="px-label">图片模型</span>
              <span class="px-model-val" style="color:#cbd5e1">${userSettings.default_image_generation_model || 'default'}</span>
            </div>
            <div class="px-item">
              <span class="px-label">时区</span>
              <span class="px-model-val" style="color:#cbd5e1">${userSettings.time_zone || 'N/A'}</span>
            </div>
          </div>
        </div>

        <div class="px-actions">
          <button class="px-btn primary" id="px-hud-refresh">↻ 刷新</button>
          <button class="px-btn secondary" id="px-hud-detail">详情 →</button>
        </div>

        <div class="px-total">
          总查询: <strong>${(userSettings.query_count || 0).toLocaleString()}</strong>
          ${userSettings.query_count_copilot ? ` | Copilot: ${userSettings.query_count_copilot.toLocaleString()}` : ''}
        </div>
      `;
    }

    function createHUD() {
      removeExistingHUD();

      const container = document.createElement('div');
      container.id = 'ppx-status-container';

      const tab = document.createElement('div');
      tab.id = 'ppx-tab';

      const hud = document.createElement('div');
      hud.id = 'ppx-hud';
      hud.innerHTML = '<div class="px-loading">加载中...</div>';

      container.appendChild(tab);
      container.appendChild(hud);
      document.body.appendChild(container);

      hud.addEventListener('click', e => {
        if (e.target.id === 'px-hud-detail') {
          openStatusModal();
        } else if (e.target.id === 'px-hud-refresh') {
          refreshStatus();
        }
      });

      return hud;
    }

    function updateHUDContent() {
      if (!cachedData) return;
      const hud = document.getElementById('ppx-hud');
      if (!hud) return;
      const [rateLimit, userSettings] = cachedData;
      hud.innerHTML = generateHUDContent(rateLimit, userSettings);
    }

    /**
     * @param {RateLimitData} rateLimit
     * @param {UserSettings} userSettings
     * @returns {string}
     */
    function generateModalContent(rateLimit, userSettings) {
      const allConns = userSettings.connectors?.connectors || [];

      let connDetailHTML = '';
      if (allConns.length) {
        connDetailHTML = `
          <div class="px-sec">
            <div class="px-sec-title">🔗 所有连接器</div>
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;font-size:11px">
              ${allConns.map(c => `
                <div style="padding:8px;border-radius:6px;background:${c.connected ? 'rgba(16,185,129,0.1)' : 'rgba(100,116,139,0.1)'};border:1px solid ${c.connected ? 'rgba(16,185,129,0.3)' : 'rgba(100,116,139,0.2)'};display:flex;align-items:center;gap:6px">
                  <span style="color:${c.connected ? '#10b981' : '#64748b'}">${c.connected ? '●' : '○'}</span>
                  <span style="color:${c.connected ? '#e2e8f0' : '#64748b'}">${c.name.replace(/_mcp_|_direct|_merge|_alt|_cashmere/g, '')}</span>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }

      let allSourcesHTML = '';
      if (rateLimit.sources?.source_to_limit) {
        const sources = [];
        Object.keys(rateLimit.sources.source_to_limit).forEach(k => {
          const s = rateLimit.sources.source_to_limit[k];
          sources.push({
            name: k.replace(/_mcp_cashmere|_mcp_merge|_direct/g, '').replace(/_/g, ''),
            limit: s.monthly_limit,
            remaining: s.remaining
          });
        });

        if (sources.length) {
          allSourcesHTML = `
            <div class="px-sec">
              <div class="px-sec-title">📊 所有源限制</div>
              <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:6px;font-size:11px">
                ${sources.map(s => `
                  <div style="padding:6px 8px;border-radius:4px;background:rgba(255,255,255,0.02);display:flex;justify-content:space-between;align-items:center">
                    <span style="color:#94a3b8">${s.name}</span>
                    <span style="font-family:monospace;color:${s.limit === null ? '#64748b' : (s.remaining === 0 ? '#ef4444' : '#818cf8')};font-weight:600">
                      ${s.limit === null ? '∞' : `${s.remaining}/${s.limit}`}
                    </span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }
      }

      let modelHistoryHTML = '';
      if (monitorData.h.length) {
        modelHistoryHTML = `
          <div class="px-sec">
            <div class="px-sec-title">🤖 模型历史 (最近5次)</div>
            ${monitorData.h.map(i => {
          const time = new Date(i.t).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
          return `
                <div style="padding:8px;border-radius:6px;background:rgba(255,255,255,0.02);margin-bottom:6px;border-left:3px solid #3b82f6">
                  <div style="display:flex;justify-content:space-between;font-size:10px;color:#64748b;margin-bottom:4px">
                    <span>${time}</span>
                  </div>
                  <div style="font-size:11px;color:#94a3b8">模型: <span style="color:#cbd5e1;font-family:monospace">${i.d}</span></div>
                </div>
              `;
        }).join('')}
          </div>
        `;
      }

      const limits = userSettings.connector_limits || {};

      return `
        <div class="px-sec">
          <div class="px-sec-title">📊 详细配额</div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px">
            <div class="px-item" style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
              <span class="px-label">Pro 搜索 (每日软限制)</span>
              <div style="font-size:24px;font-weight:700;color:${rateLimit.remaining_pro === 0 ? '#ef4444' : '#f8fafc'};font-family:monospace">${rateLimit.remaining_pro ?? 'N/A'}</div>
            </div>
            <div class="px-item" style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
              <span class="px-label">深度研究 (每月)</span>
              <div style="font-size:24px;font-weight:700;color:#f8fafc;font-family:monospace">${rateLimit.remaining_research ?? 'N/A'}</div>
            </div>
            <div class="px-item" style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
              <span class="px-label">Agentic 研究</span>
              <div style="font-size:24px;font-weight:700;color:#f8fafc;font-family:monospace">${rateLimit.remaining_agentic_research ?? 'N/A'}</div>
            </div>
            <div class="px-item" style="padding:12px;background:rgba(255,255,255,0.02);border-radius:8px">
              <span class="px-label">实验室 (每月)</span>
              <div style="font-size:24px;font-weight:700;color:#f8fafc;font-family:monospace">${rateLimit.remaining_labs ?? 'N/A'}</div>
            </div>
          </div>
        </div>

        <div class="px-sec">
          <div class="px-sec-title">📁 文件限制</div>
          <div class="px-grid-2">
            <div class="px-item">
              <span class="px-label">每周上传</span>
              <span class="px-value">${userSettings.upload_limit ?? 'N/A'}</span>
            </div>
            <div class="px-item">
              <span class="px-label">文章图片上传</span>
              <span class="px-value">${userSettings.article_image_upload_limit ?? 'N/A'}</span>
            </div>
            <div class="px-item">
              <span class="px-label">每个用户最大文件</span>
              <span class="px-value">${userSettings.max_files_per_user ?? 'N/A'}</span>
            </div>
            <div class="px-item">
              <span class="px-label">存储库最大文件</span>
              <span class="px-value">${userSettings.max_files_per_repository ?? 'N/A'}</span>
            </div>
            <div class="px-item">
              <span class="px-label">最大文件大小</span>
              <span class="px-value">${limits.max_file_size_mb ?? 'N/A'} MB</span>
            </div>
            <div class="px-item">
              <span class="px-label">每日附件限制</span>
              <span class="px-value">${limits.daily_attachment_limit ?? 'N/A'}</span>
            </div>
          </div>
        </div>

        ${connDetailHTML}
        ${allSourcesHTML}
        ${modelHistoryHTML}

        <div class="px-sec">
          <div class="px-sec-title">📈 统计信息</div>
          <div style="font-size:13px;color:#cbd5e1;line-height:1.8">
            <div style="display:flex;justify-content:space-between"><span>总查询数</span><span style="font-family:monospace;color:#e2e8f0">${(userSettings.query_count || 0).toLocaleString()}</span></div>
            ${userSettings.query_count_copilot ? `<div style="display:flex;justify-content:space-between"><span>Copilot 查询</span><span style="font-family:monospace;color:#e2e8f0">${userSettings.query_count_copilot.toLocaleString()}</span></div>` : ''}
            ${userSettings.query_count_mobile ? `<div style="display:flex;justify-content:space-between"><span>移动端查询</span><span style="font-family:monospace;color:#e2e8f0">${userSettings.query_count_mobile.toLocaleString()}</span></div>` : ''}
            <div style="display:flex;justify-content:space-between"><span>默认模型</span><span style="font-family:monospace;color:#e2e8f0">${userSettings.default_model || 'turbo'}</span></div>
            <div style="display:flex;justify-content:space-between"><span>订阅状态</span><span style="color:${userSettings.subscription_status === 'active' ? '#10b981' : '#fbbf24'}">${userSettings.subscription_status || 'unknown'}</span></div>
          </div>
        </div>
      `;
    }

    function openStatusModal() {
      if (!cachedData) return;
      const [rateLimit, userSettings] = cachedData;

      const bg = document.createElement('div');
      bg.className = 'px-m-bg';
      bg.id = 'px-status-bg';
      bg.onclick = e => {
        if (e.target === bg) bg.remove();
      };

      bg.innerHTML = `
        <div class="px-m">
          <div class="px-mh">
            <div class="px-mt">⚡ Perplexity 详细状态</div>
            <div class="px-mc">
              <button class="px-m-close" id="px-modal-refresh" title="刷新">↻</button>
              <button class="px-m-close" onclick="this.closest('.px-m-bg').remove()" title="关闭">×</button>
            </div>
          </div>
          <div class="px-mb" id="px-modal-content">${generateModalContent(rateLimit, userSettings)}</div>
        </div>
      `;

      document.body.appendChild(bg);

      const refreshBtn = document.getElementById('px-modal-refresh');
      if (refreshBtn) {
        refreshBtn.onclick = () => {
          refreshBtn.classList.add('px-sp');
          fetchStatusData().then(data => {
            const modalContent = document.getElementById('px-modal-content');
            if (modalContent) modalContent.innerHTML = generateModalContent(data[0], data[1]);
          }).finally(() => {
            refreshBtn.classList.remove('px-sp');
          });
        };
      }
    }

    function refreshStatus() {
      const refreshBtn = document.getElementById('px-hud-refresh');
      const modalRefresh = document.getElementById('px-modal-refresh');
      if (refreshBtn) {
        refreshBtn.innerHTML = '<span class="px-sp">↻</span> 刷新';
        refreshBtn.disabled = true;
      }
      if (modalRefresh) modalRefresh.classList.add('px-sp');

      fetchStatusData().then(data => {
        updateHUDContent();
        const modalContent = document.getElementById('px-modal-content');
        if (modalContent) modalContent.innerHTML = generateModalContent(data[0], data[1]);
      }).finally(() => {
        if (refreshBtn) {
          refreshBtn.innerHTML = '↻ 刷新';
          refreshBtn.disabled = false;
        }
        if (modalRefresh) modalRefresh.classList.remove('px-sp');
      });
    }

    createHUD();
    fetchStatusData().then(() => updateHUDContent());

    // 监听刷新事件
    globalThis.addEventListener('ppx:refresh-quota', () => {
      fetchStatusData().then(() => updateHUDContent());
    });
  }

  function setupAnswerRules() {
    const RULES_STORAGE_PREFIX = 'pplx_answer_rules_';
    const BUTTON_CLASS = 'pplx-rules-button';
    const MODAL_ID = 'pplx-rules-modal';
    const DARK_MODE_CLASS = 'pplx-dark-mode';

    function getStorageKey() {
      const spaceId = getCurrentSpaceId();
      return `${RULES_STORAGE_PREFIX}${spaceId}`;
    }

    function saveRules(rules) {
      try {
        let content = rules.replace(/^回答规则\s*\n?---\s*\n?/m, '').replace(/\n?---\s*$/m, '').trim();
        localStorage.setItem(getStorageKey(), content);
        return true;
      } catch (e) {
        console.error('[AI Wide] Failed to save rules:', e);
        return false;
      }
    }

    function getRawRules() {
      try {
        return localStorage.getItem(getStorageKey()) || '';
      } catch (e) {
        console.error('[AI Wide] Failed to read rules:', e);
        return '';
      }
    }

    const ruleStyles = `
      .${BUTTON_CLASS} {
        font-sans: inherit; outline: none; transition: all 0.2s ease-out; user-select: none; position: relative; font-weight: 600;
        justify-content: center; text-align: center; align-items: center; border-radius: 0.5rem; cursor: pointer; white-space: nowrap;
        display: inline-flex; font-size: 0.875rem; height: 2rem; aspect-ratio: 9/8; color: var(--text-quiet); background: transparent; border: none;
      }
      .${BUTTON_CLASS}:hover { background: var(--bg-subtle); color: var(--text-foreground); }
      .${BUTTON_CLASS}:active { scale: 0.97; }
      .${BUTTON_CLASS}.has-rules { color: #0ea5e9; }
      #${MODAL_ID} {
        position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #ffffff; color: #1f2937;
        border: 1px solid #e5e7eb; border-radius: 12px; padding: 24px; width: 90%; max-width: 600px; z-index: 10000;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2); transition: background-color 0.2s, border-color 0.2s, color 0.2s;
      }
      html[data-color-scheme="dark"] #${MODAL_ID}, html.dark #${MODAL_ID}, body.dark #${MODAL_ID}, #${MODAL_ID}.${DARK_MODE_CLASS} {
        background: #191919 !important; color: #e5e5e5 !important; border-color: #333 !important; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
      }
      #${MODAL_ID} textarea {
        width: 100%; min-height: 300px; background: #f9fafb; color: #111827; border: 1px solid #d1d5db; border-radius: 8px;
        padding: 12px; font-family: 'Söhne Mono', 'Menlo', monospace; font-size: 13px; line-height: 1.6; resize: vertical; outline: none; transition: all 0.2s;
      }
      html[data-color-scheme="dark"] #${MODAL_ID} textarea, html.dark #${MODAL_ID} textarea, body.dark #${MODAL_ID} textarea, #${MODAL_ID}.${DARK_MODE_CLASS} textarea {
        background: #222 !important; color: #e5e5e5 !important; border-color: #444 !important;
      }
      #${MODAL_ID} textarea:focus { border-color: #0ea5e9 !important; box-shadow: 0 0 0 3px rgba(14, 165, 233, 0.15); }
      #${MODAL_ID} .modal-header { font-size: 18px; font-weight: 600; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center; }
      #${MODAL_ID} .modal-space-info { font-size: 12px; opacity: 0.6; font-weight: 400; font-family: monospace; }
      #${MODAL_ID} .modal-hint { font-size: 13px; opacity: 0.75; margin-bottom: 16px; line-height: 1.5; }
      #${MODAL_ID} .modal-footer { margin-top: 20px; display: flex; gap: 12px; justify-content: flex-end; }
      #${MODAL_ID} button { padding: 8px 16px; border-radius: 8px; font-size: 14px; font-weight: 500; cursor: pointer; border: none; transition: opacity 0.2s; }
      #${MODAL_ID} .btn-save { background: #0ea5e9; color: #ffffff; }
      #${MODAL_ID} .btn-save:hover { opacity: 0.9; }
      #${MODAL_ID} .btn-cancel { background: transparent; color: inherit; border: 1px solid currentColor; opacity: 0.6; }
      #${MODAL_ID} .btn-cancel:hover { opacity: 1; background: rgba(125, 125, 125, 0.1); }
      #${MODAL_ID}-overlay {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 0, 0, 0.4); z-index: 9999; backdrop-filter: blur(2px);
      }
    `;
    const styleElement = document.createElement('style');
    styleElement.textContent = ruleStyles;
    document.head.appendChild(styleElement);

    function createModal() {
      const existingModal = document.getElementById(MODAL_ID);
      const existingOverlay = document.getElementById(`${MODAL_ID}-overlay`);
      if (existingModal) existingModal.remove();
      if (existingOverlay) existingOverlay.remove();
      const overlay = document.createElement('div');
      overlay.id = `${MODAL_ID}-overlay`;
      const modal = document.createElement('div');
      modal.id = MODAL_ID;

      const updateThemeMode = () => {
        const docEl = document.documentElement;
        const colorScheme = docEl.dataset.colorScheme;
        const hasDarkClass = docEl.classList.contains('dark') || document.body.classList.contains('dark');
        const hasDataTheme = docEl.dataset.theme === 'dark';
        const isDark = colorScheme === 'dark' || hasDarkClass || hasDataTheme;
        if (isDark) modal.classList.add(DARK_MODE_CLASS);
        else modal.classList.remove(DARK_MODE_CLASS);
      };
      updateThemeMode();
      const observerCallback = (mutations) => {
        for (const mutation of mutations) {
          const name = mutation.attributeName;
          if (name === 'data-color-scheme' || name === 'class' || name === 'data-theme') {
            updateThemeMode();
            break;
          }
        }
      };
      const themeObserver = new MutationObserver(observerCallback);
      themeObserver.observe(document.documentElement, {attributes: true});
      themeObserver.observe(document.body, {attributes: true});

      const spaceId = getCurrentSpaceId();
      const isDefaultSpace = spaceId === 'default';
      const rawRules = getRawRules();

      modal.innerHTML = `
        <div class="modal-header">
          <span>设置回答规则</span>
          <span class="modal-space-info">${isDefaultSpace ? '默认空间' : `Space: ${spaceId.substring(0, 12)}...`}</span>
        </div>
        <div class="modal-hint">💡 提示：只需输入规则内容，系统会自动添加格式标记。</div>
        <textarea id="${MODAL_ID}-textarea" placeholder="输入回答规则...">${rawRules}</textarea>
        <div class="modal-footer">
          <button class="btn-cancel">取消</button>
          <button class="btn-save">保存规则</button>
        </div>
      `;
      document.body.appendChild(overlay);
      document.body.appendChild(modal);

      const textarea = document.getElementById(`${MODAL_ID}-textarea`);
      const saveBtn = modal.querySelector('.btn-save');
      const cancelBtn = modal.querySelector('.btn-cancel');
      const closeModal = () => {
        themeObserver.disconnect();
        modal.remove();
        overlay.remove();
      };
      saveBtn.onclick = () => {
        if (saveRules(textarea.value.trim())) {
          updateButtonState();
          closeModal();
        } else {
          alert('规则保存失败！');
        }
      };
      cancelBtn.onclick = closeModal;
      overlay.onclick = closeModal;
      const escHandler = (e) => {
        if (e.key === 'Escape') {
          closeModal();
          document.removeEventListener('keydown', escHandler);
        }
      };
      document.addEventListener('keydown', escHandler);
      setTimeout(() => textarea.focus(), 100);
    }

    function updateButtonState() {
      const button = document.querySelector(`.${BUTTON_CLASS}`);
      if (!button) return;
      const hasRules = getRawRules().length > 0;
      if (hasRules) {
        button.classList.add('has-rules');
        button.setAttribute('aria-label', '编辑回答规则（已设置）');
      } else {
        button.classList.remove('has-rules');
        button.setAttribute('aria-label', '设置回答规则');
      }
    }

    function addRulesButton() {
      if (document.querySelector(`.${BUTTON_CLASS}`)) return;
      
      const askInput = document.querySelector('#ask-input');
      if (!askInput) return;
      
      const inputContainer = askInput.closest('[data-ask-input-container]') || askInput.parentElement?.parentElement?.parentElement;
      if (!inputContainer) return;
      
      const modelButton = inputContainer.querySelector('button[aria-haspopup="menu"], button[aria-haspopup="dialog"]');
      if (!modelButton) return;
      
      const toolbarContainer = modelButton.parentElement;
      if (!toolbarContainer || toolbarContainer.querySelector(`.${BUTTON_CLASS}`)) return;
      
      const button = document.createElement('button');
      button.className = BUTTON_CLASS;
      button.type = 'button';
      button.setAttribute('aria-label', '设置回答规则');
      button.dataset.state = 'closed';
      button.innerHTML = `
        <div class="flex items-center min-w-0 gap-two justify-center">
          <div class="flex shrink-0 items-center justify-center size-4">
            <svg role="img" class="inline-flex fill-current" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
            </svg>
          </div>
        </div>
      `;
      button.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        createModal();
      };

      modelButton.parentElement.insertBefore(button, modelButton);

      updateButtonState();
    }

    setTimeout(() => addRulesButton(), 1000);
    let lastUrl = location.href;
    let lastSpaceId = getCurrentSpaceId();
    const checkChanges = () => {
      const url = location.href;
      const spaceId = getCurrentSpaceId();
      if (url !== lastUrl || spaceId !== lastSpaceId) {
        lastUrl = url;
        lastSpaceId = spaceId;
        setTimeout(updateButtonState, 500);
      }
    };

    // 存储 observer 引用以便清理
    const urlObserver = new MutationObserver(checkChanges);
    urlObserver.observe(document, {subtree: true, childList: true});

    const buttonObserver = new MutationObserver(() => addRulesButton());
    buttonObserver.observe(document.body, {childList: true, subtree: true});

    // 清理资源（页面卸载时，只执行一次）
    globalThis.addEventListener('beforeunload', () => {
      urlObserver.disconnect();
      buttonObserver.disconnect();
    }, {once: true});
  }

  function setupGeminiAnswerRules() {
    const BUTTON_CLASS = 'gemini-rules-button';
    const MODAL_ID = 'gemini-rules-modal';

    function getCurrentStorageKey() {
      const path = globalThis.location.pathname;
      const gemMatch = new RegExp(/\/gem\/([^/]+)/).exec(path);
      if (gemMatch?.[1]) return `gemini_answer_rules_gem_${gemMatch[1]}`;
      return 'gemini_answer_rules_default';
    }

    function getRawRules() {
      try {
        return localStorage.getItem(getCurrentStorageKey()) || '';
      } catch (e) {
        console.error('[AI Wide] Failed to read Gemini rules:', e);
        return '';
      }
    }

    function saveRules(rules) {
      try {
        localStorage.setItem(getCurrentStorageKey(), rules.trim());
        return true;
      } catch (e) {
        console.error('[AI Wide] Failed to save Gemini rules:', e);
        return false;
      }
    }

    const geminiRuleStyles = `
      .${BUTTON_CLASS} {
        display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%;
        color: var(--color-on-surface-variant, #444746); cursor: pointer; transition: background-color 0.2s;
        border: none; background: transparent; flex-shrink: 0; margin: 0 4px;
      }
      .${BUTTON_CLASS}:hover { background-color: rgba(60, 64, 67, 0.08); }
      .${BUTTON_CLASS}.has-rules { color: #1a73e8; background-color: rgba(26, 115, 232, 0.1); }
      @media (prefers-color-scheme: dark) {
        .${BUTTON_CLASS} { color: #c4c7c5; }
        .${BUTTON_CLASS}:hover { background-color: rgba(255, 255, 255, 0.08); }
        .${BUTTON_CLASS}.has-rules { color: #8ab4f8; background-color: rgba(138, 180, 248, 0.1); }
      }
      #${MODAL_ID} { z-index: 99999 !important; font-family: 'Google Sans', Roboto, sans-serif; }
    `;
    if (!document.getElementById('gemini-rules-style')) {
      const styleEl = document.createElement('style');
      styleEl.id = 'gemini-rules-style';
      styleEl.textContent = geminiRuleStyles;
      document.head.appendChild(styleEl);
    }

    function createSvgIcon() {
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      svg.setAttribute("fill", "currentColor");
      svg.setAttribute("width", "24");
      svg.setAttribute("height", "24");
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", "M3 17v2h6v-2H3zM3 5v2h10V5H3zm10 16v-2h8v-2h-8v-2h-2v6h2zM7 9v2H3v2h4v2h2V9H7zm14 4v-2H11v2h10zm-6-4h2V7h4V5h-4V3h-2v6z");
      svg.appendChild(path);
      return svg;
    }

    function createModal() {
      const existing = document.getElementById(MODAL_ID);
      const existingOverlay = document.getElementById(`${MODAL_ID}-overlay`);
      if (existing) existing.remove();
      if (existingOverlay) existingOverlay.remove();
      const overlay = document.createElement('div');
      overlay.id = `${MODAL_ID}-overlay`;
      Object.assign(overlay.style, {
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        zIndex: '99998',
        backdropFilter: 'blur(4px)'
      });
      const modal = document.createElement('div');
      modal.id = MODAL_ID;
      Object.assign(modal.style, {
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'var(--md-sys-color-surface, #fff)',
        color: 'var(--md-sys-color-on-surface, #000)',
        borderRadius: '24px',
        padding: '24px',
        width: '90%',
        maxWidth: '700px',
        zIndex: '99999',
        boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      });
      if (document.body.classList.contains('dark-theme')) {
        modal.style.background = '#1e1f20';
        modal.style.color = '#e3e3e3';
      }

      const currentKey = getCurrentStorageKey();
      const isDefault = currentKey === 'gemini_answer_rules_default';
      const labelText = isDefault ? 'Global (Default)' : `Gem: ${currentKey.replace('gemini_answer_rules_gem_', '').substring(0, 8)}...`;
      const header = document.createElement('div');
      header.style.cssText = "font-size: 20px; font-weight: 500; margin-bottom: 8px; display: flex; justify-content: space-between;";
      const titleSpan = document.createElement('span');
      titleSpan.textContent = "Gemini 规则设置";
      const infoSpan = document.createElement('span');
      infoSpan.style.cssText = "font-size: 12px; opacity: 0.6; align-self: center;";
      infoSpan.textContent = labelText;
      header.appendChild(titleSpan);
      header.appendChild(infoSpan);
      const hint = document.createElement('div');
      hint.style.cssText = "font-size: 13px; opacity: 0.8; margin-bottom: 16px;";
      hint.textContent = "当前规则仅对该 Space/Gem 生效。";
      const textarea = document.createElement('textarea');
      textarea.id = `${MODAL_ID}-textarea`;
      textarea.style.cssText = "width: 100%; min-height: 350px; margin-bottom: 16px; background: transparent; color: inherit; border: 1px solid #ccc; border-radius: 8px; padding: 12px; box-sizing: border-box; resize: vertical;";
      textarea.value = getRawRules();
      const footer = document.createElement('div');
      footer.style.cssText = "display: flex; justify-content: flex-end; gap: 10px;";
      const saveBtn = document.createElement('button');
      saveBtn.textContent = "保存";
      saveBtn.style.cssText = "padding: 8px 16px; background: #0b57d0; color: white; border: none; border-radius: 18px; cursor: pointer;";
      const cancelBtn = document.createElement('button');
      cancelBtn.textContent = "取消";
      cancelBtn.style.cssText = "padding: 8px 16px; background: transparent; color: inherit; border: none; cursor: pointer;";
      footer.appendChild(cancelBtn);
      footer.appendChild(saveBtn);
      modal.appendChild(header);
      modal.appendChild(hint);
      modal.appendChild(textarea);
      modal.appendChild(footer);
      document.body.appendChild(overlay);
      document.body.appendChild(modal);
      const close = () => {
        overlay.remove();
        modal.remove();
      };
      cancelBtn.onclick = close;
      overlay.onclick = close;
      saveBtn.onclick = () => {
        saveRules(textarea.value);
        updateButtonState();
        close();
      };
      setTimeout(() => textarea.focus(), 100);
    }

    function updateButtonState() {
      const btn = document.querySelector(`.${BUTTON_CLASS}`);
      if (!btn) return;
      const hasRules = !!getRawRules().trim();
      if (hasRules) {
        btn.classList.add('has-rules');
        btn.title = "Gemini 规则：已启用 (点击编辑)";
      } else {
        btn.classList.remove('has-rules');
        btn.title = "Gemini 规则：未设置 (点击编辑)";
      }
    }

    function addButton() {
      if (document.querySelector(`.${BUTTON_CLASS}`)) return;
      // Updated to use optional chaining
      const uploaderContainer = document.querySelector('.uploader-button-container');
      const btn = document.createElement('button');
      btn.className = BUTTON_CLASS;
      btn.title = "Gemini 规则设置";
      btn.type = "button";
      btn.appendChild(createSvgIcon());
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        createModal();
      };
      if (uploaderContainer?.parentNode) {
        uploaderContainer.parentNode.insertBefore(btn, uploaderContainer);
        updateButtonState();
        return;
      }
      const leadingActions = document.querySelector('.leading-actions-wrapper');
      if (leadingActions) {
        leadingActions.insertBefore(btn, leadingActions.firstChild);
        updateButtonState();
      }
    }

    let lastPath = globalThis.location.pathname;
    // 生成期间 DOM 变化极频繁：回调节流，避免每次变化都执行 querySelector
    let buttonCheckScheduled = false;
    const observer = new MutationObserver(() => {
      if (buttonCheckScheduled) return;
      buttonCheckScheduled = true;
      setTimeout(() => {
        buttonCheckScheduled = false;
        if (!document.querySelector(`.${BUTTON_CLASS}`)) addButton();
        if (globalThis.location.pathname !== lastPath) {
          lastPath = globalThis.location.pathname;
          updateButtonState();
        }
      }, 300);
    });
    observer.observe(document.body, {childList: true, subtree: true});
    setTimeout(addButton, 500);
    setTimeout(addButton, 1500);
    setTimeout(addButton, 3000);

  }

  // ============================================================
  // 2. Immediate Logic (Network Interceptor, CSS Injection)
  // ============================================================

  // 2.1 Global Network Interceptor
  (function installNetworkInterceptor() {
    const originalFetch = globalThis.fetch;

    function getFetchUrl(input) {
      if (typeof input === 'string') return input;
      if (input instanceof Request) return input.url;
      return input?.href || '';
    }

    function formatRules(rules) {
      return `\n\n---\n回答规则「仅执行规则，勿输出讨论规则内容」：\n${rules.trim()}\n---`;
    }

    function getPerplexityRules() {
      if (!globalThis.location.hostname.includes('perplexity.ai')) return null;
      try {
        const spaceId = getCurrentSpaceId();
        const key = `pplx_answer_rules_${spaceId}`;
        const raw = localStorage.getItem(key);
        if (!raw?.trim()) return null;
        let content = raw.replace(/^回答规则\s*\n?---\s*\n?/m, '').replace(/\n?---\s*$/m, '').trim();
        return formatRules(content);
      } catch (e) {
        console.error('[AI Wide] PPLX Rule Read Error:', e);
        return null;
      }
    }

    /**
     * @param {{query_str?: string, params?: {dsl_query?: string}}} bodyObj
     * @param {string} formattedRules
     * @returns {{query_str?: string, params?: {dsl_query?: string}}}
     */
    function injectPerplexityBody(bodyObj, formattedRules) {
      const rulePattern = /---\s*\n回答规则「仅执行规则，勿输出讨论规则内容」：\s*\n[\s\S]*?\n---/g;
      const applyRules = (text) => {
        if (!text) return text;
        const cleaned = text.replaceAll(rulePattern, '').trim();
        return `${cleaned}${formattedRules}`;
      };
      if (bodyObj.query_str) bodyObj.query_str = applyRules(bodyObj.query_str);
      const params = bodyObj.params;
      if (params && params.dsl_query) {
        params.dsl_query = applyRules(params.dsl_query);
      }
      return bodyObj;
    }

    function handlePerplexityFetch(urlStr, init) {
      if (!urlStr?.includes('perplexity_ask')) return;
      if (typeof init.body !== 'string') return;
      try {
        const rules = getPerplexityRules();
        if (rules) {
          let bodyObj = JSON.parse(init.body);
          bodyObj = injectPerplexityBody(bodyObj, rules);
          init.body = JSON.stringify(bodyObj);
        }
      } catch (e) {
        // Silently ignore parse errors
      }
    }

    // --- Gemini 规则注入（网络层）---
    // Gemini 发送消息走 XHR 的 StreamGenerate 接口，body 形如：
    //   f.req=[null,"<内层JSON字符串>"]&at=...
    // 内层 JSON 的 [0][0] 即本次 prompt 文本。在该处追加规则，
    // 输入框保持纯净（不再做输入框注入 / 点击拦截 / 重发）。
    const GEMINI_RULE_MARKER = '回答规则「仅执行规则，勿输出讨论规则内容」';
    const GEMINI_RULE_PATTERN = /---\s*\n回答规则「仅执行规则，勿输出讨论规则内容」：[\s\S]*?\n---/g;

    function getGeminiRules() {
      if (!globalThis.location.hostname.includes('gemini.google.com')) return null;
      try {
        const gemMatch = /\/gem\/([^/]+)/.exec(globalThis.location.pathname);
        const key = gemMatch && gemMatch[1] ? `gemini_answer_rules_gem_${gemMatch[1]}` : 'gemini_answer_rules_default';
        const raw = localStorage.getItem(key);
        if (!raw || !raw.trim()) return null;
        return raw.trim();
      } catch (e) {
        return null;
      }
    }

    /**
     * @param {string} body
     * @returns {string}
     */
    function injectGeminiRulesIntoBody(body) {
      if (typeof body !== 'string' || !body.includes('f.req=')) return body;
      const rules = getGeminiRules();
      if (!rules) return body;
      try {
        const freqMatch = /(?:^|&)f\.req=([^&]*)/.exec(body);
        if (!freqMatch) return body;
        let freq = freqMatch[1];
        try {
          freq = decodeURIComponent(freq);
        } catch (_) {
          // 保持原样继续尝试解析
        }
        const outer = JSON.parse(freq);
        if (!Array.isArray(outer) || typeof outer[1] !== 'string') return body;
        const inner = JSON.parse(outer[1]);
        if (!Array.isArray(inner) || !Array.isArray(inner[0]) || typeof inner[0][0] !== 'string') return body;
        const prompt = inner[0][0];
        // 清理历史注入的规则（例如旧版本在输入框留下的），再追加当前规则
        const cleaned = prompt.replace(GEMINI_RULE_PATTERN, '').trim();
        if (!cleaned) return body;
        inner[0][0] = `${cleaned}\n---\n${GEMINI_RULE_MARKER}：\n${rules}\n---`;
        outer[1] = JSON.stringify(inner);
        const newFreq = encodeURIComponent(JSON.stringify(outer));
        // 只替换 f.req 参数，其余参数（at 等）原样保留
        return body.replace(/(^|&)f\.req=[^&]*/, (m, p1) => `${p1}f.req=${newFreq}`);
      } catch (e) {
        // 结构变化时静默放弃：只影响规则注入，不影响消息正常发送
        return body;
      }
    }

    // Gemini 用 XHR 发送消息（非 fetch）：在 send 前改写 StreamGenerate 的请求体
    const origXhrOpen = XMLHttpRequest.prototype.open;
    const origXhrSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.open = function (method, url) {
      this.__aiWideUrl = url;
      this.__aiWideMethod = method;
      return origXhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      try {
        if (this.__aiWideMethod === 'POST'
          && typeof this.__aiWideUrl === 'string'
          && /\/StreamGenerate/.test(this.__aiWideUrl)) {
          const rewritten = injectGeminiRulesIntoBody(body);
          if (rewritten !== body) {
            arguments[0] = rewritten;
          }
        }
      } catch (_) {
        // 拦截失败时按原样发送
      }
      return origXhrSend.apply(this, arguments);
    };

    globalThis.fetch = async function (input, init) {
      const urlStr = getFetchUrl(input);
      const isPost = init?.method === 'POST';

      if (isPost && init?.body) {
        handlePerplexityFetch(urlStr, init);
      }

      const responsePromise = originalFetch.call(this, input, init);

      // [DISABLED 2026-08-25] 侧窗已停用，不再派发配额刷新事件
      // if (isPost && urlStr?.includes('perplexity_ask')) {
      //   responsePromise.then(() => {
      //     setTimeout(() => {
      //       globalThis.dispatchEvent(new CustomEvent('ppx:refresh-quota'));
      //     }, REFRESH_QUOTA_DELAY);
      //   });
      // }

      return responsePromise;
    };
  })();

  // 2.3 Style Injection (Immediate)
  (function injectStylesImmediately() {
    const host = globalThis.location.hostname;
    const styleElement = document.createElement('style');
    styleElement.id = 'ai-widescreen-style';

    if (host.includes('perplexity.ai')) {
      styleElement.textContent = perplexityCSS;
      (document.head || document.documentElement).appendChild(styleElement);
    } else if (host.includes('gemini.google.com')) {
      const isGeminiChat = () => {
        const path = globalThis.location.pathname;
        return /\/app\/[\w-]+/.test(path) || /\/gem\/[\w-]+\/[\w-]+/.test(path);
      };

      const updateGeminiStyles = () => {
        if (!document.getElementById('ai-widescreen-style')) {
          (document.head || document.documentElement).appendChild(styleElement);
        }
        if (isGeminiChat()) {
          if (styleElement.textContent !== geminiCSS) {
            styleElement.textContent = geminiCSS;
          }
        } else {
          styleElement.textContent = '';
        }
      };

      updateGeminiStyles();
      globalThis.addEventListener('popstate', updateGeminiStyles);
      let lastPath = globalThis.location.pathname;
      const urlObserver = new MutationObserver(() => {
        if (globalThis.location.pathname !== lastPath) {
          lastPath = globalThis.location.pathname;
          updateGeminiStyles();
        }
      });
      urlObserver.observe(document.documentElement, {childList: true, subtree: true});
    }
  })();

  // ============================================================
  // 3. UI Initialization (Wait for Body)
  // ============================================================
  function initUI() {
    const host = globalThis.location.hostname;

    if (host.includes('perplexity.ai')) {
      setupAnswerRules();
      // [DISABLED 2026-08-25] 侧边状态面板停用（官方配额接口已无数据）
      // setupPerplexityStatusMonitor();
    } else if (host.includes('gemini.google.com')) {
      const isGeminiChat = () => {
        const path = globalThis.location.pathname;
        return /\/app\/[\w-]+/.test(path) || /\/gem\/[\w-]+\/[\w-]+/.test(path);
      };
      const geminiInterval = setInterval(() => {
        if (isGeminiChat()) forceGeminiFullWidth();
      }, GEMINI_ALIGN_INTERVAL);
      const geminiObserver = new MutationObserver(() => {
        if (isGeminiChat()) forceGeminiFullWidth();
      });
      geminiObserver.observe(document.body, {childList: true, subtree: true});

      // 清理资源（页面卸载时，只执行一次）
      globalThis.addEventListener('beforeunload', () => {
        clearInterval(geminiInterval);
        geminiObserver.disconnect();
      }, {once: true});

      setupGeminiAnswerRules();
    }
  }

  // ============================================================
  // 4. Bootloader
  // ============================================================
  if (document.body) {
    initUI();
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      initUI();
    });
    const observer = new MutationObserver((mutations, obs) => {
      if (document.body) {
        initUI();
        obs.disconnect();
      }
    });
    observer.observe(document.documentElement, {childList: true});
  }

})();