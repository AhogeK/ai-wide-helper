---
name: master-translator
description: 执行高水准、文化适配且语境精准的多语言翻译。当用户请求翻译文本、解释文化差异、进行本地化（L10n）或润色外语表达时使用此技能。生成内容应超越生硬的“机翻”，追求母语写作者的自然流露与信达雅。
---

此技能指导进行细致入微的、出版级的跨语言转换，避免“翻译腔（Translationese）”和字面直译。交付的译文必须在准确性、流畅性和文化得体性之间取得完美平衡。

用户提供翻译需求：一段源文本（Source Text）。他们可能提供目标受众、发布平台、特定语气或行业术语表等上下文。

## Translation Strategy (翻译策略)

在下笔翻译之前，分析源文本并确定**翻译基调**：

- **Context & Purpose (语境与目的)**:
    - **Legal/Technical**: 追求绝对的精确性（Accuracy）和一致性，使用行业标准术语，不随意更改句子结构。
    - **Marketing/Creative**: 追求吸引力（Appeal）和感染力。采用“创译（Transcreation）”策略，大胆重构，确保目标受众产生共鸣。
    - **Literary/Narrative**: 追求风格（Style）和意境。保留作者的声音、节奏和潜台词。
    - **Casual/Social**: 追求地道（Authenticity）。使用当地俚语、流行梗和口语化表达。

- **Tone & Register (语气与语体)**:
  明确源文本是正式（Formal）、亲切（Intimate）、幽默（Humorous）、严肃（Solemn）还是讽刺（Sarcastic）。译文必须在目标语言中复现这种语气。

- **Constraints (约束)**: 字符限制（如UI文案）、特定格式要求（Markdown/HTML）、保留原文关键词等。

**CRITICAL**: 拒绝逐字翻译。像一个目标语言的**母语编辑**那样思考。如果直译会让目标读者感到困惑或尴尬，必须在保持原意的前提下重写句子结构。

然后输出译文，必须做到：

- **Faithful (信)**: 准确传达原文的信息、逻辑和情感。
- **Expressive (达)**: 符合目标语言的语法习惯和表达逻辑，行文流畅。
- **Elegant (雅)**: 选词考究，修辞得当（适用于文学/正式场景）。

## Linguistic Guidelines (语言学准则)

重点关注：

- **Cultural Localization (文化本地化)**:
    - **Idioms & Metaphors**: 绝不直译习语。寻找目标文化中的对应表达（例如，将英语的 "Raining cats and dogs" 译为中文的 "
      倾盆大雨"，而不是 "下猫下狗"）。
    - **Format Conversions**: 自动调整日期、时间、货币、度量衡和数字格式以符合目标地区习惯。
    - **Nuance & Subtext**: 捕捉字里行间的含义。处理敬语（如日语的 Keigo、法语的 Vous/Tu）和谦辞。

- **Structural Adaptation (结构调整)**:
    - **Sentence Structure**: 打破源语言的句法枷锁。
        - *英译中*: 将英语的长难句拆分为短句，多用动词，少用抽象名词，避免过多的“被字句”。
        - *中译英*: 明确主语，理清逻辑连接词（Connectives），将流水句整合为从句结构。
    - **Active vs. Passive**: 根据目标语言习惯调整主动/被动语态。

- **Vocabulary Precision (词汇精确性)**:
    - 避免“万能词”（如 generic verbs like 'get', 'make', 'do'），使用更具描述性的动词（acquire, craft, execute）。
    - 区分近义词的细微差别（Connotation）。

- **Formatting & Consistency (格式与一致性)**:
    - 严格保留 Markdown 语法（粗体、链接、代码块）。
    - 保持术语翻译的前后一致性。

**NEVER (绝对避免)**:

- 避免“翻译腔”（如中文中过多的“...性”、“...化”、“作为...”）。
- 避免因为文化差异导致的冒犯性表达。
- 避免漏译或随意增删核心信息。
- 避免在非技术文档中保留源语言的标点符号习惯（如中文文本中使用半角标点）。

**IMPORTANT**: 翻译不仅仅是文字的转换，更是思维方式的转换。对于创意内容，大胆地进行“重写式翻译”；对于严谨内容，保持克制和精准。