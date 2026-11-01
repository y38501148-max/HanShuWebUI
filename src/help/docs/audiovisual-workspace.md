# 视听效果工作区

工作区 ID 为 `audiovisual`，与剧本（`stageplay`）、游戏性（`gameplay`）并列。工程读写仍经同一 `ProjectClient` 与文件事务；不要另开写通道。

## 资源分类

| 分类 | 格式 | 物理目录 | 说明 |
| --- | --- | --- | --- |
| BOSS血条 | `.bossbar` | `src/bossbars/` | 单文件自包含：正文里内嵌唯一一张 Base64 PNG 图集 |

资源类型登记在 `RESOURCE_TYPES`；业务分类在 `AUDIOVISUAL_CATEGORIES`（**不要**塞进 `GAMEPLAY_CATEGORIES`）。路径一律走 `sourcePathOf`。

## 视图

打开 `.bossbar` 默认进入**设计视图**，页签顶部可切到 **JSON**。两种视图编辑同一份草稿，切换时保留设计撤销记录和上次有效预览。设计视图修改通过校验后才写回；JSON 校验失败时保留原文，暂停设计编辑，并显示错误位置。首次打开 v1 文档会显示升级按钮，升级内容保存前仍是本机草稿。

- 左侧：`.bossbar` 文件树；唯一「显示区域」条目；背景 / 数值条 / 文本图层（可锁定、临时隐藏、排序、复制、删除）。
- 中央：**无限画布**（滚轮平移、Ctrl/⌘ + 滚轮缩放、空格或中键拖动、方向键微调、Alt 关闭吸附）。显示区域用虚线框标出，是所有组件的边界。
- 右侧：`属性` / `变量` / `图集` 三页。
- 下方：按显示区域裁出的**游戏输出预览**、GUI 宽度模拟、时间轴、播放/暂停/逐帧、场景按钮。

## 文档协议 v2

`format` 为 `hanshu.bossbar`，`version` 为 2。根字段全部必需：

| 字段 | 含义 |
| --- | --- |
| `id` | 运行时模板 ID，区分大小写、最长 128 字符、禁止首尾空白与控制字符 |
| `texture` | **唯一** PNG 的纯 Base64（无 `data:` 前缀、无空白），≤ 4MiB、≤ 4096×4096 |
| `layout` | `{dock:"top-center", scale:0.1–4, safeMargin:≥0}` |
| `variables` | 文档变量名 → `blackboard.bossbar` 的 Map 键、类型、默认值 |
| `components` | 恰好一个 `display_region` + 任意数量 `background`/`bar`/`text` |

### 无限画布与显示区域

设计坐标系没有边界，组件可以放在负坐标。输出的唯一依据是 `display_region` 的 AABB `R=(rx,ry,rw,rh)`：

```text
x >= rx                 y >= ry
x + w <= rx + rw        y + h <= ry + rh
```

四边相切合法；隐藏的组件、空血条也参与校验。播放到任意一帧、任何填充比例都必须落在组件自己的 box 内。

游戏里按下式换算（`G` 为 GUI 宽度）：

```text
s = min(scale, max(0, G - 2 * safeMargin) / rw)
screenX = (G - rw * s) / 2
componentScreenX = screenX + (x - rx) * s
componentScreenY = rowY + (y - ry) * s
rowHeight = rh * s
```

**移动整个设计到负坐标不改变游戏呈现。** 编辑器提供「定位显示区域」「适配到全部组件」「整体移动」。拖动显示区域标签只移动区域，多选组件在边界处整组停止。锁定图层不参与拖动和方向键移动。属性栏拒绝会使组件越界的区域修改。

### 图集与 UV

所有纹理画笔写 `uv:{x,y,width,height}`（图集像素坐标，整数，完整落在图集内）。采样使用最近邻并夹紧在当前 UV 内，不会从相邻图块取色。

```json
{"kind":"texture","uv":{"x":64,"y":0,"width":192,"height":16},"fit":"stretch"}
```

- `fit`：`stretch` / `contain` / `cover` / `nine-slice`；条填充只允许 `stretch`。
- `nine-slice` 的 `insets=[左,上,右,下]` 相对选中的 UV 区域，必须放得下（左右之和 ≤ UV 宽）。
- `animation` 只切换源 UV：`{mode:loop|once|pingpong, phaseMs, frames:[{uv,durationMs}]}`。`paint.uv` 必须等于第一帧，所有帧尺寸一致，每帧 16–60000ms。
- 纯色画笔（`kind:"solid"`）不占素材，但文档仍必须带那张 PNG。

替换图集是**一次文档编辑**：保留原 UV 并重新校验，越界时不提交。

帧列表的「框选」可选取任意一帧的 UV，「复制」复制当前帧。按行列展开从第一帧 UV 起点生成序列，生成前检查图集边界；FPS 工具将帧率换算为每帧整数毫秒时长。预览区可选择「逐帧目标」，前后帧按钮按该动画的帧边界步进，支持不等时长、相位偏移和往复播放。

### 变量与脚本契约

变量只能来自 `blackboard.bossbar`——它是会话持有、注入 Python 的 Java Map 类对象：

| 文档类型 | 容器写入方法 | JSON 表示 |
| --- | --- | --- |
| `long` | `putLong` | **十进制字符串**，例如 `"9223372036854775807"` |
| `double` | `putDouble` | JSON 有限数值 |
| `bool` | `putBool` | `true`/`false` |
| `string` | `putString` | 字符串，`maxLength` 默认 256 |

`long` 一律以字符串出现，禁止先经过 JavaScript Number。范围里的三项必须同属 `long` 或 `double`，不隐式混算：

```json
"range":{"value":{"var":"shield"},"min":{"type":"long","value":"0"},"max":{"var":"maxShield"}}
```

缺失、类型不符或超长的值在运行时回落到声明默认值；编辑器只能声明键与类型，离线无法证明脚本一定会写这个键。模拟值只在本机预览，不进文档、不进 PAK。

变量面板的模拟状态可选择正常值、缺失键或类型不符，预览显示回退原因。只读成员也能调整模拟状态和值。`double` 输入接受有限数值和科学计数法，`long` 输入始终按 int64 十进制文本校验。

### 默认值

源码里可以省略带默认值的字段。设计修改和编译输出会补齐这些字段（`visible/opacity/direction/smoothMs/fit/insets/maxLength/phaseMs` 等）；保存合法 JSON 时保留作者正文。`components` 里的顺序就是绘制顺序，显示区域条目本身不参与绘制。编译时变量按名字排序，`templateHash` 对实际编译字节取 SHA-256。

## 保存与协作

- `Ctrl+S` / 菜单「保存」走 `useProjectSession → 草稿 → saveProjectToDirectory → EditTransactions → S`。内嵌 PNG 与组件是同一个文件的一个版本，不另存图片。
- 保存、携带脏正文改名和导出都校验 BossBar。缺失/重复显示区域、组件或 UV 越界、损坏 PNG、非法 long 常量和预算超限会阻止提交，原始草稿保留。
- 只读成员能预览、平移画布和调模拟值，不能改共享文档。
- 改名、删除、远端移除、切换工程遵循 `resourceLifecycle`。相机、网格、参考底图和面板状态保存在本机（`hanshu.bossbarEditor.v2::<工程>::<文件>`）；模拟值仅保留在当前编辑会话。

## 导出

新增专用编译器 `.bossbar`：完整校验后输出规范 v2 文档，放在 **shared** 平面。

| 产物 | PAK 路径 | 平面 |
| --- | --- | --- |
| 完整文档（含唯一 PNG） | `bossbars/<文件名>.bossbar` | shared |
| Actor 模板与 Python | 既有 `actors/…`、`script/actor/…` | server，沿用现行编译器 |

图集始终内嵌在 `.bossbar` 中，client、server 和 combined 包包含相同的 BossBar 字节。编译器检查全部包的最终有效路径：不同路径使用相同模板 ID 时拒绝导出，同路径覆盖遵循包顺序。

## 校验与测试

- `npm run test:bossbar`：协议夹具、PNG 结构与像素校验、数值和预算、图集缓存及异步失效、编辑器与动画工具、保存拦截，以及三类 PAK 实际打包解包对比。
- `npm run generate:bossbar-spec`：重新生成 `src/workspaces/audiovisual/bossbar/spec/` 下的 schema 与夹具。只有**有意改变协议语义**时才跑，改动必须随提交 review。
- 机器可校验定义：`src/workspaces/audiovisual/bossbar/spec/hanshu.bossbar.v2.schema.json`
- 跨语言夹具：`src/workspaces/audiovisual/bossbar/spec/bossbar-v2.fixtures.json`（Java 端读同一份）

2026-11-01 使用 ego lite 和隔离工程完成浏览器验收：v1 升级、非法源码保存拦截与有效预览保留、撤销恢复、保存后重开、第二帧 UV 选取与撤销，以及只读账号的科学计数模拟和缺失键回退。两个编辑窗口分别修改同一文件，先提交的版本写入磁盘，后提交窗口收到冲突提示并保留草稿。三类 PAK 的字节和 hash 对比由回归脚本执行。

## 阶段一已知限制

- 浏览器字体与游戏资源包字形不同：字号、基线、截断位置需在实际客户端复核。
- 只支持单张图集；多张帧文件的自动合图未实现（最终格式仍是一张 PNG）。
- 不提供旋转、骨骼动画、视频、任意脚本表达式或通用 HUD 编辑。
- 服务器端的 BossbarVariables、网络同步与客户端渲染属于阶段二，当前尚未实现。
