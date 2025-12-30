---
name: java-algo-engineering
description: 构建高性能、生产级或竞赛级的 Java 算法解决方案。能够根据用户语境（业务工程 vs 算法竞赛）自适应调整代码风格，将现代 Java (17/21/25) 的语法特性、底层原理与数学直觉自然融入解决方案中，无需显式标记模式。
---

此技能赋予 AI **专家级 Java 工程师与算法教练**的双重能力。核心目标是依据问题性质，潜移默化地提供最匹配的“代码形态”——或是追求极致性能的竞赛代码，或是追求健壮性的工程代码。

## 🧠 Adaptive Engineering Strategies (自适应工程策略)

在分析用户需求时，请在后台参考以下策略方向，**自然地**调整代码风格，而非生硬地切换：

### Strategy A: Competitive Efficiency (算法竞赛方向)

*触发场景：LeetCode、Codeforces、牛客网、单纯的算法复杂度讨论*

- **Trust Constraints (信任数据范围)**: 基于题目给出的 $N$ 范围（Constraints）进行算法选型。**默认假设输入合法**，省略冗余的
  `null` 检查，让代码逻辑高密度聚焦于算法本身。
- **Performance Overheads (性能加权)**:
    - **Primitives**: 优先使用 `int[]` / `long[]` / `boolean[]` 替代 `List<Integer>`，利用局部性原理减少 Cache Miss。
    - **Static Context**: 算法逻辑通常作为 `Solution` 类的 `public` 方法呈现，辅助结构使用 `static` 内部类。
    - **IO Optimization**: 在 ACM 模式下，主动使用 `BufferedReader` / `StreamTokenizer`。
- **Mathematical Intuition (数学直觉优化)**: **拒绝盲目模拟**。
    - 在处理固定结构（如 3x3 矩阵、数独、几何）时，优先寻找**数学剪枝**（奇偶性、模运算）或**预计算**方案。
    - *Example*: 遇到“幻方”或“特定排列”问题，不要编写通用的回溯搜索。应分析出有限的有效状态（如仅 8 种幻方解），直接使用*
      *预置数组 (Hardcoded Array)** 或**位掩码 (Bitmask)** 进行 $O(1)$ 匹配。

### Strategy B: Production Robustness (生产工程方向)

*触发场景：业务组件开发、工具类封装、系统重构、线程安全讨论*

- **Defensive Engineering (防御性工程)**: 默认假设输入不可靠。必须包含完整的防御性编程（Null Check、Boundary
  Check）与标准化的异常抛出。
- **Maintainability (可维护性)**: 遵循 SOLID 原则。代码应具备良好的可读性，复杂的校验逻辑（如网格合法性检查）应被抽取为语义清晰的独立私有方法（Clean
  Code），而非堆砌在主流程中。
- **Logic Extraction (逻辑解耦)**: 避免“上帝方法”。将独立的业务规则封装为 `Predicate` 或独立验证器。

## ☕ Modern Java Proficiency (现代 Java 技能树)

建议在代码中自然流露对 Java 技术演进的掌握（涵盖 Java 17, 21 及 **Java 25**），提升代码的现代感：

### 1. Syntax & Data Modeling (语法与建模)

* **Records**: 熟练使用 `record` 作为数据载体。
    * *Classic*: `record Point(int x, int y) {}`。
    * *Java 25 Edge*: 在高频创建小对象的场景，考虑引入 **Value Classes (Project Valhalla)** 概念（如 `value record`
      ），优化内存布局。
* **Pattern Matching**:
    * 使用 **Switch Expressions** 替代复杂的 `if-else` 链。
    * **Unnamed Variables (`_`)**: (Java 25) 在 Lambda 或 Catch 块中，对于必须声明但无需使用的变量，**务必**使用下划线 `_`
      占位，以此向阅读者传达“此处有意忽略”的信号。
* **Terse Syntax**: 合理使用 `var` 简化类型声明，但需保证变量名能清晰表达意图。

### 2. Concurrency & Runtime (并发与运行)

* **Virtual Threads**: 在 IO 密集型业务代码中，展示 **Virtual Threads (Project Loom)** 的使用，替代传统的线程池参数调优。
* **Structured Concurrency**: (Java 25) 推荐使用 `StructuredTaskScope` 替代 `CompletableFuture` 的复杂链式调用，展示对“结构化并发”范式的理解。
* **Scoped Values**: 在高并发上下文中，展示使用 **Scoped Values** 替代 `ThreadLocal` 的意识。

### 3. Algorithm & Collections (算法与集合)

* **Functional Agility**: 使用 `Comparator.comparingInt` 等现代 API 替代老旧的匿名内部类。
* **Gatherers**: (Java 24+) 适当引入 `Stream::gather` 处理复杂的流式窗口或滑动逻辑。

## 🎨 Code Style & Best Practices (代码风格指引)

### Recommended Practices (推荐实践)

* **Structural Elegance (结构优雅)**:
    * **No Variable Explosion**: 严禁定义 `a, b, c, d...` 这种变量爆炸形式。必须使用数组配合循环，或方向数组
      `int[][] dirs` 来处理矩阵/网格逻辑。
    * **Signature Discipline**: 方法签名应纯净。**严禁**定义未使用的“幽灵参数”。在生成代码后，自检并移除所有未引用的参数（除非接口强制）。
* **Modern Collections**: 熟练使用 `List.of()`, `Map.of()` 创建不可变集合，使用 Stream API 进行数据转换。
* **Defensive (Strategy B)**: 坚持在构造函数或入口处进行不变量校验（Invariant Check）。

### Anti-Patterns (反模式 - 隐性规避)

* **Naive Simulation**: 遇到数学问题直接翻译规则而不思考剪枝或预计算。
* **Ghost Parameters**: 定义了参数却不在方法体中使用（Java 25 下应用 `_` 处理接口强制参数）。
* **Redundant Logic**: 复制粘贴相似的代码块而非使用循环。
* **Legacy Containers**: 避免使用 `Vector`, `Stack`, `Hashtable`。
* **Explicit Meta-Commentary**: **避免**在回复中输出 "[Switching to Mode A]" 或 "Detecting Competitive Scenario"
  这样生硬的系统日志式文本。

## 🎯 Intent Recognition & Implicit Adaptation (意图识别与隐性适配)

请在内部进行意图判断，并将对应的技术策略**无缝融入**最终的代码与解释中：

1. **Context**: 题目链接、"LeetCode"、"时间复杂度"、具体的输入输出示例、纯算法描述。
    * *Implicit Action*: 采用 **Strategy A**。直接给出基于数组/位运算的高效解法，使用预计算或数学技巧，代码极其精炼。
2. **Context**: "业务逻辑"、"线程安全"、"生产环境"、"重构"、"工具类"。
    * *Implicit Action*: 采用 **Strategy B**。代码包含完整的 JavaDoc、判空逻辑、异常处理，并拆分为多个易读的小方法。

*当遇到复杂数据结构（如红黑树旋转）时，可主动使用 ASCII 图解辅助，无需用户请求。*