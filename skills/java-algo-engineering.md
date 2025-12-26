---
name: java-algo-engineering
description: 构建高性能、生产级、健壮的 Java 算法解决方案。当用户要求解决复杂算法问题、优化系统性能、设计高并发模型或重构核心业务逻辑时使用此技能。生成代码应超越“LeetCode 刷题风格”，追求“Effective Java”标准的工程美学与极致性能。
---

此技能指导创建卓越的、生产级的 Java 算法实现，避免平庸的“初学者风格”或通过堆砌代码实现的低效逻辑。交付的代码必须在性能、可读性与健壮性之间取得完美平衡。

用户提供算法需求：一个具体的问题、性能瓶颈、数据处理流程或系统组件。他们可能提供数据规模、并发要求或内存限制等上下文。

## Engineering Thinking (工程思维)

在编码之前，深入理解上下文并确定明确的**技术架构方向**：

- **Purpose (目标)**: 核心挑战是什么？是极低延迟（Low Latency）、高吞吐量（High Throughput）、还是内存敏感（Memory Efficient）？
- **Architecture Style (架构风格)**: 选择一种极致的工程风格：
    - **Zero-GC / Low-Latency**: 避免对象分配，使用原生数组，重用对象池，针对高频交易或实时系统。
    - **Functional / Stream-lined**: 充分利用 Java Stream API 和 Lambda，追求代码的声明式优雅与并行处理能力（适用于数据处理）。
    - **Concurrent / Non-blocking**: 使用 `CompletableFuture`、Virtual Threads (Project Loom) 或响应式编程，最大化 CPU
      利用率。
    - **Robust / Enterprise**: 严格的 OOP 设计，完善的异常处理，防御性编程，符合领域驱动设计 (DDD) 战术模式。
- **Constraints (约束)**: JVM 版本（LTS 17/21+），堆内存大小，Big-O 时间/空间复杂度硬性限制。
- **Differentiation (差异化)**: 为什么这个实现是“专家级”的？使用了位运算优化？自定义了数据结构？还是利用了底层的并发原语？

**CRITICAL**: 拒绝平庸。代码不仅仅是为了得出正确答案，更是为了展示对 JVM 机制、内存模型和算法效率的深刻理解。

然后实现可工作的代码（Java 17/21+），必须做到：

- **Production-grade**: 包含必要的输入校验、异常处理和日志记录（模拟）。
- **Performant**: 经过思考的时间/空间复杂度优化。
- **Idiomatic**: 符合现代 Java 最佳实践（Effective Java）。
- **Readable**: 变量命名语义化，关键逻辑有高价值注释。

## Java Engineering Guidelines (Java 工程准则)

重点关注：

- **Data Structures & Collections (数据结构与集合)**:
    - 拒绝无脑使用 `ArrayList` 和 `HashMap`。根据场景选择合适的数据结构。
    - 需要频繁查找且内存受限？考虑 `BitSet` 或优化的 Trie。
    - 需要并发？使用 `ConcurrentHashMap`，`CopyOnWriteArrayList` 或 `BlockingQueue`。
    - 针对原生类型性能敏感？模拟使用原生数组而非装箱类型（`Integer` vs `int`），避免自动装箱带来的开销。

- **Concurrency & Parallelism (并发与并行)**:
    - 避免使用原始的 `synchronized` 块或 `wait/notify`，除非你在编写底层库。
    - 优先使用 `java.util.concurrent` 包：`ReentrantLock`, `ReadWriteLock`, `StampedLock` (用于读多写少的高性能场景)。
    - 利用现代并发工具：`CompletableFuture` 编排异步任务，Virtual Threads (虚拟线程) 处理高并发 I/O。
    - 确保线程安全（Thread Safety）和原子性（Atomicity），警惕可见性问题（volatile）。

- **Modern Java Idioms (现代 Java 惯用语)**:
    - 使用 **Records** (Java 14+) 作为不可变的数据载体 (DTOs)。
    - 使用 **Pattern Matching** (instanceof, switch) 简化逻辑。
    - 使用 **var** 减少样板代码，但不能牺牲可读性。
    - 使用 **Optional** 优雅地处理空值，杜绝 `NullPointerException`。

- **Complexity & Optimization (复杂度与优化)**:
    - 明确算法的时间复杂度（Time Complexity）和空间复杂度（Space Complexity）。
    - 在循环内部避免昂贵的操作（如对象创建、IO 操作）。
    - 对于大规模数据，利用 **Stream API** 的 `parallel()` 能力，但要清楚其 ForkJoinPool 的开销。
    - 运用位运算（Bit Manipulation）技巧解决特定数学或状态压缩问题。

- **Clean Code & Design (整洁代码与设计)**:
    - **SOLID 原则**: 类和方法职责单一。
    - **Immutability (不可变性)**: 默认创建不可变对象，提升线程安全性。
    - **Defensive Programming (防御性编程)**: 即使是算法题，也要检查边界条件（Boundary Conditions）和非法输入。

**NEVER (绝对避免)**:

- 避免“学生气”的变量命名（`a`, `b`, `tmp`, `flag`），除非是极其标准的数学公式。
- 避免使用过时的类（`Vector`, `Hashtable`, `Date`, `StringBuffer`）。
- 避免在现代 Java 中写出冗长的 Boilerplate（使用 Lombok 或 Record 代替）。
- 避免吞掉异常（Swallowing exceptions）或打印毫无意义的 `e.printStackTrace()`。
- 避免“面条代码”（Spaghetti Code），将复杂逻辑拆分为辅助方法。

**IMPORTANT**: 匹配实现的复杂度与问题的规模。简单的逻辑使用优雅的 Stream 流式处理；极度敏感的性能热点则回归到底层的原语操作。优雅来自于对工具箱的精准掌控。