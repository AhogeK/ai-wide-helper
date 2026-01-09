// ==UserScript==
// @name         AI 宽屏助手 (Perplexity & Gemini)
// @namespace    http://tampermonkey.net/
// @version      1.2.0
// @description  Perplexity: 宽屏 + 中文字体 + 模型标签 + 设置弹窗增强 + 自动跟在请求后的回答规则 + 取消tab间的模型同步；Gemini: 宽屏 - 自动跟在请求后的回答规则
// @author       AhogeK
// @match        https://www.perplexity.ai/*
// @match        https://gemini.google.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=perplexity.ai
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
  'use strict';

  // ============================================================
  // 0. CSS Constants (Global Scope)
  // ============================================================
  const MAX_WIDTH = '1600px';
  const USER_BUBBLE_WIDTH = '760px';

  const perplexityCSS = `
    /* === Fonts === */
    body, html, .font-sans, .prose {
      font-family: "Söhne", "Söhne Circle", "Söhne Breit", "Söhne Mono", "Google Sans", "Roboto", sans-serif !important;
    }

    /* === Widescreen === */
    .max-w-threadContentWidth, .max-w-3xl, .max-w-4xl, .max-w-5xl, .max-w-6xl {
      width: auto !important; max-width: 95% !important;
    }
    @media (min-width: 1280px) {
      .max-w-threadContentWidth, .max-w-3xl, .max-w-4xl, .max-w-5xl, .max-w-6xl {
        max-width: ${MAX_WIDTH} !important;
      }
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
    div.bottom-md.right-md.fixed > div.flex { flex-direction: row !important; }
  `;

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
  `;


  // ============================================================
  // 1. Helper Functions (Hoisted to Outer Scope)
  // ============================================================

  function forceGeminiRightAlign() {
    const queryContents = document.querySelectorAll('user-query-content.user-query-container');
    queryContents.forEach(el => {
      if (el.style.display !== 'block' || el.style.width !== '100%') {
        el.style.setProperty('display', 'block', 'important');
        el.style.setProperty('width', '100%', 'important');
        el.style.removeProperty('flex-direction');
        el.style.removeProperty('justify-content');
        el.style.removeProperty('align-items');
      }
      const bubble = el.querySelector('.user-query-bubble-container');
      if (bubble) {
        if (bubble.style.float !== 'right') {
          bubble.style.setProperty('float', 'right', 'important');
          bubble.style.setProperty('max-width', USER_BUBBLE_WIDTH, 'important');
          bubble.style.setProperty('display', 'block', 'important');
          bubble.style.setProperty('text-align', 'left', 'important');
          bubble.style.setProperty('margin-left', '0', 'important');
          bubble.style.setProperty('margin-right', '0', 'important');
          bubble.style.removeProperty('width');
          bubble.style.removeProperty('flex');
        }
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

  function setupPerplexityModelLabels() {
    const MODEL_LABEL_CLASS = 'pplx-inline-model-label';
    const style = document.createElement('style');
    style.textContent = `
      .${MODEL_LABEL_CLASS} {
        margin-left: 6px; padding: 0 8px; border-radius: 999px; font-size: 12px; line-height: 20px; height: 20px;
        display: inline-flex; align-items: center; justify-content: center; white-space: nowrap;
        background: rgba(0, 0, 0, 0.05); color: rgba(0, 0, 0, 0.65); border: 1px solid rgba(0, 0, 0, 0.1);
      }
      html.dark .${MODEL_LABEL_CLASS}, body.dark .${MODEL_LABEL_CLASS}, html[data-color-scheme="dark"] .${MODEL_LABEL_CLASS}, [data-theme="dark"] .${MODEL_LABEL_CLASS} {
        background: rgba(255, 255, 255, 0.04) !important; color: rgba(255, 255, 255, 0.85) !important; border: 1px solid rgba(255, 255, 255, 0.1) !important;
      }
    `;
    document.head.appendChild(style);

    const NON_MODEL_LABELS = new Set(['Share', 'Export', 'Rewrite', 'Helpful', 'Not helpful', 'Copy', 'More actions']);

    function isModelLabel(label) {
      if (!label) return false;
      if (NON_MODEL_LABELS.has(label)) return false;
      return /gpt|gemini|claude|llama|sonnet|opus|haiku|grok|o1|o3/i.test(label);
    }

    function enhanceModelButtons(root = document) {
      const footerButtons = root.querySelectorAll('.bottom-md.right-md.fixed button[aria-label]');
      footerButtons.forEach(btn => btn.removeAttribute('aria-label'));
      const buttons = root.querySelectorAll('button[aria-label]');
      buttons.forEach(button => {
        if (button.dataset.modelLabelInjected === '1') return;
        const label = button.getAttribute('aria-label') || '';
        if (label === 'Language' || label === 'Help menu' || label === 'Change language') {
          button.removeAttribute('aria-label');
          return;
        }
        if (!isModelLabel(label)) return;
        const cls = button.className || '';
        if (!cls.includes('h-8') || !cls.includes('aspect-square')) return;
        button.dataset.modelLabelInjected = '1';
        const span = document.createElement('span');
        span.className = MODEL_LABEL_CLASS;
        span.textContent = label;
        const container = button.closest('span') || button;
        container.after(span);
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
    observer.observe(document.body, {childList: true, subtree: true});
  }

  function setupAnswerRules() {
    const RULES_STORAGE_PREFIX = 'pplx_answer_rules_';
    const BUTTON_CLASS = 'pplx-rules-button';
    const MODAL_ID = 'pplx-rules-modal';
    const DARK_MODE_CLASS = 'pplx-dark-mode';

    function getCurrentSpaceId() {
      const urlMatch = new RegExp(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/).exec(globalThis.location.pathname);
      if (urlMatch) return urlMatch[1];
      const spaceLink = document.querySelector('a[href*="/spaces/"]');
      if (spaceLink) {
        const href = spaceLink.getAttribute('href');
        const hrefMatch = new RegExp(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/).exec(href);
        if (hrefMatch) return hrefMatch[1];
      }
      return 'default';
    }

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
        if (firstChild?.nextElementSibling) toolbarContainer.insertBefore(button, firstChild.nextElementSibling);
      }
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
    new MutationObserver(checkChanges).observe(document, {subtree: true, childList: true});
    new MutationObserver(() => addRulesButton()).observe(document.body, {childList: true, subtree: true});
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
        maxWidth: '600px',
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
    const observer = new MutationObserver(() => {
      if (!document.querySelector(`.${BUTTON_CLASS}`)) addButton();
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


  // ============================================================
  // 2. Immediate Logic (Network Interceptor, Isolation, CSS Injection)
  // ============================================================

  // 2.1 Perplexity Tab Isolation
  if (globalThis.location.hostname.includes('perplexity.ai')) {
    setupPerplexityPerTabModelIsolation();
  }

  function setupPerplexityPerTabModelIsolation() {
    const TARGET_KEYS = [
      'pplx.local-user-settings.preferredSearchModels',
      'pplx.local-user-settings.preferredSearchModels-v1',
    ];
    const targetSet = new Set(TARGET_KEYS);
    const TAB_ID_KEY = '__pplx_tab_id__';
    const tabId = sessionStorage.getItem(TAB_ID_KEY) || crypto.randomUUID();
    sessionStorage.setItem(TAB_ID_KEY, tabId);
    const ssKey = (k) => `__pplx_tab_${tabId}__${k}`;

    for (const k of TARGET_KEYS) {
      const exists = sessionStorage.getItem(ssKey(k));
      if (exists == null) {
        const v = localStorage.getItem(k);
        if (v != null) sessionStorage.setItem(ssKey(k), v);
      }
    }
    const originalSetItem = Storage.prototype.setItem;
    const originalGetItem = Storage.prototype.getItem;
    const originalRemoveItem = Storage.prototype.removeItem;

    Storage.prototype.setItem = function (key, value) {
      const k = String(key);
      if (this === localStorage && targetSet.has(k)) {
        sessionStorage.setItem(ssKey(k), String(value));
        return;
      }
      return originalSetItem.call(this, key, value);
    };
    Storage.prototype.getItem = function (key) {
      const k = String(key);
      if (this === localStorage && targetSet.has(k)) {
        const v = sessionStorage.getItem(ssKey(k));
        if (v != null) return v;
      }
      return originalGetItem.call(this, key);
    };
    Storage.prototype.removeItem = function (key) {
      const k = String(key);
      if (this === localStorage && targetSet.has(k)) {
        sessionStorage.removeItem(ssKey(k));
        return;
      }
      return originalRemoveItem.call(this, key);
    };
    globalThis.addEventListener('storage', (e) => {
      const k = e?.key;
      if (e?.storageArea === localStorage && typeof k === 'string' && targetSet.has(k)) {
        e.stopImmediatePropagation();
      }
    }, true);
  }

  // 2.2 Global Network Interceptor
  (function installNetworkInterceptor() {
    console.log('[AI Widescreen] Initializing Unified Network Interceptor...');
    const originalFetch = globalThis.fetch;
    const originalXhrOpen = XMLHttpRequest.prototype.open;
    const originalXhrSend = XMLHttpRequest.prototype.send;

    function getPerplexitySpaceId() {
      const urlMatch = new RegExp(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/).exec(globalThis.location.pathname);
      if (urlMatch) return urlMatch[1];
      if (globalThis.location.hostname.includes('perplexity.ai') && document.body) {
        const spaceLink = document.querySelector('a[href*="/spaces/"]');
        const href = spaceLink?.getAttribute('href');
        const hrefMatch = href ? new RegExp(/\/spaces\/.*-([a-zA-Z0-9_.-]+)$/).exec(href) : null;
        if (hrefMatch) return hrefMatch[1];
      }
      return 'default';
    }

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
        const spaceId = getPerplexitySpaceId();
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

    function injectPerplexityBody(bodyObj, formattedRules) {
      const rulePattern = /---\s*\n回答规则「仅执行规则，勿输出讨论规则内容」：\s*\n[\s\S]*?\n---/g;
      const applyRules = (text) => {
        if (!text) return text;
        const cleaned = text.replaceAll(rulePattern, '').trim();
        return `${cleaned}${formattedRules}`;
      };
      if (bodyObj.query_str) bodyObj.query_str = applyRules(bodyObj.query_str);
      if (bodyObj?.params?.dsl_query) bodyObj.params.dsl_query = applyRules(bodyObj.params.dsl_query);
      if (bodyObj.params) bodyObj.params.source = 'ios';
      return bodyObj;
    }

    function getGeminiRules() {
      if (!globalThis.location.hostname.includes('gemini.google.com')) return null;
      try {
        const path = globalThis.location.pathname;
        const gemMatch = new RegExp(/\/gem\/([^/]+)/).exec(path);
        let rawRules = '';
        if (gemMatch?.[1]) rawRules = localStorage.getItem(`gemini_answer_rules_gem_${gemMatch[1]}`) || '';
        if (!rawRules) rawRules = localStorage.getItem('gemini_answer_rules_default') || '';
        if (rawRules.trim()) return formatRules(rawRules);
      } catch (e) {
        console.error('[AI Wide] Gemini Rule Read Error:', e);
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
        console.error('[AI Wide] Gemini Freq Parse Error (benign):', e);
      }
      return null;
    }

    function processGeminiBody(body) {
      const rules = getGeminiRules();
      if (!rules) return null;
      let freq = null, type = 'unknown';
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

    function handlePerplexityFetch(urlStr, init) {
      if (!urlStr.includes('perplexity_ask')) return false;
      if (typeof init.body !== 'string') return false;
      try {
        const rules = getPerplexityRules();
        if (rules) {
          let bodyObj = JSON.parse(init.body);
          bodyObj = injectPerplexityBody(bodyObj, rules);
          init.body = JSON.stringify(bodyObj);
          console.log('[AI Widescreen] Perplexity Rules Injected');
          return true;
        } else {
          let bodyObj = JSON.parse(init.body);
          if (bodyObj.params) {
            bodyObj.params.source = 'ios';
            init.body = JSON.stringify(bodyObj);
          }
        }
      } catch (e) {
        console.error('[AI Wide] PPLX Fetch Handler Error:', e);
      }
      return false;
    }

    globalThis.fetch = async function (input, init) {
      const urlStr = getFetchUrl(input);
      if (init?.method === 'POST' && init.body) {
        if (!handleGeminiFetch(urlStr, init)) handlePerplexityFetch(urlStr, init);
      }
      return originalFetch.call(this, input, init);
    };
    XMLHttpRequest.prototype.open = function (method, url) {
      this._reqUrl = (typeof url === 'string' ? url : url?.toString() || '');
      return originalXhrOpen.apply(this, arguments);
    };
    XMLHttpRequest.prototype.send = function (body) {
      if (this._reqUrl && (this._reqUrl.includes('batchexecute') || this._reqUrl.includes('StreamGenerate'))) {
        if (body) {
          const newBody = processGeminiBody(body);
          if (newBody) return originalXhrSend.call(this, newBody);
        }
      }
      return originalXhrSend.apply(this, arguments);
    };
    console.log('[AI Widescreen] Unified Interceptor Installed.');
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
    console.log('[AI Widescreen] Body ready, initializing UI (Buttons/Modals)...');
    const host = globalThis.location.hostname;

    if (host.includes('perplexity.ai')) {
      setupPerplexityModelLabels();
      setupAnswerRules();
    } else if (host.includes('gemini.google.com')) {
      const isGeminiChat = () => {
        const path = globalThis.location.pathname;
        return /\/app\/[\w-]+/.test(path) || /\/gem\/[\w-]+\/[\w-]+/.test(path);
      };
      setInterval(() => {
        if (isGeminiChat()) forceGeminiRightAlign();
      }, 500);
      const observer = new MutationObserver(() => {
        if (isGeminiChat()) forceGeminiRightAlign();
      });
      observer.observe(document.body, {childList: true, subtree: true});
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