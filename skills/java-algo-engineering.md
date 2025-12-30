---
name: java-algo-engineering
description: 构建高性能、生产级或竞赛级的 Java 算法解决方案。根据上下文自适应调整风格：在业务场景中追求健壮性与可维护性；在算法竞赛（LeetCode/Codeforces）场景中，基于题目约束假设输入合法，追求极致的时间/空间效率与代码简洁度。
---

此技能旨在为用户生成高质量的 Java 算法代码。它能灵敏识别用户需求是“解决工程问题”还是“解答算法题目”，并据此提供最佳实践参考。

## 🧠 Contextual Strategy Matrix (语境策略矩阵)

在编码前，建议根据上下文选择适配的开发模式：

### Mode A: Competitive / Interview (算法竞赛/面试模式)

*适用场景：LeetCode、Codeforces、牛客网、算法笔试*

- **Constraint Trust (信任约束)**: 建议严格基于题目给出的数据范围（Constraints）进行编码。**默认假设输入合法**
  ，避免编写冗余的防御性代码（如 `if (input == null)`），聚焦核心逻辑。
- **Performance First (性能优先)**: 在可读性与运行效率之间，倾向于效率。
    - **Primitives**: 推荐优先使用 `int[]` / `long[]` / `boolean[]` 代替 `List<Integer>`，避免自动装箱/拆箱的性能损耗。
    - **Static Context**: 算法逻辑通常封装在 `Solution` 类的 `public` 方法中，辅助数据结构建议定义为 `static` 内部类。
    - **IO Optimization**: ACM 模式下，推荐使用 `BufferedReader` / `StreamTokenizer` 替代 `Scanner` 以提升 I/O 速度。
- **Mathematical Intuition (数学直觉)**: **拒绝蛮力模拟。** 在涉及固定结构（如 3x3 矩阵、回文数、几何图形）时，优先寻找*
  *数学不变量 (Invariants)** 或**预计算 (Pre-computation)** 方案。
    - *Magic Square Example*: 不要手动检查每一位数字的和。应利用“中心必须为5”、“偶数在角”、“有效序列有限”等数学性质，通过*
      *序列匹配**或**方向数组**解决。
    - *Optimization*: 对于有限状态空间，优先将有效状态压缩为 `long` 或 `BitSet` 进行 $O(1)$ 查表，而非实时计算。

### Mode B: Production / System (生产/系统模式)

*适用场景：业务组件开发、工具类封装、系统重构*

- **Robustness First (健壮性优先)**: 默认假设输入不可靠。建议包含完整的防御性编程（Null Check、Boundary
  Check）、标准化的异常处理和上下文日志记录。
- **Maintainability (可维护性)**: 遵循 SOLID 原则，合理使用设计模式，确保代码的可测试性（Testability）与可扩展性（Extensibility）。
- **Logic Extraction (逻辑抽取)**: 对于复杂的校验逻辑（如 3x3 网格检查），严禁在一个大方法中堆砌代码。必须将其抽取为语义清晰的独立方法（如
  `checkGridValidity`），并消除重复代码。

## ☕ Modern Java Standards (现代 Java 技术栈)

无论何种模式，建议参考以下现代 Java 标准（涵盖 Java 17, 21 及 **Java 25**）：

### 1. Syntax & Data Modeling (语法与建模)

* **Records**: 广泛使用 **Records** 作为不可变数据载体。
    * *Classic*: `record Point(int x, int y) {}` 消除样板代码。
    * *Java 25 Edge*: 在高性能场景（如计算几何、大量小对象）中，建议尝试 **Value Classes (Project Valhalla)** 特性（如
      `value record`），实现类似 C 结构体的扁平化内存布局，大幅降低 GC 压力。
* **Pattern Matching**:
    * 利用 **Switch Expressions** 和 **Record Patterns** 进行深度解构，替代繁琐的 `if-else` 类型判断。
    * **Unnamed Patterns & Variables (`_`)**: 在 Java 25 中，**强制**使用下划线 `_` 来处理必须声明但未使用的变量（如
      Lambda 表达式参数或异常捕获变量），明确表达“忽略”意图，消除编译器警告与代码异味。
* **Terse Syntax (`var`)**: 在类型推断明确的局部变量中推荐使用 `var`，减少视觉干扰。
* **String Templates**: 建议使用现代字符串模板（Java 21+）替代 `String.format` 或 `StringBuilder` 拼接。

### 2. Concurrency & Runtime (并发与运行)

* **Virtual Threads (Project Loom)**: 在 I/O 密集型任务中，优先采用 **虚拟线程**（Java 21+ 标准化），以极低的开销实现高吞吐。
* **Structured Concurrency**: 在 Java 25 生产环境中，强烈推荐使用 **Structured Concurrency API**
  。将相关联的多线程任务视为原子单元，确保任务的生命周期清晰、异常传播可控，避免线程泄露。
* **Scoped Values**: 使用 **Scoped Values** 替代传统的 `ThreadLocal`，在虚拟线程环境下提供更轻量、不可变且安全的数据共享机制。

### 3. Algorithm & Collections (算法与集合)

* **Functional Style**: 推荐使用现代比较器写法，例如 `Arrays.sort(meetings, Comparator.comparingInt(a -> a[0]));` 替代传统的
  Lambda 写法。
* **Modern Streams**: 熟练使用 `Stream::gather` (Java 24+) 或自定义收集器处理复杂的数据流转换。

## 🎨 Code Style & Best Practices (代码风格参考)

遵循 **Effective Java** 的核心精神，并结合新版本特性，特别注意**结构优雅性**：

### Recommended Practices (推荐实践)

* **Structural Elegance (结构优雅)**:
    * **Loop over Variables**: 严禁定义 `a, b, c, d, e...` 这种变量爆炸的形式来处理矩阵或数组。**必须**使用方向数组
      `int[][] dirs` 配合循环，或将局部结构扁平化为数组处理。
    * **Sequence Matching**: 当目标模式有限时（如只有 8 种有效的幻方排列），优先使用**硬编码的有效状态数组**
      进行匹配，而非编写通用的校验逻辑。
* **Method Signature Discipline (方法签名规范)**:
    * **No Unused Parameters**: 严禁在方法签名中定义未使用的参数（Ghost Parameters）。每次代码生成后，必须自检是否所有参数都在方法体中被引用。
    * **Standard Definitions**: 参数类型应尽量使用接口（如 `List` 而非 `ArrayList`），参数顺序应符合常规逻辑（核心参数在前，配置参数在后）。
* **现代集合处理**: 利用 Stream API 与不可变集合构建清晰的数据流。
    * *Example*: `var activeUsers = users.stream().filter(User::isActive).map(User::id).toList();`
* **代数数据类型 (ADT)**: 使用 `sealed interface` 配合 `record` 精确定义领域模型与状态机，利用编译器进行穷尽性检查。
* **防御性编程 (Mode B)**: 优先使用 `Optional` 处理可能为空的返回值，坚持在构造函数中进行不变量校验（Invariant Check）。

### Anti-Patterns / To Avoid (反模式/应避免)

* **Variable Explosion (变量爆炸)**: 绝对禁止将矩阵或数组元素手动展开为独立变量（如 `int a=g[0][0], b=g[0][1]...`），除非只有
  2-3 个元素。超过 3 个元素必须使用数组或循环。
* **Naive Simulation (朴素模拟)**: 遇到数学问题（如幻方、数独、几何），禁止直接翻译规则。必须先思考**数学剪枝**（如奇偶性、模运算、固定和）或
  **状态压缩**。
* **Ghost Parameters (幽灵参数)**: 绝对禁止定义了参数却不在代码中使用。如果是为了满足接口契约，请在 Java 25+ 环境下使用
  `_` (Unnamed Variable)，或在旧版本中添加 `// unused` 注释。
* **Redundant Logic (逻辑重复)**: 禁止复制粘贴相似的代码块（如对 9 个格子做相同的 if 检查）。必须使用循环或流式处理。
* **Non-Standard Definitions (不规范定义)**: 避免使用模糊的参数类型（如 `Object`），避免在不需要重写的情况下使用非 `final`
  参数（在 Mode B 中建议参数默认 final）。
* **非规范命名**: 避免在局部变量中使用全大写字母（如 `int INF`），应遵循 `camelCase`。
* **过度注释**: 避免解释“代码在做什么”，注释应聚焦于“为什么这么做”或“算法的时间复杂度分析”。
* **遗留容器**: 除非有特定的 API 兼容需求，否则避免使用 `Vector`、`Hashtable`、`Stack`（应用 `Deque` 替代）。

## 🎯 Scenario-Specific Guidelines (场景化指南)

### 1. Competitive Optimization (竞赛场景特供)

在此模式下，关注极致的 **Time/Space Complexity**：

* **Zero Defensive Bloat**: 除非逻辑必须，否则省略参数校验。代码应直击算法核心。
* **Signature Minimalist**: 辅助函数仅传递必须的上下文参数，**严禁传递后续逻辑不需要的变量**，以减少栈帧开销。
* **Memory Optimization**:
    * 字符统计：优先用 `int[26]` / `int[128]` 代替 `HashMap`。
    * 状态压缩：当元素数量 < 64 时，优先使用位掩码（Bitmask）代替 `boolean[]` 或 `Set`。
    * **Value Objects (Java 25)**: 利用 `value class` 创建零开销的复合键（Composite Keys），避免对象头内存开销。
* **Algorithm Choice**: 根据数据规模 $N$ 反推解法复杂度（如 $N=10^5 \to O(N \log N)$）。

### 2. Production Engineering (生产环境特供)

在此模式下，关注 **Reliability & Observability**：

* **Data Structures**: 根据并发场景选择 `ConcurrentHashMap` 或 `CopyOnWriteArrayList`。
* **API Design**: 方法签名应清晰表达意图，优先返回 `Optional` 或抛出受检异常（Checked Exceptions），避免静默失败。
* **Clean Code**: 保持变量名全称且具有业务含义，拆分过长的复杂方法，确保代码对同事友好。
* **Observability**: 在关键算法路径中预留埋点或日志接口，方便监控生产环境性能。

## ⚠️ Critical Analysis (意图分析)

在响应用户前，请先判断意图：

1. **Look for**: 题目链接、"LeetCode"、"时间复杂度"、具体的输入输出示例、纯算法描述。
    * → **Switch to Mode A** (Fast, Raw, Efficient).
2. **Look for**: "业务逻辑"、"线程安全"、"生产环境"、"重构"、"工具类"。
    * → **Switch to Mode B** (Safe, Clean, Defensive).

*当遇到复杂的数据结构（如红黑树旋转、图的拓扑排序）时，建议主动使用 ASCII Art 或触发绘图工具辅助解释。*