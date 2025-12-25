// ==UserScript==
// @name         AI 宽屏助手 (Perplexity & Gemini)
// @namespace    http://tampermonkey.net/
// @version      1.1.3
// @description  Perplexity: 宽屏 + 中文字体 + 模型标签 + 设置弹窗增强 + 自动跟在请求后的回答规则；Gemini: 宽屏 - 自动跟在请求后的回答规则
// @author       AhogeK
// @match        https://www.perplexity.ai/*
// @match        https://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=perplexity.ai
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  // Configuration: desired column width and bubble width
  const MAX_WIDTH = '1600px';
  const USER_BUBBLE_WIDTH = '760px';

  // ============================================================
  // 0. 统一全局网络拦截器 (Unified Global Network Interceptor)
  // 优化：修复 Perplexity Space ID 识别问题，统一规则格式
  // ============================================================
  (function installNetworkInterceptor() {
    console.log('[AI Widescreen] Initializing Unified Network Interceptor...');

    const originalFetch = globalThis.fetch;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    // --- 工具函数 ---

    // [关键修复] 获取 Perplexity Space ID (增加 DOM 兜底)
    function getPerplexitySpaceId() {
      // 1. 尝试从 URL 获取
      const urlMatch = new RegExp(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/).exec(globalThis.location.pathname);
      if (urlMatch) return urlMatch[1];

      // 2. [新增] 尝试从 DOM 获取 (解决 URL 未更新或处于搜索视图时的问题)
      // 仅在 Perplexity 域名下执行 DOM 操作以策安全
      if (globalThis.location.hostname.includes('perplexity.ai')) {
        try {
          // 查找指向 Space 的链接（通常在侧边栏或顶部）
          const spaceLink = document.querySelector('a[href*="/spaces/"]');
          if (spaceLink) {
            const href = spaceLink.getAttribute('href');
            const hrefMatch = new RegExp(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/).exec(href);
            if (hrefMatch) return hrefMatch[1];
          }
        } catch (e) {
          console.debug('[perplexity] Failed to detect Space ID from DOM fallback.', e);
        }
      }

      return 'default';
    }

    function getFetchUrl(input) {
      if (typeof input === 'string') return input;
      if (input instanceof Request) return input.url;
      return input?.href || '';
    }

    // [统一格式] 两个平台共用此格式
    function formatRules(rules) {
      return `\n\n---\n回答规则「仅执行规则，勿输出讨论规则内容」：\n${rules.trim()}\n---`;
    }

    // --- Perplexity 逻辑区域 ---
    function getPerplexityRules() {
      if (!globalThis.location.hostname.includes('perplexity.ai')) return null;
      try {
        const spaceId = getPerplexitySpaceId(); // 使用增强版的 ID 获取函数
        const key = `pplx_answer_rules_${spaceId}`;
        const raw = localStorage.getItem(key);
        if (!raw?.trim()) return null;

        // 清理存储中可能存在的旧标记，确保存储的是纯文本
        let content = raw.replace(/^回答规则\s*\n?---\s*\n?/m, '').replace(/\n?---\s*$/m, '').trim();
        // 返回统一格式
        return formatRules(content);
      } catch (e) {
        console.warn('[AI Widescreen] Error reading PPLX rules:', e);
        return null;
      }
    }

    function injectPerplexityBody(bodyObj, formattedRules) {
      // Perplexity 策略：清理旧规则 -> 追加新规则
      // 使用正则精准匹配旧的规则块
      const rulePattern = /---\s*\n回答规则「仅执行规则，勿输出讨论规则内容」：\s*\n[\s\S]*?\n---/g;

      const applyRules = (text) => {
        if (!text) return text;
        // 1. 清理旧规则（防止用户编辑问题后重复堆叠）
        const cleaned = text.replaceAll(rulePattern, '').trim();
        // 2. 追加新规则
        return `${cleaned}${formattedRules}`;
      };

      if (bodyObj.query_str) {
        bodyObj.query_str = applyRules(bodyObj.query_str);
      }
      if (bodyObj.params?.dsl_query) {
        bodyObj.params.dsl_query = applyRules(bodyObj.params.dsl_query);
      }
      // [保留] 强制 source 参数
      if (bodyObj.params) {
        bodyObj.params.source = 'ios';
      }
      return bodyObj;
    }

    // --- Gemini 逻辑区域 ---
    function getGeminiRules() {
      if (!globalThis.location.hostname.includes('gemini.google.com')) return null;
      try {
        const path = globalThis.location.pathname;
        const gemMatch = new RegExp(/\/gem\/([^/]+)/).exec(path);
        let rawRules = '';
        if (gemMatch?.[1]) {
          rawRules = localStorage.getItem(`gemini_answer_rules_gem_${gemMatch[1]}`) || '';
        }
        if (!rawRules) {
          rawRules = localStorage.getItem('gemini_answer_rules_default') || '';
        }
        if (rawRules.trim()) {
          // 返回统一格式
          return formatRules(rawRules);
        }
      } catch (e) {
        console.warn('[AI Widescreen] Error reading Gemini rules:', e);
      }
      return null;
    }

    function injectGeminiFreq(freqStr, formattedRules) {
      if (!formattedRules) return null;
      try {
        const outer = JSON.parse(freqStr);
        if (!Array.isArray(outer) || !outer[1] || typeof outer[1] !== 'string') return null;
        const innerStr = outer[1];
        const inner = JSON.parse(innerStr);
        let modified = false;

        if (Array.isArray(inner) && inner.length > 0 && Array.isArray(inner[0])) {
          const potentialPrompt = inner[0][0];
          if (typeof potentialPrompt === 'string') {
            // Gemini 策略：清理旧规则 -> 覆盖新规则
            const rulePattern = /---\s*\n回答规则「仅执行规则，勿输出讨论规则内容」：\s*\n[\s\S]*?\n---/g;
            const cleanPrompt = potentialPrompt.replaceAll(rulePattern, '').trim();

            inner[0][0] = cleanPrompt + formattedRules;
            modified = true;
          }
        }
        if (modified) {
          outer[1] = JSON.stringify(inner);
          return JSON.stringify(outer);
        }
      } catch (e) {
        console.warn('[AI Widescreen] Gemini JSON Parse Warning (non-critical):', e);
      }
      return null;
    }

    function processGeminiBody(body) {
      const rules = getGeminiRules();
      if (!rules) return null;

      let freq = null;
      let type = 'unknown';

      if (typeof body === 'string') {
        type = 'string';
        const p = new URLSearchParams(body);
        freq = p.get('f.req');
      } else if (body instanceof URLSearchParams) {
        type = 'searchparams';
        freq = body.get('f.req');
      } else if (body instanceof FormData) {
        type = 'formdata';
        freq = body.get('f.req');
      }

      if (!freq) return null;
      const newFreq = injectGeminiFreq(freq, rules);
      if (!newFreq) return null;

      if (type === 'string') {
        const p = new URLSearchParams(body);
        p.set('f.req', newFreq);
        return p.toString();
      } else if (type === 'searchparams' || type === 'formdata') {
        body.set('f.req', newFreq);
        return body;
      }
      return null;
    }

    // --- 路由分发 ---

    // Gemini Fetch 处理
    function handleGeminiFetch(urlStr, init) {
      if (!urlStr.includes('batchexecute') && !urlStr.includes('StreamGenerate')) return false;

      const newBody = processGeminiBody(init.body);
      if (newBody) {
        init.body = newBody;
        console.log('[AI Widescreen] Gemini Rules Injected');
        return true;
      }
      return false;
    }

    // Perplexity Fetch 处理
    function handlePerplexityFetch(urlStr, init) {
      if (!urlStr.includes('perplexity_ask')) return false;
      if (typeof init.body !== 'string') return false;

      try {
        const rules = getPerplexityRules();
        if (rules) { // 即使 rules 为空，我们也要进入注入逻辑以确保 source 参数被修改
          let bodyObj = JSON.parse(init.body);
          bodyObj = injectPerplexityBody(bodyObj, rules); // rules 包含格式化内容
          init.body = JSON.stringify(bodyObj);
          console.log('[AI Widescreen] Perplexity Rules Injected');
          return true;
        } else {
          // 即使没有规则，也要修改 source 参数
          let bodyObj = JSON.parse(init.body);
          if (bodyObj.params) {
            bodyObj.params.source = 'ios';
            init.body = JSON.stringify(bodyObj);
          }
        }
      } catch (e) {
        console.warn('[AI Widescreen] PPLX Injection Failed:', e);
      }
      return false;
    }

    // --- 统一 Fetch 拦截 ---
    globalThis.fetch = async function (input, init) {
      const urlStr = getFetchUrl(input);

      if (init?.method === 'POST' && init.body) {
        if (!handleGeminiFetch(urlStr, init)) {
          handlePerplexityFetch(urlStr, init);
        }
      }

      return originalFetch.call(this, input, init);
    };

    // --- 统一 XHR 拦截 (主要针对 Gemini) ---
    XMLHttpRequest.prototype.open = function (method, url) {
      this._reqUrl = (typeof url === 'string' ? url : url?.toString() || '');
      return originalXhrOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function (body) {
      if (this._reqUrl && (this._reqUrl.includes('batchexecute') || this._reqUrl.includes('StreamGenerate'))) {
        if (body) {
          const newBody = processGeminiBody(body);
          if (newBody) {
            return originalXhrSend.call(this, newBody);
          }
        }
      }
      return originalXhrSend.apply(this, arguments);
    };

    console.log('[AI Widescreen] Unified Interceptor Installed.');
  })();

  // ============================================================
  // 1. Perplexity Section
  // ============================================================
  const perplexityCSS = `
    /* === Base font configuration === */
    body, html, .font-sans, .prose {
      font-family:
        "Söhne", "Söhne Circle", "Söhne Breit", "Söhne Mono",
        "Google Sans", "Roboto",
        ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont,
        "Segoe UI", "Helvetica Neue", Arial,
        "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei",
        "WenQuanYi Micro Hei", sans-serif !important;
    }

    /* === Widescreen settings for conversation content === */
    .max-w-threadContentWidth, .max-w-3xl, .max-w-4xl, .max-w-5xl, .max-w-6xl {
      width: auto !important;
      max-width: 95% !important;
    }

    @media (min-width: 1280px) {
      .max-w-threadContentWidth, .max-w-3xl, .max-w-4xl, .max-w-5xl, .max-w-6xl {
        max-width: ${MAX_WIDTH} !important;
      }
    }

    /* === Settings modal size optimization === */
    div[class*="duration-200"][class*="fill-mode-both"][class*="animate-in"]
    > div
    > div.bg-base.shadow-md.overflow-y-auto.scrollbar-subtle {
      min-width: 800px !important;
      max-width: 1000px !important;
      width: 1000px !important;
      max-height: 90vh !important;
    }

    /* Expand answer instructions textarea */
    textarea[data-testid="answer-instructions-input"] {
      min-height: 350px !important;
      height: 350px !important;
      max-height: 600px !important;
      resize: vertical !important;
      overflow-y: auto !important;
    }

    div[data-test-id="answer-instructions-input"] .relative.flex.items-center {
      min-height: 350px !important;
    }

    div[data-test-id="answer-instructions-input"] div[class*="w-full"][class*="focus:ring-subtler"] {
      min-height: 350px !important;
      align-items: flex-start !important;
    }

    div[class*="px-md"][class*="pb-md"][class*="flex"][class*="min-h-0"]
    > div[class*="grow"][class*="flex-col"][class*="p-sm"] {
      padding-top: 1.5rem !important;
      padding-bottom: 1.5rem !important;
    }

    div.bg-base.shadow-md.overflow-y-auto.scrollbar-subtle {
      overflow-y: auto !important;
      scrollbar-width: thin !important;
    }

    /* === [修改] 按钮位置：右下角输入框上方，水平排列 === */
    /* [Change] Position buttons horizontally above the input box (bottom-right) */
    div.bottom-md.right-md.fixed {
      /* Reset default positioning */
      top: auto !important;
      transform: none !important;

      /* Position: ~120px from bottom to sit just above the standard input bar */
      bottom: 120px !important; 
      right: 30px !important;
      
      /* Layout: Horizontal row (Left-Right) */
      display: flex !important;
      flex-direction: row !important;
      gap: 12px !important;
      
      /* Ghost Mode: Semi-transparent when idle, opaque on hover */
      opacity: 0.1 !important;
      transition: opacity 0.3s ease-in-out !important;
      z-index: 50;
      pointer-events: auto !important;
    }

    /* Hover state for visibility */
    div.bottom-md.right-md.fixed:hover {
      opacity: 1 !important;
    }

    /* Force internal flex containers to also be horizontal */
    div.bottom-md.right-md.fixed > div.flex {
      flex-direction: row !important;
    }
  `;

  // ============================================================
  // 2. Gemini CSS Section (Base Layout - Fixed Version)
  // ============================================================
  const geminiCSS = `
    /* --- Fix 1: Force outer scroll container to full width --- */
    /* This ensures scrollbar stays at the right edge of the screen */
    .chat-history-scroll-container {
      width: 100% !important;
      max-width: 100% !important;
    }

    /* --- Fix 2: Core content area width limit + forced centering --- */
    infinite-scroller .conversation-container,
    .input-area-container {
      width: 100% !important;
      max-width: ${MAX_WIDTH} !important;
      /* Key: Auto margins for centering */
      margin-left: auto !important;
      margin-right: auto !important;
    }

    /* Critical fix: Force custom tags to be block-level, otherwise width 100% won't work */
    user-query, user-query-content {
      display: block !important;
      width: 100% !important;
      max-width: 100% !important;
    }

    infinite-scroller .conversation-container {
      padding-left: 24px !important;
      padding-right: 24px !important;
      box-sizing: border-box !important;
    }

    code-block, .formatted-code-block-internal-container, .code-block pre, .code-container {
      max-width: 100% !important;
      overflow: visible !important;
      white-space: pre-wrap !important;
    }

    /* Hide flex placeholders that might interfere with layout */
    .user-query-container > div[style*="flex"],
    user-query-content > div[style*="flex"] {
      display: none !important;
    }

    /* Clear floats */
    user-query-content::after {
      content: "";
      display: table;
      clear: both;
    }
  `;

  // ============================================================
  // 3. Gemini JS Fix Logic (V83 Float + Block Strategy)
  // ============================================================
  function forceGeminiRightAlign() {
    const queryContents = document.querySelectorAll('user-query-content.user-query-container');

    queryContents.forEach(el => {
      // 1. Parent: Force block layout
      if (el.style.display !== 'block' || el.style.width !== '100%') {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('width', '100%', 'important');

        // Clean up old properties
        el.style.removeProperty('flex-direction');
        el.style.removeProperty('justify-content');
        el.style.removeProperty('align-items');
      }

      // 2. Child bubble container: Float right
      const bubble = el.querySelector('.user-query-bubble-container');
      if (bubble) {
        if (bubble.style.float !== 'right') {
          bubble.style.setProperty('float', 'right', 'important');
          bubble.style.setProperty('max-width', USER_BUBBLE_WIDTH, 'important');

          // Ensure it's block-level to support float
          bubble.style.setProperty('display', 'block', 'important');

          // Left-align internal text
          bubble.style.setProperty('text-align', 'left', 'important');

          // Clear margins
          bubble.style.setProperty('margin-left', '0', 'important');
          bubble.style.setProperty('margin-right', '0', 'important');

          // Clear Flex/Width locks
          bubble.style.removeProperty('width');
          bubble.style.removeProperty('flex');
        }
      }

      // 3. Outer and ancestor span fixes (critical)
      let parent = el.parentElement;
      while (parent) {
        // Walk up to user-query, ensure all containers along the way are full-width block-level
        if (parent.tagName === 'SPAN' || parent.tagName === 'USER-QUERY') {
          if (parent.style.display !== 'block' || parent.style.width !== '100%') {
            parent.style.setProperty('display', 'block', 'important');
            parent.style.setProperty('width', '100%', 'important');
          }
        }
        if (parent.tagName === 'USER-QUERY') break; // Stop at user-query level
        parent = parent.parentElement;
      }
    });
  }

  // ============================================================
  // 4. Perplexity Model Label Logic
  // ============================================================
  function setupPerplexityModelLabels() {
    const MODEL_LABEL_CLASS = 'pplx-inline-model-label';
    const style = document.createElement('style');

    // [变更] 更新 CSS 以支持亮色/暗色主题适配
    // [Change] Updated CSS to support both Light and Dark themes via .dark selector
    style.textContent = `
    .${MODEL_LABEL_CLASS} {
      margin-left: 6px;
      padding: 0 8px;
      border-radius: 999px;
      font-size: 12px;
      line-height: 20px;
      height: 20px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      white-space: nowrap;
      
      /* Default (Light Mode) Styling */
      /* Use dark semi-transparent colors for light backgrounds */
      background: rgba(0, 0, 0, 0.05);
      color: rgba(0, 0, 0, 0.65);
      border: 1px solid rgba(0, 0, 0, 0.1);
    }

    /* Dark Mode Override */
    /* Perplexity applies the .dark class to the HTML root */
    .dark .${MODEL_LABEL_CLASS} {
      background: rgba(255, 255, 255, 0.04);
      color: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
  `;
    document.head.appendChild(style);

    const NON_MODEL_LABELS = new Set(['Share', 'Export', 'Rewrite', 'Helpful', 'Not helpful', 'Copy', 'More actions']);

    function isModelLabel(label) {
      if (!label) return false;
      if (NON_MODEL_LABELS.has(label)) return false;
      // Fixed: Added 'grok' to support Grok models
      return /gpt|gemini|claude|llama|sonnet|opus|haiku|grok|o1|o3/i.test(label);
    }

    function enhanceModelButtons(root = document) {
      // 1. [New] Dedicated logic to strip tooltips from the floating footer buttons
      // Target the specific container for Language/Help buttons
      const footerButtons = root.querySelectorAll('.bottom-md.right-md.fixed button[aria-label]');
      footerButtons.forEach(btn => {
        // Remove aria-label immediately to prevent tooltip from appearing
        btn.removeAttribute('aria-label');
      });

      // 2. Existing logic for Model Labels (Top-left usually)
      const buttons = root.querySelectorAll('button[aria-label]');
      buttons.forEach(button => {
        // Skip if already processed or if it's one of the footer buttons we just cleaned
        if (button.dataset.modelLabelInjected === '1') return;

        // Double check: if we somehow missed stripping the label above, do it here based on text content
        const label = button.getAttribute('aria-label') || '';
        if (label === 'Language' || label === 'Help menu' || label === 'Change language') {
          button.removeAttribute('aria-label');
          return;
        }

        // --- Model Label Logic ---
        if (!isModelLabel(label)) return;

        // Ensure we are targeting the small icon buttons (h-8 aspect-square pattern usually)
        const cls = button.className || '';
        if (!cls.includes('h-8') || !cls.includes('aspect-square')) return;

        button.dataset.modelLabelInjected = '1';
        const span = document.createElement('span');
        span.className = MODEL_LABEL_CLASS;
        span.textContent = label;

        // Insert after the button container
        const container = button.closest('span') || button;
        container.after(span);
      });
    }

    // Initial run
    setTimeout(() => enhanceModelButtons(), 500);

    // Observe DOM changes for new messages
    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          enhanceModelButtons(node);
        });
      }
    });
    observer.observe(document.body, {childList: true, subtree: true});
  }

  // ============================================================
  // 5. Main Injection Logic (Updated for Gemini Chat Detection)
  // ============================================================
  const host = globalThis.location.hostname;
  const styleElement = document.createElement('style');
  styleElement.id = 'ai-widescreen-style';

  if (host.includes('perplexity.ai')) {
    // Perplexity logic remains the same
    styleElement.textContent = perplexityCSS;
    document.head.appendChild(styleElement);
    setupPerplexityModelLabels();
    setupAnswerRules();
  } else if (host.includes('gemini.google.com')) {
    // Define a function to check if we are in a valid chat URL
    const isGeminiChat = () => {
      const path = globalThis.location.pathname;
      // Regex Explanation:
      // 1. /\/app\/[\w-]+/: Matches /app/ followed by ID (e.g., /app/123-abc)
      // 2. /\/gem\/[\w-]+\/[\w-]+/: Matches /gem/model-id/chat-id
      return /\/app\/[\w-]+/.test(path) || /\/gem\/[\w-]+\/[\w-]+/.test(path);
    };

    // Function to toggle styles based on current URL
    const updateGeminiStyles = () => {
      // Always ensure the style element is in the DOM
      if (!document.getElementById('ai-widescreen-style')) {
        document.head.appendChild(styleElement);
      }

      if (isGeminiChat()) {
        // If in chat, apply the CSS if it's not already applied
        if (styleElement.textContent !== geminiCSS) {
          styleElement.textContent = geminiCSS;
        }
      } else {
        // If not in chat (home page, settings, etc.), clear the CSS
        styleElement.textContent = '';
      }
    };

    // Initial check
    updateGeminiStyles();

    // Loop for right-alignment fix (Only runs effectively when in chat)
    setInterval(() => {
      if (isGeminiChat()) {
        forceGeminiRightAlign();
      }
    }, 500);

    // Observer to handle SPA navigation (URL changes without reload)
    const observer = new MutationObserver(() => {
      updateGeminiStyles();
      if (isGeminiChat()) {
        forceGeminiRightAlign();
      }
    });

    observer.observe(document.head, {childList: true});
    observer.observe(document.body, {childList: true, subtree: true});

    // Listen to history events just in case
    globalThis.addEventListener('popstate', updateGeminiStyles);

    setupGeminiAnswerRules();
  }

  // ============================================================
  // 6. Perplexity Answer Rules Feature
  // ============================================================
  function setupAnswerRules() {
    const RULES_STORAGE_PREFIX = 'pplx_answer_rules_';
    const BUTTON_CLASS = 'pplx-rules-button';
    const MODAL_ID = 'pplx-rules-modal';

    // 获取当前 Space ID（优化版）
    function getCurrentSpaceId() {
      // 方法1: 从 URL 中获取
      // 修复：使用非贪婪匹配 .*? 或匹配最后一个 - 后的内容
      const urlMatch = new RegExp(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/).exec(globalThis.location.pathname);
      if (urlMatch) {
        return urlMatch[1];
      }

      // 方法2: 从 DOM 中查找 Space 链接
      const spaceLink = document.querySelector('a[href*="/spaces/"]');
      if (spaceLink) {
        const href = spaceLink.getAttribute('href');
        // 同样修复 DOM 查找的正则
        const hrefMatch = new RegExp(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/).exec(href);
        if (hrefMatch) {
          return hrefMatch[1];
        }
      }

      // 默认：不在任何 Space 中
      return 'default';
    }

    // 获取存储键
    function getStorageKey() {
      const spaceId = getCurrentSpaceId();
      return `${RULES_STORAGE_PREFIX}${spaceId}`;
    }

    // 保存规则（保存原始内容，不含格式）
    function saveRules(rules) {
      try {
        // 保存时去除格式标记，只保存纯内容
        let content = rules
            .replace(/^回答规则\s*\n?---\s*\n?/m, '')
            .replace(/\n?---\s*$/m, '')
            .trim();

        localStorage.setItem(getStorageKey(), content);
        return true;
      } catch (e) {
        console.error('Failed to save rules:', e);
        return false;
      }
    }

    // 获取原始规则内容（用于编辑器显示）
    function getRawRules() {
      try {
        return localStorage.getItem(getStorageKey()) || '';
      } catch (e) {
        console.error('Failed to get rules:', e);
        return '';
      }
    }

    // 添加样式
    const ruleStyles = `
    .${BUTTON_CLASS} {
      font-sans: inherit;
      outline: none;
      transition: all 0.3s ease-out;
      user-select: none;
      position: relative;
      font-weight: 600;
      justify-content: center;
      text-align: center;
      align-items: center;
      border-radius: 0.5rem;
      cursor: pointer;
      white-space: nowrap;
      display: inline-flex;
      font-size: 0.875rem;
      height: 2rem;
      aspect-ratio: 9/8;
      color: var(--text-quiet);
      background: transparent;
      border: none;
    }

    .${BUTTON_CLASS}:hover {
      background: var(--bg-subtle);
      color: var(--text-foreground);
    }

    .${BUTTON_CLASS}:active {
      scale: 0.97;
    }

    .${BUTTON_CLASS}.has-rules {
      color: var(--text-super);
    }

    #${MODAL_ID} {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: var(--bg-base);
      border: 1px solid var(--border-subtlest);
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 600px;
      z-index: 10000;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
    }

    #${MODAL_ID} textarea {
      width: 100%;
      min-height: 300px;
      background: var(--bg-offset);
      border: 1px solid var(--border-subtler);
      border-radius: 8px;
      padding: 12px;
      color: var(--text-foreground);
      font-family: 'Söhne Mono', monospace;
      font-size: 13px;
      line-height: 1.5;
      resize: vertical;
      outline: none;
    }

    #${MODAL_ID} textarea:focus {
      border-color: var(--border-super);
      box-shadow: 0 0 0 2px var(--bg-super-10);
    }

    #${MODAL_ID} .modal-header {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 8px;
      color: var(--text-foreground);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    #${MODAL_ID} .modal-space-info {
      font-size: 12px;
      color: var(--text-quieter);
      font-weight: 400;
    }

    #${MODAL_ID} .modal-hint {
      font-size: 12px;
      color: var(--text-quieter);
      margin-bottom: 12px;
      line-height: 1.4;
    }

    #${MODAL_ID} .modal-footer {
      margin-top: 16px;
      display: flex;
      gap: 12px;
      justify-content: flex-end;
    }

    #${MODAL_ID} button {
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }

    #${MODAL_ID} .btn-save {
      background: var(--bg-super);
      color: var(--text-inverse);
    }

    #${MODAL_ID} .btn-save:hover {
      opacity: 0.8;
    }

    #${MODAL_ID} .btn-cancel {
      background: var(--bg-subtle);
      color: var(--text-foreground);
    }

    #${MODAL_ID} .btn-cancel:hover {
      background: var(--bg-subtler);
    }

    #${MODAL_ID}-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.6);
      z-index: 9999;
      backdrop-filter: blur(4px);
    }
  `;

    const styleElement = document.createElement('style');
    styleElement.textContent = ruleStyles;
    document.head.appendChild(styleElement);

    // 创建模态框
    function createModal() {
      const existingModal = document.getElementById(MODAL_ID);
      const existingOverlay = document.getElementById(`${MODAL_ID}-overlay`);
      if (existingModal) existingModal.remove();
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement('div');
      overlay.id = `${MODAL_ID}-overlay`;

      const modal = document.createElement('div');
      modal.id = MODAL_ID;

      const spaceId = getCurrentSpaceId();
      const isDefaultSpace = spaceId === 'default';

      // 获取原始规则内容（不含格式）
      const rawRules = getRawRules();

      modal.innerHTML = `
      <div class="modal-header">
        <span>设置回答规则</span>
        <span class="modal-space-info">${isDefaultSpace ? '默认空间' : `Space: ${spaceId.substring(0, 12)}...`}</span>
      </div>
      <div class="modal-hint">
        💡 提示：只需输入规则内容，系统会自动添加格式标记。每次发送消息时，规则会自动添加到问题前面。
      </div>
      <textarea id="${MODAL_ID}-textarea" placeholder="输入回答规则内容，例如：&#10;&#10;请用中文回答，要求简洁明了&#10;回答需要包含代码示例&#10;使用专业术语时需要解释">${rawRules}</textarea>
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
        modal.remove();
        overlay.remove();
      };

      saveBtn.onclick = () => {
        const rules = textarea.value.trim();
        if (saveRules(rules)) {
          updateButtonState();
          closeModal();
        } else {
          alert('规则保存失败，请重试！');
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

    // 更新按钮状态
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

    // 添加按钮
    function addRulesButton() {
      if (document.querySelector(`.${BUTTON_CLASS}`)) return;

      const toolbarContainer = document.querySelector('.flex.items-center.justify-self-end.col-start-3.row-start-2');

      if (!toolbarContainer) return;

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

      const attachButton = toolbarContainer.querySelector('[data-testid="attach-files-button"]');
      if (attachButton?.parentElement) {
        attachButton.parentElement.parentElement.insertBefore(button, attachButton.parentElement);
      } else {
        const firstChild = toolbarContainer.firstElementChild;
        if (firstChild?.nextElementSibling) {
          toolbarContainer.insertBefore(button, firstChild.nextElementSibling);
        }
      }

      updateButtonState();
    }

    // 初始化按钮
    setTimeout(() => {
      addRulesButton();
    }, 1000);

    // 监听 URL 变化和 DOM 变化
    let lastUrl = location.href;
    let lastSpaceId = getCurrentSpaceId();

    const checkChanges = () => {
      const url = location.href;
      const spaceId = getCurrentSpaceId();

      if (url !== lastUrl || spaceId !== lastSpaceId) {
        lastUrl = url;
        lastSpaceId = spaceId;
        setTimeout(updateButtonState, 500);
        console.log('Space changed to:', spaceId);
      }
    };

    new MutationObserver(checkChanges).observe(document, {subtree: true, childList: true});

    // 监听 DOM 变化以重新添加按钮
    const observer = new MutationObserver(() => {
      addRulesButton();
    });
    observer.observe(document.body, {childList: true, subtree: true});
  }

  // ============================================================
  // 6.5. Gemini Answer Rules UI (Multi-Space Support)
  // ============================================================
  function setupGeminiAnswerRules() {
    const BUTTON_CLASS = 'gemini-rules-button';
    const MODAL_ID = 'gemini-rules-modal';

    // --- Dynamic Key Logic ---
    // 根据 URL 判断当前是 Default 还是特定的 Gem
    function getCurrentStorageKey() {
      const path = globalThis.location.pathname;
      // 匹配 /gem/ 后面的第一个 ID 段
      // 例如: /gem/gem-id-1234/chat-id -> 捕获 gem-id-1234
      const gemMatch = new RegExp(/\/gem\/([^/]+)/).exec(path);

      if (gemMatch?.[1]) {
        return `gemini_answer_rules_gem_${gemMatch[1]}`;
      }
      return 'gemini_answer_rules_default';
    }

    function getRawRules() {
      return localStorage.getItem(getCurrentStorageKey()) || '';
    }

    function saveRules(rules) {
      try {
        localStorage.setItem(getCurrentStorageKey(), rules.trim());
        return true;
      } catch (e) {
        console.error('Failed to save Gemini rules:', e);
        return false;
      }
    }

    // Styles
    const geminiRuleStyles = `
      .${BUTTON_CLASS} {
        display: flex; align-items: center; justify-content: center;
        width: 40px; height: 40px; border-radius: 50%;
        color: var(--color-on-surface-variant, #444746);
        cursor: pointer; transition: background-color 0.2s;
        border: none; background: transparent; flex-shrink: 0;
        margin: 0 4px;
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

    // --- Helper: Create SVG safely without innerHTML ---
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

    // Modal Creation Logic
    function createModal() {
      const existing = document.getElementById(MODAL_ID);
      const existingOverlay = document.getElementById(`${MODAL_ID}-overlay`);
      if (existing) existing.remove();
      if (existingOverlay) existingOverlay.remove();

      const overlay = document.createElement('div');
      overlay.id = `${MODAL_ID}-overlay`;
      Object.assign(overlay.style, {
        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.6)', zIndex: '99998', backdropFilter: 'blur(4px)'
      });

      const modal = document.createElement('div');
      modal.id = MODAL_ID;
      Object.assign(modal.style, {
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        background: 'var(--md-sys-color-surface, #fff)',
        color: 'var(--md-sys-color-on-surface, #000)',
        borderRadius: '24px', padding: '24px', width: '90%', maxWidth: '600px',
        zIndex: '99999', boxShadow: '0 24px 48px rgba(0,0,0,0.2)'
      });

      if (document.body.classList.contains('dark-theme')) {
        modal.style.background = '#1e1f20';
        modal.style.color = '#e3e3e3';
      }

      // Title & Info
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
      textarea.style.cssText = "width: 100%; min-height: 200px; margin-bottom: 16px; background: transparent; color: inherit; border: 1px solid #ccc; border-radius: 8px; padding: 8px;";
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
      const leadingActions = document.querySelector('.leading-actions-wrapper');
      if (!leadingActions) return;

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

      leadingActions.insertBefore(btn, leadingActions.firstChild);
      updateButtonState();
    }

    // --- State Management for SPA Navigation ---
    let lastPath = globalThis.location.pathname;

    // Observer handles dynamic loading AND button state updates on navigation
    const observer = new MutationObserver(() => {
      // 1. Ensure button exists
      if (!document.querySelector(`.${BUTTON_CLASS}`)) addButton();

      // 2. Check if path changed (user switched Gem), update button style
      if (globalThis.location.pathname !== lastPath) {
        lastPath = globalThis.location.pathname;
        updateButtonState();
      }
    });

    observer.observe(document.body, {childList: true, subtree: true});

    setTimeout(addButton, 500);
    setTimeout(addButton, 1500);
    setTimeout(addButton, 3000);
  }

})();