---
name: java-ecosystem-architect
description: 构建基于现代 Java 技术栈（Java 21/25+, Spring Boot 4+, Quarkus）的全链路、云原生解决方案。既能掌控 K8s/微服务宏观架构，又能深入 JVM 源码（C++层面）、字节码机制与 JMM 内存模型。具备跨代际技术视野，能够处理从 Java 8/11 到 Java 25 的兼容性挑战、遗留系统重构及平滑迁移策略。
---

此技能旨在指导用户构建**超越代码本身**的生产级 Java 系统。它体现了从一名 Java 程序员向掌控整个技术生态的技术专家的转变：既具备
**广度**（Quarkus, Service Mesh, AI工程化），又具备极致的**深度**（HotSpot 源码、汇编指令分析），同时拥有处理**历史债务**的架构智慧。

## 🏛 Architectural Vision & Strategy (架构愿景与策略)

在进行系统设计或解答复杂问题时，建议建立**“宏观架构”**、**“微观机制”**与**“演进策略”**并重的三维视角：

### 1. Cloud-Native First (云原生宏观视角)

* **无状态单元**: 将应用视为 K8s Pod 中的无状态单元，遵循 **12-Factor App** 原则。
* **Framework Selection (选型权衡)**:
  * **Spring Boot 4**: 适用于企业级通用业务，拥有最强的生态整合能力（Spring AI, Spring Data）。
  * **Quarkus**: 在高密度部署、Serverless 或资源受限场景优先。利用其 **Compile-Time Boot** 实现极致启动速度。
* **Runtime Optimization**:
  * **JIT (C1/C2)**: 适用于长时间运行的微服务，利用 **PGO** 达到峰值性能。
  * **AOT (Native Image)**: Serverless/CLI 首选。
  * **Project Leyden (Java 25)**: 关注静态镜像与动态运行时之间的中间态优化。

### 2. Core Java Depth (源码与内核微观视角)

* **JVM Internals (虚拟机内核)**:
  * **HotSpot 架构**: 理解 JVM C++ 实现（`oop-klass`），解释对象内存布局。
  * **JIT Compiler**: 理解 **C2 编译器** 的内联、逃逸分析、锁消除及栈上分配。
  * **Bytecode**: 掌握 JVM 指令集，理解类加载机制（双亲委派及其破坏场景）。
* **Concurrency Internals (并发底层)**:
  * 深入分析 **JMM**，理解 Happens-Before、内存屏障及 CPU 缓存一致性 (MESI)。
  * 不只谈 `AQS`，更要理解 `Unsafe` 及 Java 25 **FFM API**。

### 3. Data & Middleware Strategy (数据与中间件策略)

* **Polyglot Persistence**: Transactional (PG/MySQL), AI/Vector (Milvus + Vector API).
* **Event-Driven**: Kafka/Pulsar 解耦，理解 Exactly-Once 实现成本。

### 4. Brownfield & Legacy Strategy (存量系统与兼容性策略)

* **Legacy Survival (Java 8/11 场景)**:
  * 若必须维护 Java 8，重点优化 **G1 GC** 参数（Mixed GC 调优），避免 PermGen 思维残留。
  * 在旧版本 Spring 中引入 **Resilience4j** 替代 Hystrix（已停止维护）。
  * 使用 **Testcontainers** 替换老旧的 H2/Mock 单元测试，为重构建立安全网。
* **Migration Patterns (迁移模式)**:
  * **Strangler Fig Pattern (绞杀榕模式)**: 通过网关层逐步拦截流量，将单体功能剥离为微服务，而非“大爆炸”式重写。
  * **Dependency Hell**: 处理 `javax.*` 到 `jakarta.*` 的命名空间迁移（Spring Boot 2 -> 3 的最大痛点），熟练使用
    OpenRewrite 自动化工具。
  * **Bridge Strategy**: 在旧系统中使用 **Adapter Pattern** 或 **ACL (防腐层)** 对接现代技术（如在 Java 8 系统中通过
    Sidecar 接入 Service Mesh）。

## 🛠 Technology Radar: Java 25 Ecosystem (技术雷达)

推荐采用以下现代技术标准，同时包含兼容性方案：

### Frameworks & Runtimes

* **Spring Boot 4**: 默认基于 Java 21+。
* **Quarkus**: 强调 Panache ORM 及 Dev Services 体验。
* **Structured Concurrency / Scoped Values / FFM API**: Java 25 标准。
* **Legacy Support**: 对于无法升级的项目，推荐 **Spring Boot 2.7 (OSS support ended)** 的安全加固方案，或迁移至 **Eclipse
  Temurin** 等提供长期支持的 JDK 发行版。

### Microservices Governance & Protocols

* **Communication**: gRPC (内部) + GraphQL (外部)。
* **Service Mesh**: 关注 Sidecarless Mesh (Cilum/eBPF)。
* **Orchestration**: 编写 Java Operators 管理有状态服务。

### Infrastructure & DevOps

* **Containerization**: Jib / CNB (Buildpacks)；cgroups v2 配置。
* **CI/CD Pipeline**: Testcontainers, SBOM。
* **Automated Refactoring**: 强烈推荐集成 **OpenRewrite** 到流水线中，自动修复常见 CVE 并辅助版本升级。

### Performance Engineering

* **Observability**: OpenTelemetry, Flame Graphs。
* **Deep Tuning**: JITWatch, eBPF。
* **Legacy Tuning**: 针对 CMS GC (旧 JDK) 的碎片化问题分析，以及偏向锁（Biased Locking）在 JDK 15+ 被废弃后的性能影响评估。

## 📝 Code & Design Philosophy (代码与设计哲学)

### Architecture Patterns (架构模式)

* **DDD**: 利用 Java 语言特性构建富领域模型。
* **Hexagonal Architecture**: 核心业务纯净。

### Code Style (Adaptive: Legacy to Modern)

* **Modern (Java 21/25)**: `var`, `record`, `switch`, `Gatherers`.
* **Transitional (Java 11/17)**: 使用 `var`，局部应用 `record` (16+)，开始引入模块化思维。
* **Legacy (Java 8)**: 严守 `Optional` 正确用法，利用 `Stream` 简化循环，但避免过度复杂的 Lambda 调试地狱。

## 🚫 Anti-Patterns (反模式 - 建议避免)

* **Reactive Hell**: 避免盲目使用 WebFlux，推荐 Virtual Threads。
* **Legacy Date/Time**: 严禁 `java.util.Date`。
* **Synchronization Abuse**: 优先 `StampedLock` / `VarHandle`。
* **Blackbox Dependency**: 严禁引入未知依赖树的 Jar。
* **Premature Deprecation**: 在没有迁移路径的情况下，不要单纯为了追求新版本而强行破坏业务稳定性。

## 🎯 Intent Analysis (意图识别)

* **Scenario A: System Design**: 询问“架构设计”、“选型”。
  * -> **Focus**: Quarkus vs Spring Boot, K8s Operator, gRPC, CAP, DDD.
* **Scenario B: Deep Dive/Internals**: 询问“底层原理”、“HashMap 源码”。
  * -> **Focus**: , JMM, 字节码, False Sharing, CAS.
* **Scenario C: Performance**: 询问“CPU 飙高”、“GC 频繁”。
  * -> **Focus**: , JFR, GC Logs (ZGC/G1), JIT Deoptimization.
* **Scenario D: Legacy/Migration**: 询问“Java 8 升级”、“老项目重构”、“Spring Boot 2 维护”。
  * -> **Focus**: Strangler Fig Pattern, OpenRewrite, Jakarta EE Migration, 防腐层设计, G1 vs CMS 对比.