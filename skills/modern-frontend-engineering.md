---
name: modern-frontend-engineering
description: 构建全能、高性能、生产级的现代前端应用。当用户不仅关注界面样式，更关注系统架构、组件设计模式、状态管理、性能优化（Web Vitals）、可访问性（A11y）以及 TypeScript 类型安全时使用此技能。生成代码应具备工程化思维，兼顾用户体验与开发体验。
---

此技能指导创建健壮、可扩展且用户友好的前端应用程序。超越单纯的“切图”和“样式堆砌”，关注现代 Web 开发的核心工程挑战。

用户提供需求：一个功能模块、复杂的交互逻辑、重构任务或完整的应用架构。

## Architectural Thinking (架构思维)

在编写任何代码之前，先确定技术策略：

- **Rendering Strategy (渲染策略)**: 根据内容动态性选择最佳模式。
    - **SSG (Static)**: 营销页、文档（追求极致 TTFB）。
    - **SSR (Server-Side)**: 动态内容、SEO 敏感页面。
    - **CSR (Client-Side)**: 强交互 Dashboard、后台管理系统。
    - **RSC (React Server Components)**: 现代 Next.js 应用，分离服务端与客户端逻辑，减少 Bundle Size。
- **State Management (状态管理)**: 拒绝“一把梭”放入 Redux/Zustand。
    - **Server State**: 使用 TanStack Query (React Query) 或 SWR 管理异步数据（缓存、去重、后台更新）。
    - **URL State**: 将筛选、分页、搜索参数同步到 URL searchParams，确保可分享性。
    - **Local State**: 仅将真正的全局交互状态放入全局 Store。
- **Component Pattern (组件模式)**:
    - **Compound Components**: 提供灵活的 API（如 `<Select><Select.Item/></Select>`）。
    - **Headless UI**: 分离逻辑与视图，使用 Radix UI / Headless UI 等库确保 A11y。
    - **Container/Presentational**: 分离数据获取逻辑与渲染逻辑（如果适用）。

**CRITICAL**: 优先考虑**可维护性**和**用户体验**。代码不仅要跑通，还要处理 Loading 状态、Error 边界、空状态以及网络竞态问题。

然后实现代码（React/Vue/Svelte 等），必须做到：

- **Type-Safe**: 严格的 TypeScript 定义，拒绝 `any`。
- **Accessible**: 语义化 HTML，键盘导航支持，ARIA 属性正确。
- **Performant**: 避免不必要的重渲染，优化资源加载。
- **Scalable**: 目录结构清晰，逻辑复用（Hooks/Composables）。

## Engineering & Implementation Guidelines (工程实施准则)

重点关注：

- **Modern Stack & Syntax**:
    - 全面使用 **TypeScript**。定义清晰的 Interface/Type。利用 Utility Types (`Pick`, `Omit`, `Partial`) 减少重复。
    - 使用现代 ES 特性：Optional Chaining (`?.`), Nullish Coalescing (`??`), Destructuring。
    - CSS 方案：推荐 **Tailwind CSS** 以保持样式原子化和一致性，或使用 CSS Modules / Styled Components 避免全局污染。

- **Performance & Optimization**:
    - **Core Web Vitals**: 关注 LCP (最大内容渲染), CLS (累积布局偏移), INP (交互延迟)。
    - **Code Splitting**: 使用 `React.lazy` 或 `dynamic import` 对非首屏组件进行懒加载。
    - **Asset Optimization**: 图片使用 `<picture>` 或 `next/image` 自动优化格式 (WebP/AVIF) 和尺寸。避免布局抖动 (Layout
      Thrashing)。
    - **Memoization**: 合理使用 `useMemo`, `useCallback`，但不要过度优化。

- **Accessibility (A11y)**:
    - 这里的 A11y 不是锦上添花，而是必须。
    - 所有的交互元素（Button, Link, Input）必须有清晰的 focus 状态。
    - 图片必须有 `alt` 属性，装饰性图片设为 `alt=""`。
    - 使用语义化标签 (`<nav>`, `<main>`, `<article>`, `<aside>`) 而非全是 `<div>`。

- **Data Fetching & Error Handling**:
    - 处理生命周期中的所有状态：`idle`, `loading`, `error`, `success`。
    - 使用 **Error Boundaries** 捕获组件树崩溃，提供降级 UI。
    - 避免“瀑布流请求 (Waterfall Requests)”，尽可能并行请求数据。

- **UX Details**:
    - **Optimistic UI**: 在服务器响应前预先更新 UI，提供即时反馈。
    - **Skeleton Screens**: 使用骨架屏代替单纯的 Loading Spinner，提升感知性能。
    - **Form Validation**: 实时校验 (如 Zod + React Hook Form)，提供清晰的错误提示。

**NEVER (绝对避免)**:

- 避免 `useEffect` 滥用：不要用 Effect 处理本该由 Event Handler 处理的逻辑，或用于派生状态（Derived State）。
- 避免 Prop Drilling（属性透传）：超过 2 层传递考虑 Context 或 Composition。
- 避免巨大的 Bundle：不要引入整个 Lodash，只引入需要的函数。
- 避免忽视移动端体验：Touch 目标大小 (<44px) 和 Hover 状态在移动端的处理。
- 避免硬编码文本：为 i18n（国际化）预留空间。

**IMPORTANT**: 前端工程不仅仅是写页面，而是构建**应用**。代码应展现出对浏览器原理、网络协议和 JavaScript 运行时的深刻理解。