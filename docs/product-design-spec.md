# 个人知识工作台 · 产品设计说明（供 UI / 产品图生成）

本文给其他 AI 画产品图、线框、高保真界面用。只描述 **v1 已锁定的功能和界面**，不要发明登录页、看板、日历、GitHub、发布后台。

产品定位：单用户本机 Web 工作台。不登录知乎 / 公众号 / 小红书。外部 Agent 经 HTTP 导入收藏、导出文稿。站内 Cursor Agent 贴在当前条目右侧，对着正在看的东西讨论和产出。

---

## 1. 给绘图模型的总约束

- 设备：桌面浏览器，**1440×900 或 16:9**，不是手机，不是营销落地页。
- 类型：**生产力工作台**（接近邮件客户端 / RSS / IDE），信息密度中高，不是 SaaS 营销站，不要大 Hero、不要插画人物、不要 3D。
- 结构：所有主模块同一套骨架——**左侧模块导航 + 三栏工作区 + 最右侧 Agent**。
- 文字：界面是 **简体中文**。真实可读的中文标签，不要 Lorem ipsum，不要乱码。
- 禁止：渐变、彩色阴影、霓虹、emoji 图标墙、每个模块一种主题色、玻璃拟态、手机状态栏。
- 允许：1px 分割线、扁平表面、少量强调色、小圆角（6–8px）。

### 1.1 视觉系统

| 角色 | 规格 |
| --- | --- |
| 整体 | 浅色阅读界面。页面底 `#F4F2EE`，卡片/栏 `#FFFFFF`，分割线 `#E6E2DA` |
| 主文字 | `#1C1917` |
| 次文字 | `#78716C` |
| 强调色 | `#2563EB`（选中、主按钮、当前条目左边线） |
| 字体 | 界面 UI 用无衬线（Inter / 思源黑体）；正文阅读用稍大字号、舒适行高 |
| 模块导航 | 最左 56–64px 竖条，图标+短字，选中项浅蓝底 |
| Agent 栏 | 宽 320–360px，背景比主区略暖灰 `#F7F5F1`，顶上写「Agent」，和内容区用竖线分开，表明这是对话而不是正文 |

五个模块入口（自上而下，v1 **没有 GitHub**）：

1. 收藏
2. Wiki
3. 待办
4. 课程
5. 出稿

---

## 2. 产品模块（功能，绘图时必须能看出来）

统一底层：所有东西都是「知识条目」（标题 + Markdown 正文）。模块只是不同界面。v1 **没有打标分组**，不要画学科 pill、分组筛选、「打标分组」输入框。

Agent：**一条知识一份对话**。右栏永远跟当前选中的夹/页/任务/课时/稿走。课程「设计一门课」是另一次独立长对话，不要画进学习三栏里。

---

## 3. 屏幕清单（请按屏出图）

下面每一节都是一张独立产品图。生成时只画该屏，不要把五张拼成一张海报（除非明确要求总览）。

### 屏 A · 收藏（第一期主界面，优先出图）

这是产品招牌布局，其它模块都从这里长出来。

**最左** 模块导航，「收藏」为选中。

**左栏（约 220px）收藏夹列表**

- 标题「收藏夹」
- 列表项示例：
  - 算法与数学（24）
  - 认知与哲学（18）
  - 工程实践（41）← 当前选中，浅蓝底
  - 未分类（6）
- 每项只有名称和篇数，不要文件夹 3D 图标。

**中栏（约 340px）当前夹的文章列表**

- 每一行只显示：**标题、作者、原文日期**
- 不要摘要、不要链接、不要「回答/文章」类型标签，不要分组 pill
- 示例行（第三行选中，左边 2px 蓝条）：
  1. 如何理解傅里叶变换 · 张三 · 2024-11-02
  2. 类型系统不是注释 · 李四 · 2025-03-18
  3. **为什么物理学家需要哲学** · 王五 · 2023-08-09 ← 选中
  4. 证明助手与数学直觉 · 赵六 · 2025-01-12

**右内容栏（弹性）阅读器**

- 大标题：为什么物理学家需要哲学
- 元信息一行：王五 · 2023-08-09 · 原文链接（文字链）
- 正文 4–6 段中文，像知乎长回答：论述、小标题「可证伪性」，段落清晰，不要假浏览器文章卡片

**最右 Agent**

- 标题：Agent
- 上下文提示小字：当前夹「工程实践」· 当前篇「为什么物理学家需要哲学」
- 2–3 轮短对话：用户问「把这篇拆成课程大纲要点」；Agent 回 4 条要点
- 底部输入框占位：「基于当前这篇提问…」

### 屏 B · Wiki

同一骨架。「Wiki」导航选中。

**左栏改为可嵌套页面树**（不是收藏夹）：

- 计算机
  - 算法
    - **动态规划** ← 当前页
    - 图论
  - 类型系统
- 哲学
  - 科学哲学
- 未命名页面

树用细折线/缩进，当前页高亮。

**中+右合并为正文编辑/阅读区**（Wiki 没有「列表中栏」，是 **树 | 正文 | Agent**）：

- 页顶标题「动态规划」
- 面包屑：计算机 / 算法 / 动态规划
- Markdown 正文：定义、状态转移、一小段伪代码（等宽）
- 不要思维导图（导图只出现在课程设计）

**Agent**：上下文为当前 Wiki 页「动态规划」。

### 屏 C · 待办

「待办」选中。三栏。

**左栏**

- 视图：未完成（选中）/ 今天 / 全部

**中栏任务列表**

- 每行：勾选框、标题、截止日期
- 示例：
  - ☐ 把傅里叶变换那篇收成 Wiki · 9月12日
  - ☑ 整理哲学收藏夹（已完成，删除线，不要出现在「未完成」里——此屏只画未完成）
  - ☐ 为「动态规划」补两道例题 · 今天 ← 选中
- 勾选不打开新页面，列表仍在。

**右栏**：当前任务备注（几行 Markdown）+ 「链接到 Wiki：动态规划」文字链 + Agent（上下文是这条待办）。

### 屏 D · 课程设计（对话流，不是三栏）

这是 **另一张图**，不要和学习页画在一起。

居中或左侧大对话，右侧或下方同时出现 **大纲列表 + 思维导图**，两者是同一棵树。

- 顶栏：新课程 · 已绑定：收藏夹「算法与数学」、Wiki「动态规划」、`信号.pdf`
- 对话：Agent 在拷问（基础、范围、想用在哪），用户简短回答
- 大纲（可嵌套）：
  - 1 傅里叶在干什么
  - 2 从时间到频率
    - 2.1 周期信号
    - 2.2 非周期与积分
  - 3 离散化与 FFT
- 同一结构的思维导图（节点+连线，浅色，不要装饰插画）
- 主按钮：「确认目录，生成课程」（还不能点进课时正文）
- 不要出现课时长文，不要出现 canvas 动画

### 屏 E · 课程学习

回到三栏。「课程」导航选中。

**左栏目录树**（确认后的那棵，带进度）

- 傅里叶直觉（进行中）
  - 傅里叶在干什么 ✓
  - **从时间到频率** ← 当前
  - 离散化与 FFT（未开始，浅字）

**中栏课时**

- 顶上切换：`文档`（选中） / `Canvas`
- 标题：从时间到频率
- 固化下来的中文讲义 3–4 段 + 一个简单示意图占位（波形），不是每次打开都在 loading

**最右 Agent**：上下文「课程背景 + 当前课时」。用户消息：「给这一课补一个逐步动画 canvas」。

若单独出一张 **Canvas 视图**：同一布局，中栏切到 Canvas——分步控件（上一步/下一步）、中间是时间轴上的波形逐步变为频谱，仍然是扁平教学 UI，不是游戏。

### 屏 F · 出稿

「出稿」选中。三栏。

**左栏稿件列表**

- 物理学家为什么需要哲学（公众号 ✓ 小红书 · 知乎 ✓）
- **FFT 入门给工程师** ← 选中（公众号 · 小红书 ✓ 知乎）
- 动态规划直觉（均未生成变体，不要打勾）

**中栏**

- 顶上标签：`底稿` | `公众号` | `小红书`（当前） | `知乎专栏`
- 小红书变体：更短标题、分段短句、话题 `#信号处理` `#工程师学习`、配图说明 1/2/3（每条一行画面描述，不是真实照片拼贴）
- 若画「底稿」标签：长文 Markdown，像 Wiki
- 若某平台未生成：中栏几乎空白，只有按钮「从底稿生成」

**Agent**：上下文为当前稿 + 当前平台标签。

不要画微信/小红书/知乎的官方发布后台，不要登录按钮。

---

## 4. 明确不要画的东西

- GitHub、看板、日历、提醒、优先级、子任务
- 知乎/微信/小红书登录、扫码、发布成功页
- 移动端、暗色赛博、仪表盘大数字、团队头像、设置里一堆第三方 OAuth
- 全局一个跨模块聊天气泡（Agent 必须在右栏，跟当前条目走）
- 课程目录写进 Wiki 树（课程是独立容器）

---

## 5. 可直接复制的英文绘图提示词

用于 Midjourney / Flux / GPT-Image 等。每次只生成一屏。可加后缀：`flat UI mockup, desktop web app, 16:9, high fidelity, Chinese UI labels, no photorealistic people, no 3D, no neon, thin 1px dividers, paper-like off-white background`.

### Prompt A — 收藏（主视觉，优先）

```
Desktop web productivity workbench UI, 16:9, light paper theme (#F4F2EE background, white panes, #2563EB accent). Far-left 60px module rail with Chinese labels 收藏 Wiki 待办 课程 出稿, 收藏 selected. Then four columns: (1) collection folders 收藏夹 with items 算法与数学 认知与哲学 工程实践 未分类, 工程实践 selected; (2) article list rows showing title, author, date only, one row selected "为什么物理学家需要哲学"; (3) article reader with Chinese long-form body; (4) Agent chat sidebar labeled Agent, context line naming current folder and article, short Chinese conversation, input placeholder 基于当前这篇提问. Style like a mail client plus reader, dense, calm, no illustrations, no gradients, no emojis, no mobile frame.
```

### Prompt B — Wiki

```
Same desktop workbench shell as a knowledge wiki. Module  Wiki selected. Left pane nested page tree in Chinese: 计算机 > 算法 > 动态规划 (current), 图论; 哲学 > 科学哲学. Center large document: title 动态规划, breadcrumb, markdown with heading and monospace pseudocode. Right Agent sidebar bound to this page. Light paper UI, 16:9, blue accent, no mind map, no 3D folders.
```

### Prompt C — 待办

```
Same workbench, 待办 selected. Left: views 未完成 今天 全部. Middle: checkbox task list, titles in Chinese, due dates, one task selected "为动态规划补两道例题". Right: notes, link to wiki page 动态规划, Agent chat. Light, flat, 16:9, not a kanban, not a calendar.
```

### Prompt D — 课程设计对话

```
Desktop course-design screen, not the three-pane reader. Top bar: bound sources 收藏夹「算法与数学」, Wiki「动态规划」, 信号.pdf. Main area: Chinese AI interview chat grilling the learner about goals. Beside it the SAME nested tree shown twice — numbered outline and a clean mind-map of 傅里叶直觉. Primary button 确认目录，生成课程. No lesson essay yet, no animation canvas. Light editorial UI, 16:9.
```

### Prompt E — 课程学习

```
Same three-pane workbench, 课程 selected. Left course tree with checkmarks and current lesson 从时间到频率. Center lesson document view with toggle 文档 | Canvas, Chinese lecture text. Right Agent, user asking to add a stepwise canvas. Light UI, 16:9, progress in the tree, not a video platform.
```

### Prompt F — 出稿

```
Same workbench, 出稿 selected. Left list of article drafts with small platform readiness marks. Center editor tabs 底稿 公众号 小红书 知乎专栏, 小红书 tab active: short Chinese copy, hashtags, numbered image briefs. Right Agent. No WeChat or Xiaohongshu official publisher UI, no login. Light, 16:9.
```

---

## 6. 总览图（可选，一张海报）

若需要「产品全貌」一张图：浅色桌面，中央是屏 A 收藏三栏作为主窗口；四周用细线框出缩小的 Wiki 树、待办列表、课程导图、出稿标签，全部同一套导航和 Agent 右栏。标题可写「个人知识工作台」。仍不要 GitHub，不要手机。

英文提示：

```
Product overview poster of a Chinese personal knowledge workbench. Center: large desktop screenshot of a three-pane collection reader plus Agent sidebar. Around it four smaller consistent UI thumbnails: wiki tree, todo list, course mindmap design, multi-platform article editor. Shared left nav 收藏 Wiki 待办 课程 出稿. Light paper design system, blue accent, flat, 16:9, no people, no GitHub, no mobile devices, no marketing slogans.
```

---

## 7. 功能对照（绘图不要漏）

| 模块 | 能看见什么 | 看不见什么 |
| --- | --- | --- |
| 收藏 | 夹、列表、正文、Agent | 知乎登录、赞数、分组 pill |
| Wiki | 嵌套树、长文、Agent | 双向链接图谱、打标分组 |
| 待办 | 未完成/今天/全部、勾选、链到 Wiki | 看板、优先级、分组筛选 |
| 课程设计 | 拷问对话、大纲=导图同一棵树 | 课时正文 |
| 课程学习 | 目录进度、文档/Canvas 切换、固化讲义、Agent 补 canvas | 每次点开重新生成的 loading |
| 出稿 | 底稿+三平台标签、配图说明、导出就绪标记 | 真实发布、平台后台 |
| 全局 | 一条知识一个 Agent 对话 | 全局万能聊天 |

---

## 8. 第一期实现范围（给产品图：只强调收藏）

若只要「即将开工」的图：只出 **屏 A**。导航里其它模块可以灰显，但不要画成空状态插画。
