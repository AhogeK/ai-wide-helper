// ==UserScript==
// @name         AI 宽屏助手 (Perplexity & Gemini)
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Perplexity: 宽屏 + 中文字体 + 模型标签 + 设置弹窗增强 + 自动跟在请求后的回答规则；Gemini: 宽屏
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
    /* Enlarge the entire settings modal container */
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

    /* Ensure the textarea container adapts to content */
    div[data-test-id="answer-instructions-input"] .relative.flex.items-center {
      min-height: 350px !important;
    }

    /* Improve textarea wrapper layout */
    div[data-test-id="answer-instructions-input"] div[class*="w-full"][class*="focus:ring-subtler"] {
      min-height: 350px !important;
      align-items: flex-start !important;
    }

    /* Ensure proper spacing in modal content area */
    div[class*="px-md"][class*="pb-md"][class*="flex"][class*="min-h-0"]
    > div[class*="grow"][class*="flex-col"][class*="p-sm"] {
      padding-top: 1.5rem !important;
      padding-bottom: 1.5rem !important;
    }

    /* Optimize modal scroll behavior */
    div.bg-base.shadow-md.overflow-y-auto.scrollbar-subtle {
      overflow-y: auto !important;
      scrollbar-width: thin !important;
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
      background: rgba(255, 255, 255, 0.04);
      color: rgba(255, 255, 255, 0.75);
      border: 1px solid rgba(255, 255, 255, 0.08);
      white-space: nowrap;
    }
  `;
    document.head.appendChild(style);

    const NON_MODEL_LABELS = new Set(['Share', 'Export', 'Rewrite', 'Helpful', 'Not helpful', 'Copy', 'More actions']);

    function isModelLabel(label) {
      if (!label) return false;
      if (NON_MODEL_LABELS.has(label)) return false;
      // Fixed: Added 'grok' to support Grok models
      return /gpt|gemini|claude|llama|sonnet|opus|haiku|grok/i.test(label);
    }

    function enhanceModelButtons(root = document) {
      const buttons = root.querySelectorAll('button[aria-label]');
      buttons.forEach(button => {
        if (button.dataset.modelLabelInjected === '1') return;
        const label = button.getAttribute('aria-label') || '';
        if (!isModelLabel(label)) return;
        const cls = button.className || '';
        if (!cls.includes('h-8') || !cls.includes('aspect-square')) return;
        button.dataset.modelLabelInjected = '1';
        const span = document.createElement('span');
        span.className = MODEL_LABEL_CLASS;
        span.textContent = label;
        const container = button.closest('span') || button;
        container.insertAdjacentElement('afterend', span);
      });
    }

    setTimeout(() => enhanceModelButtons(), 500);

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return;
          enhanceModelButtons(node);
        });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ============================================================
  // 5. Main Injection Logic (Updated for Gemini Chat Detection)
  // ============================================================
  const host = window.location.hostname;
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
      const path = window.location.pathname;
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
          // console.log('宽屏模式: 已启用 (Chat Detected)');
        }
      } else {
        // If not in chat (home page, settings, etc.), clear the CSS
        if (styleElement.textContent !== '') {
          styleElement.textContent = '';
          // console.log('宽屏模式: 已禁用 (Home/Menu)');
        }
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

    observer.observe(document.head, { childList: true });
    observer.observe(document.body, { childList: true, subtree: true });

    // Listen to history events just in case
    window.addEventListener('popstate', updateGeminiStyles);
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
      const urlMatch = window.location.pathname.match(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/);
      if (urlMatch) {
        return urlMatch[1];
      }

      // 方法2: 从 DOM 中查找 Space 链接
      const spaceLink = document.querySelector('a[href*="/spaces/"]');
      if (spaceLink) {
        const href = spaceLink.getAttribute('href');
        // 同样修复 DOM 查找的正则
        const hrefMatch = href.match(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/);
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

    // 规范化规则格式
    function normalizeRules(rules) {
      if (!rules || !rules.trim()) {
        return '';
      }

      // 移除可能已存在的"回答规则"和分隔线
      let normalized = rules
          .replace(/^回答规则\s*\n?---\s*\n?/m, '')
          .replace(/\n?---\s*$/m, '')
          .trim();

      // 如果内容为空，返回空字符串
      if (!normalized) {
        return '';
      }

      // 添加标准格式
      return `---\n回答规则：\n${normalized}\n---`;
    }

    // 获取规则（返回标准格式）
    function getRules() {
      try {
        const stored = localStorage.getItem(getStorageKey()) || '';
        return normalizeRules(stored);
      } catch (e) {
        console.error('Failed to get rules:', e);
        return '';
      }
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

// === 立即安装拦截器 ===
    (function installInterceptor() {
      const originalFetch = window.fetch;

      window.fetch = function(...args) {
        let [url, options] = args;

        let urlString = '';
        if (typeof url === 'string') {
          urlString = url;
        } else if (url && url.href) {
          urlString = url.href;
        } else if (url && url.toString) {
          urlString = url.toString();
        }

        if (options && options.method === 'POST' &&
            urlString.includes('perplexity_ask') &&
            options.body && typeof options.body === 'string') {

          try {
            const bodyObj = JSON.parse(options.body);

            // ▼▼▼▼▼▼▼▼▼▼▼▼ 在这里添加这行代码 ▼▼▼▼▼▼▼▼▼▼▼▼
            // 强制修改 source 参数
            bodyObj.params.source = 'ios';// 可以改为 'android', 'ios', 或者 'mobile'
            // ▲▲▲▲▲▲▲▲▲▲▲▲ 添加结束 ▲▲▲▲▲▲▲▲▲▲▲▲

            if (bodyObj.query_str) {
              const rules = getRules(); // 获取带格式的规则

              if (rules) {
                // 移除旧规则（如果存在）
                // 匹配格式：---\n回答规则：\n...内容...\n---
                const rulePattern = /---\s*\n回答规则：\s*\n[\s\S]*?\n---/g;

                // 清理 query_str 中的旧规则
                let cleanedQueryStr = bodyObj.query_str.replace(rulePattern, '').trim();

                // 添加新规则到底部
                bodyObj.query_str = `${cleanedQueryStr}\n\n${rules}`;

                // 同时处理 params.dsl_query
                if (bodyObj.params && bodyObj.params.dsl_query) {
                  let cleanedDslQuery = bodyObj.params.dsl_query.replace(rulePattern, '').trim();
                  bodyObj.params.dsl_query = `${cleanedDslQuery}\n\n${rules}`;
                }

                options.body = JSON.stringify(bodyObj);

                console.log('✅ 规则已更新并注入到查询底部');
              }
            }
          } catch (e) {
            console.error('❌ 拦截器处理失败:', e);
          }
        }

        return originalFetch.apply(this, args);
      };

      console.log('✅ Fetch 拦截器已安装');
    })();

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
      button.setAttribute('data-state', 'closed');

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
      if (attachButton && attachButton.parentElement) {
        attachButton.parentElement.parentElement.insertBefore(button, attachButton.parentElement);
      } else {
        const firstChild = toolbarContainer.firstElementChild;
        if (firstChild && firstChild.nextElementSibling) {
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

    new MutationObserver(checkChanges).observe(document, { subtree: true, childList: true });

    // 监听 DOM 变化以重新添加按钮
    const observer = new MutationObserver(() => {
      addRulesButton();
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }


})();