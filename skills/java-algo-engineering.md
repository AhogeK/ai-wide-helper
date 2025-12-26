---
name: java-algo-engineering
description: 构建高性能、生产级或竞赛级的 Java 算法解决方案。根据上下文自适应调整风格：在业务场景中追求健壮性与可维护性；在算法竞赛（LeetCode/Codeforces）场景中，基于题目约束假设输入合法，追求极致的时间/空间效率与代码简洁度。
---

此技能用于生成高质量的 Java 算法代码。它能识别用户需求是“解决工程问题”还是“解答算法题目”，并据此调整代码风格。

用户提供需求：可能是复杂的业务算法组件，也可能是具体的 LeetCode/牛客网题目。

## Engineering & Contextual Thinking (工程与语境思维)

在编码前，首先**锁定上下文模式 (Context Mode)** 并据此制定策略：

### Mode A: Competitive / Interview (算法竞赛/面试模式)

*当用户提供 LeetCode/牛客题目或明确询问算法解题时。*

- **Constraint Trust (信任约束)**: 严格基于题目给出的数据范围（Constraints）。**假设输入合法**，绝不编写冗余的
  `if (input == null) throw ...` 等防御性代码，除非题目边缘情况（Edge Cases）未定义。
- **Performance First (性能优先)**: 哪怕牺牲一点可读性，也要换取运行效率。
  - **Primitives**: 强制使用 `int[]` / `long[]` 代替 `List<Integer>`，避免自动装箱。
  - **Static Context**: 算法逻辑通常写在 `Solution` 类的 `public` 方法中，辅助类定义为 `static` 内部类。
  - **IO Optimization**: 如果是 ACM 模式，使用 `BufferedReader` / `StreamTokenizer` 而非 `Scanner`。

### Mode B: Production / System (生产/系统模式)

*当用户要求构建业务组件、工具类或重构现有逻辑时。*

- **Robustness First (健壮性优先)**: 假设输入不可靠。必须包含完整的防御性编程（Null Check、Boundary Check）、异常处理和日志记录。
- **Maintainability (可维护性)**: 遵循 SOLID 原则，使用设计模式，确保代码可测试、可扩展。

## Core Java Guidelines (通用 Java 准则)

无论何种模式，都必须遵守以下现代 Java 标准：

- **Modern Syntax**: 使用 Java 17/21+ 特性。
  - **Records**: 用于数据载体（如 `record Node(int r, int c) {}`），替代繁琐的 POJO。
  - **Var**: 在类型明确时使用 `var` 减少视觉噪声。
  - **Pattern Matching**: 使用 `instanceof` 模式匹配和 Switch 表达式。
- **Concurrency**: 优先使用 `CompletableFuture` 或 Virtual Threads，避免原始的 `wait/notify`。

## Scenario-Specific Guidelines (场景化准则)

### 1. Competitive Optimization (仅限竞赛/刷题场景)

在此模式下，覆盖常规工程规则：

- **Zero Defensive Bloat**: 不要检查 `null`，不要检查数组长度是否为负，除非逻辑需要。代码应当直击核心算法逻辑。
- **Memory Hacks**:
  - 使用 `int[26]` 代替 `HashMap<Character, Integer>` 统计字符。
  - 使用位掩码（Bitmask）代替 `boolean[]` 或 `Set<Integer>`（当元素 < 64 时）。
- **Algorithm Choice**:
  - 根据 $N$ 的规模反推复杂度：$N=10^5 \to O(N \log N)$；$N=10^7 \to O(N)$。
  - 优先使用数组模拟链表/树（Array-based implementation）以减少 GC 开销（针对高难度题目）。

### 2. Production Engineering (仅限生产环境场景)

在此模式下，执行严格工程标准：

- **Data Structures**: 根据并发需求选择 `ConcurrentHashMap` 或 `CopyOnWriteArrayList`。
- **API Design**: 方法签名应设计得当，抛出受检异常（Checked Exceptions）或返回 `Optional`，而不是直接崩溃。
- **Clean Code**: 变量名全称，添加 Javadoc，拆分复杂方法。

## Anti-Patterns (反模式 - 绝对禁止)

- **Generic**: 禁止使用 `System.out.println` 进行调试后保留在代码中。
- **Obsolete**: 禁止使用 `Stack` (用 `Deque`), `Vector`, `Hashtable`。
- **Confusion**: 禁止在非竞赛场景使用单字母变量名（`a`, `b`, `c`）。但在竞赛的数学公式或循环索引中允许使用 `i, j, k, n, m`。
- **Premature Optimization**: 在**生产模式**下，不要为了微小的性能提升而写出极其晦涩的位运算代码，除非有性能测试数据支持。

**IMPORTANT**:
Wait for the user's prompt. **Analyze the intent.**

- If it looks like a competitive problem -> **Switch to Mode A** (Fast, Raw, Trusting Inputs).
- If it looks like a real-world task -> **Switch to Mode B** (Safe, Clean, Defensive).