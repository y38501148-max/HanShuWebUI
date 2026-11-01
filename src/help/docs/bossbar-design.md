# 自定义 BossBar 策划方案

状态：设计约定，实施进度须另行核验。编写及修订日期：2026-11-01。本文按最新约定统一协议、编辑体验、游戏接入和验收步骤；新字段、类名和脚本方法均为拟实现接口。

实施顺序固定为：**确定协议 → 完成 WebUI 可视化编辑器与预览 → 停止并打开 WebUI 供用户验收 → 用户要求继续后接入游戏 → 停止并打开游戏供用户验收。** 两次停止发生在后续开发过程中，本轮修订只更新方案。

## 1. 已确定的约束

本方案以以下约定为准，替换旧草案中任意黑板属性、Actor 内置变量源、多张外链图片和有限画布的设计。

| 对象 | 约定 |
| --- | --- |
| 变量容器 | 只能来自 `blackboard.bossbar`；它是会话持有、注入 Python 的 Java Map 类对象，支持 `long/double/bool/string` |
| 素材 | 每份 `.bossbar` 必须且只能内嵌一张 Base64 PNG，所有图片组件共用该图集 |
| UV | 组件能指定图集 UV；序列动画逐帧切换同一 PNG 内的 UV |
| 画布 | 无限编辑画布，可向任意方向平移；画布本身没有输出宽高 |
| 显示区域 | 矩形 `display_region` 组件，有且仅有一个，显式定义整个 BossBar 的 AABB |
| 其他组件 | 背景、条、文本各可有多个；所有组件完整位于显示区域内，包括暂时不可见的组件 |

作者在“视听效果 → BOSS血条”中编辑 `.bossbar`。参考图的徽记、槽底、边框和装饰使用多个背景组件，生命与护盾使用多个条组件，名字、目标、阶段和数值使用多个文本组件。脚本将需要公开的值写入 `blackboard.bossbar`，客户端据此显示。

![用户提供的 BossBar 参考图](images/bossbar-reference.png)

参考图用于说明构图。单张截图无法证明原效果的动画方式，本方案把火焰和徽记等装饰设计为可播放 UV 序列。截图下方的世界画面仅作预览背景，不打进素材。首版采用轴对齐矩形，暂不加入旋转、骨骼动画、视频、任意脚本表达式或通用 HUD 框架。

## 2. 已核实的项目基础

主线核查基线为 WebUI `78435f34c69c328903983ff49bafc18390a7cb55`、Mod `46ea3af8bba21830f935fd492b16391307621078`。本地正在进行的实现不能当作已验收能力；开始实施时须对照最新约定重新检查代码。

| 基线行为 | 依据 | 接入方式 |
| --- | --- | --- |
| `.bossbar` v1 只有 `format/version/id` | [基线 bossbar.ts](https://github.com/HanShu-RPG-Tool-Kit/HanShuWebUI/blob/78435f34c69c328903983ff49bafc18390a7cb55/src/workspaces/audiovisual/bossbar.ts) | 定义 v2 和显式升级，不能往 v1 静默添加字段 |
| 视听工作区已有资源树、JSON 编辑、草稿保存 | [AudiovisualWorkspace.tsx](../../workspaces/AudiovisualWorkspace.tsx)、[现行说明](audiovisual-workspace.md) | 设计视图与源码共用现有草稿、事务和资源生命周期 |
| 声誉旗帜把 Base64 PNG 写进 `.rep` 的 `banner` | [reputation.ts](../../workspaces/gameplay/reputation.ts)、[ReputationEditor.tsx](../../workspaces/gameplay/ReputationEditor.tsx) | 参考上传/粘贴/预览流程；BossBar 单独定义图集和预算 |
| Actor 使用会话托管的原版 `ServerBossEvent` | [Actor 文档](../../../../ModRPGToolKit/docs/actor.md)、[ActorBossBar.java](../../../../ModRPGToolKit/src/main/java/mchhui/rpgtoolkit/feature/actor/script/ActorBossBar.java) | 扩展原句柄并保留原版回退 |
| 当前黑板是动态 Python 对象，没有预设 BossBar Map | [ActorPython.java](../../../../ModRPGToolKit/src/main/java/mchhui/rpgtoolkit/feature/actor/script/ActorPython.java)、[ActorScriptHost.java](../../../../ModRPGToolKit/src/main/java/mchhui/rpgtoolkit/feature/actor/script/ActorScriptHost.java) | 新增 Java 容器并注入 `blackboard.bossbar` |
| 宿主先更新原版条，再调用 tick hook | 同上 `ActorScriptHost.tick` | 自定义变量快照在本 tick hook 完成后取得 |
| PAK 支持 client/server/shared，门户支持自动发版 | [planes.ts](../../export/pack/planes.ts)、[游戏开发服务器](game-dev-server.md) | 单文件模板走 shared；复用发布入口 |

BossBar 仍由脚本选择，不在 `.actor` 中新增模板字段。工程服务 S 管理文件，游戏服务端管理 Actor 和显示变量；两者的权限与状态各有归属。

## 3. 文档、无限画布与显示区域

### 3.1 根结构

格式为 `hanshu.bossbar`、version=2，源路径沿用 `src/bossbars/<文件名>.bossbar`。v2 尚属本轮设计，旧草案生成物必须按本版重建，不能将旧协议形状当作第二种合法 v2。

| 根字段 | 含义 |
| --- | --- |
| `format/version/id` | 格式、版本、运行时模板 ID |
| `texture` | 唯一 PNG 的纯 Base64 字符串，必填且非空 |
| `layout` | 游戏顶部停靠与显示缩放；不描述编辑画布大小 |
| `variables` | 文档变量名到 BossBar Map 键、类型、默认值的声明 |
| `components` | 一个显示区域和任意数量背景、条、文本组成的数组 |

模板 ID 保留 v1 原值，区分大小写，最长 128 字符，禁止首尾空白和控制字符。文件改名不改变模板 ID，复制文档生成新 ID。最终有效 PAK 中不同路径的相同模板 ID 拒载；同路径覆盖沿用既有挂载规则。变量名和组件 ID 满足 `[A-Za-z][A-Za-z0-9_]{0,63}`，分别在文档内唯一。

根字段全部必需，允许空 `variables`。`components` 最少含一个显示区域，不能是空数组。未知字段和版本明确诊断，保留原文。v1 升级在草稿中显式生成 v2，保留 ID、添加默认显示区域和一张透明 1×1 PNG，用户保存后才提交。

### 3.2 无限画布

编辑器提供无限平移、缩放、网格和原点。所有组件的 `box={x,y,width,height}` 位于同一设计坐标系，允许负位置和小数；数值必须有限，宽高大于零。无限画布没有 `width/height`，没有“超出画布自动裁切”的规则。

编辑相机、视口尺寸、网格、缩放和参考底图均为本机状态，不进入 `.bossbar`。画布原点只是编辑参照，显示区域可以位于任意坐标。实际输出由唯一显示区域决定，不使用组件自动求并集来替代作者明确设置的区域。

### 3.3 唯一显示区域组件

使用 `type:"display_region"`，只包含 `id/type/box`。新建文档默认提供 `{x:0,y:0,width:768,height:72}`。显示区域在图层列表中固定为一个特殊条目，可以选中和编辑；不绘制游戏图像，不参与绘制层级，没有 `visible/opacity`，不能复制、删除或新增第二个。

设显示区域为 `R=(rx,ry,rw,rh)`，任意其他组件为 `C=(x,y,w,h)`，合法条件为：

```text
x >= rx                 y >= ry
x + w <= rx + rw        y + h <= ry + rh
```

四边相切合法。组件透明像素、当前帧、填充比例和当前显隐不改变包含判断。一个空血条或隐藏装饰的完整 box 仍须在 R 内。每个组件的实际输出（包括文本阴影、尾条）裁切在自身 box 内，确保视觉结果也不超出声明 AABB。显示区域是几何约束，不能靠运行时截掉越界部分来使非法文档通过校验。

拖动、方向键和缩放手柄在允许范围内约束结果，多选按所选组件的联合外框限制位移。属性栏提交越界数值时拒绝该次修改并定位原因；JSON 编辑可暂存非法草稿，但保存为有效工程文档、导出和游戏加载均须拒绝。缩小或移动显示区域使组件越界时也拒绝，不静默移动子组件。

另提供“整体移动”，同时平移显示区域和全部组件，作为一次可撤销操作；“适配到全部组件”是作者主动执行的动作，把显示区域设为组件联合外框，不自动执行。显示区域单独移动只改变 AABB，不隐式带动组件。

### 3.4 从 AABB 到游戏屏幕

`layout` 默认 `{dock:"top-center",scale:0.5,safeMargin:12}`。`scale` 范围 0.1–4，safeMargin 为非负 GUI 逻辑像素；首版停靠固定顶部居中。给定 GUI 宽度 G，按显示区域宽度计算：

```text
s = min(scale, max(0, G - 2 * safeMargin) / rw)
screenX = (G - rw * s) / 2
componentScreenX = screenX + (x - rx) * s
componentScreenY = rowY + (y - ry) * s
rowHeight = rh * s
```

`s=0` 时不绘制。默认顶部留白 12 GUI 像素、行距 6 GUI 像素，rowY 由统一 BossBar 排列器分配。移动整个设计到负坐标不改变游戏呈现；显示区域的空白边距会保留并参与居中和堆叠。

浏览器编辑缩放与 `layout.scale` 分离。预览展示完整显示区域，可模拟游戏 GUI 尺寸；编辑时滚动到远处不会改变导出或游戏占位。

## 4. Java 变量容器

### 4.1 `blackboard.bossbar` 的语义

拟新增 Java 类型 `BossbarVariables`，作为受限 Map 使用。每个 Actor 脚本会话创建一个实例，全部脚本共享，通过只读属性 `blackboard.bossbar` 注入。普通脚本仍可使用其他黑板字段保存内部状态；这些字段不会被 BossBar 读取。

宿主 Session 持有容器的权威引用，避免通过遍历 Python 属性查找显示值。普通赋值或删除 `blackboard.bossbar` 应报错；修改容器内容通过其 API 完成。会话重建创建新容器并撤销旧句柄的写入能力，清理后不得从旧引用恢复数据。

| Java API（拟定） | 含义 |
| --- | --- |
| `putLong(key,long)` / `putDouble(key,double)` | 写入有符号 64 位整数 / 有限 IEEE-754 binary64 |
| `putBool(key,boolean)` / `putString(key,String)` | 写入布尔值 / 字符串 |
| `get(key)` / `containsKey(key)` | 获取对应装箱值；不存在时 get 返回 null，使用 containsKey 区分存在性 |
| `remove(key)` / `clear()` | 移除一个键 / 清空显示数据 |
| `snapshot()` | 返回不可变、有类型标签的快照，用于宿主投影与同步 |

对脚本提供显式写入方法，以免 GraalPy 的整数、布尔值和重载选择产生歧义。内部值仅允许 `Long/Double/Boolean/String`。不提供接收任意 Object 并隐式转换的写入口；不支持 null、集合、嵌套 Map、Java 实体引用或任意 Python 对象。删除值使用 remove，不写 null。

键名满足 `[A-Za-z][A-Za-z0-9_]{0,63}`。写入校验线程、会话有效性、类型与预算，失败不改变原值。bool 不作为整数接受；long 溢出、double 非有限值、超长字符串立即报错。类型可以由相应 put 方法显式变更，模板绑定类型不匹配时使用模板默认值并诊断。

### 4.2 文档变量声明

所有 `variables.*.key` 都隐式指向 `blackboard.bossbar` 的键，无 `source.kind`，没有 Actor 内置来源或任意 Python 属性路径。生命值、最大生命、名字和目标也必须由脚本主动写入该容器。

```json
{
  "health":{"type":"double","key":"health","default":0},
  "maxHealth":{"type":"double","key":"max_health","default":1},
  "shield":{"type":"long","key":"shield","default":"0"},
  "bossName":{"type":"string","key":"boss_name","default":"首领","maxLength":64},
  "targetName":{"type":"string","key":"target_name","default":"无","maxLength":64},
  "enraged":{"type":"bool","key":"enraged","default":false}
}
```

缺失键和类型不匹配应用同类型默认值，按“会话＋键＋原因”限频诊断。仅同步当前模板声明的键；同一 Actor 的观看者获得相同投影。编辑器声明类型，无法离线证明脚本一定会写入这个键，应展示具体完整路径，如 `blackboard.bossbar["health"]`。

string 默认最多 256 Unicode 码点，可用 `maxLength` 缩小到 1–256；容器先按全局上限拒绝过长值，模板投影再检查自己的 maxLength，超出模板上限时使用默认值。默认值也须满足限制。bool 使用 true/false，double 使用 JSON 有限数值。

### 4.3 long 精度与数值规则

long 的范围是 `-9223372036854775808` 至 `9223372036854775807`。JSON 内的 long 常量、默认值、预览输入和调试快照统一用十进制字符串表示；类型标签仍为 long。禁止先经过 JavaScript Number 再转字符串。WebUI 用 BigInt 或等价精确整数实现，Java 用 long，差值/乘法可能溢出时使用 BigInteger。

数值引用为 `{"var":"health"}`；字面常量为 `{"type":"double","value":0}` 或 `{"type":"long","value":"0"}`。条和比例片段的 value/min/max 必须同属 long 或 double，不隐式混算。需要转换时由脚本使用对应 put 方法写入目标类型。

long 的比较与相减采用精确整数运算，绘图比例在相减、边界处理后才转换成浮点；比例误差只影响亚像素，不允许改写原值。文本整数格式必须保留所有位，compact/percent 以整数或十进制算法舍入。double 范围运算应防止 `max-min` 溢出，可按量级归一化计算；双端共享极端输入夹具。

### 4.4 脚本与采样

宿主在本 tick 的脚本执行完后，从 Java 容器生成只读快照；快照读取不需要重新进入 Python、反射属性或调用字符串转换。脚本调用 put 方法仍在既有受控宿主内执行，容器只接受服务端主线程写入。第一次快照等待全部 init hook 完成。

拟扩展原句柄的 `setTemplate(id)`、`clearTemplate()`、`setPriority(int)`：选择 v2 模板、恢复纯原版、设置 -1000 至 1000 的排序优先级。同 ID/hash 的 setTemplate 幂等；选择失败保留旧模板。setVisible 同时控制原版与自定义显示，其他原方法继续维护原版回退。

```python
# 以下 BossbarVariables 与 setTemplate 为拟新增接口。
def update_values(event, blackboard):
    mob = event.entity()
    target = mob.getTarget()
    values = blackboard.bossbar
    values.putDouble("health", float(mob.getHealth()))
    values.putDouble("max_health", float(mob.getMaxHealth()))
    values.putString("boss_name", mob.getDisplayName().getString())
    values.putString("target_name", "无" if target is None else target.getDisplayName().getString())
    values.putBool("enraged", mob.getHealth() <= mob.getMaxHealth() * 0.3)

@hook("init")
def initialize(event, blackboard):
    blackboard.bossbar.putLong("shield", 0)
    update_values(event, blackboard)
    event.api().bossBar().setTemplate("hanshu:ember_guard")

@hook("tick")
def update_display(event, blackboard):
    update_values(event, blackboard)
```

`setProgress/setName` 不自动写入容器；自定义组件完全按声明取值。需要原版回退标题与自定义标题一致时，示例脚本应同时设置原句柄名称和 `boss_name`。容器不额外持久化，继承 Actor 会话生命周期。

## 5. 单张 PNG、UV 与组件

### 5.1 内嵌图集

根字段 `texture` 存纯 Base64 PNG，参照声誉旗帜。上传 PNG 或粘贴 `data:image/png;base64,…` 后，编辑器移除前缀与空白并验证，保存为规范 Base64。宽高从 PNG 解码取得，不重复保存一份可能不一致的尺寸。

文档必须有且只有这一张图。组件、帧和 PAK 不引用外部图片路径，不另写资源清单，不为组件内嵌第二份 Base64。新建空文档使用透明 1×1 PNG；下面是有效默认值：

```json
{"texture":"iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR4nGNgAAIAAAUAAXpeqz8AAAAASUVORK5CYII="}
```

替换图集保留原 UV 数值并重新校验全部组件和帧，越界时不提交替换结果，提示修正 UV 或取消。图集尺寸改变时不自动按比例改写坐标；若提供“等比例重映射 UV”，必须是显式操作并再次校验。首版直接导入单张图集；多张帧文件的自动合图可后续增加，最终格式仍只能是一张 PNG。

### 5.2 静态 UV 与动画 UV

UV 使用图片像素坐标 `{x,y,width,height}`，全部为整数。左上角起点，区域为 `[x,x+width) × [y,y+height)`，宽高大于零，完整位于图集内。存像素坐标便于编辑，渲染时统一除以纹理宽高转为归一化 UV。默认最近邻采样并夹紧到当前 UV 区域，避免从邻接图块采到颜色。

使用纹理的背景或条 paint 必须指定 `uv`；静态时就是显示的区域。有动画时还可指定 `animation`，其帧列表只包含 UV 和持续时长：

```json
{
  "kind":"texture",
  "uv":{"x":0,"y":32,"width":128,"height":32},
  "fit":"stretch",
  "animation":{
    "mode":"loop","phaseMs":0,
    "frames":[
      {"uv":{"x":0,"y":32,"width":128,"height":32},"durationMs":100},
      {"uv":{"x":128,"y":32,"width":128,"height":32},"durationMs":100},
      {"uv":{"x":256,"y":32,"width":128,"height":32},"durationMs":100}
    ]
  }
}
```

以上局部示例要求图集至少 384×64。`uv` 与动画第一帧相同，所有帧尺寸一致；未播放时显示第一帧。动画每次改变源 UV，目标组件 box 恒定。动画不能访问另一张图片，也不能通过动态移动组件绕过显示区域约束。

loop 按总时长取模，once 结束后停末帧，pingpong 使用 `0…n-1,n-2…1`，不重复端点，单帧恒定。帧区间左闭右开，phaseMs 为非负整数。每帧时长 16–60000ms；FPS 工具只负责生成整数时长，实际播放以保存的时长为准。

实例时间由服务端起始 tick 与 sampleTick 建立，按 50ms/tick 转换并在 tick 间平滑推进。迟加入者按实例当前时间播放，变量更新不重置动画，隐藏期间时间继续；单机暂停冻结，联机菜单不冻结。浏览器预览有独立可暂停、逐帧、拖动的模拟时钟。卡顿后直接取当前帧，不补画丢失帧。

### 5.3 可绘制组件公共属性

背景、条、文本都可有多个。共同字段为 `id/type/box`，可选 `visible`（bool 常量或 bool 变量引用，默认 true）和 `opacity`（0–1，默认 1）。绘制顺序采用 components 中可绘制组件的顺序，忽略显示区域条目的位置。

颜色使用 `#RRGGBBAA`，常规 alpha 合成。旋转、嵌套和会改变 box 的动画不进入首版。阴影、填充、九宫格和文字都限于组件 box；不可见组件也参与几何校验。

### 5.4 背景组件

`type:"background"`，包含 `paint`。paint 可以是 `{kind:"solid",color:"#231016FF"}`，或包含 uv 的 `kind:"texture"`。纯色绘制不额外占素材，图集仍按文档要求保留一张。

纹理 fit 支持 stretch/contain/cover/nine-slice，默认 stretch；后两种居中裁切或留边。nine-slice 的 `insets=[左,上,右,下]` 相对选中的 UV 区域，必须能容纳于帧尺寸；目标过小时边距同比缩小，中心允许为零。九宫格逐帧应用相同边距。徽记、槽底、框和火焰各为独立背景组件，边框可置于条前方。

### 5.5 条组件

`type:"bar"`，包含 `range={value,min,max}`、`fill`，可选 direction、smoothMs 和 trail。range 使用第 4.3 节的类型化常量/引用，三项均明确填写；fill 复用 paint，纹理模式只允许 stretch。

```text
p = clamp((value - min) / (max - min), 0, 1)
```

max<=min 时比例取 0 并提示。direction 支持 left-to-right/right-to-left/bottom-to-top/top-to-bottom。先选当前 UV 帧，映射到完整条 box，再按比例裁切；源纹理不会被压缩到剩余血量宽度。生命、护盾、韧性分别使用独立条组件。

smoothMs 默认 120，范围 0–1000；首次显示直接取真实值，后续线性过渡，新值从当前显示比例重新起算。文本显示最新真实值。可选 `trail={paint,delayMs,durationMs}` 绘制在填充后面：掉血时延迟后追赶，连续掉血从当前尾条位置重新计时，回血时立即对齐当前填充。尾条与主条受同一个 box 限制，二者的纹理都来自唯一图集。

### 5.6 文本组件

`type:"text"`，结构化 runs 支持字面文本、变量和比例片段；片段可覆盖颜色。格式为 string/number/compact/percent，long 采用精确格式化，double 用数值格式化，string 支持 string/bool（布尔输出 true/false）。比例片段复用与条相同的 range 规则，percent 乘 100 并追加 `%`。digits 为 0–4，默认 0；compact 固定使用 K/M/B，禁用平台 locale 隐式格式，双端共享舍入和阈值夹具。

文本属性包括 fontSize（默认 16 设计像素）、color、align（默认 left）、verticalAlign（默认 middle）和 shadow（默认 false）。字体采用游戏默认字体，单行超宽按完整字形省略并加 `…`。文本阴影也裁切到 box，作者应在文本 box 中预留阴影与字形空间。浏览器字体近似与游戏资源包字形的差异在阶段二验收。

字形来自字体系统，没有图片采样 UV。背景与条的纹理 paint 提供显式 UV；文本若需图标或动画底板，使用同图集的独立背景组件组合。显示区域也不设置 UV。这样每个实际采样素材的组件都能指定 UV，文本仍保留变量排版能力。

## 6. 可解析协议示例

以下完整示例内嵌一张有效的 4×2 PNG 小图集，用不同像素演示 UV 和两帧动画。它用于协议验证；接近参考图的美术模板在阶段一使用一张完整图集制作。显示区域故意放在负坐标，以验证游戏渲染按 AABB 原点归一化。

```json
{
  "format":"hanshu.bossbar",
  "version":2,
  "id":"hanshu:ember_guard",
  "texture":"iVBORw0KGgoAAAANSUhEUgAAAAQAAAACCAYAAAB/qH1jAAAAJ0lEQVR4nGNQFhD7/1ZF5///zZ7/t0yL+s/wP4Dh//8TQAwEDEAAADbPEjL7vUAnAAAAAElFTkSuQmCC",
  "layout":{"dock":"top-center","scale":0.5,"safeMargin":12},
  "variables":{
    "health":{"type":"double","key":"health","default":0},
    "maxHealth":{"type":"double","key":"max_health","default":1},
    "bossName":{"type":"string","key":"boss_name","default":"首领","maxLength":64},
    "targetName":{"type":"string","key":"target_name","default":"无","maxLength":64},
    "enraged":{"type":"bool","key":"enraged","default":false},
    "shield":{"type":"long","key":"shield","default":"0"},
    "maxShield":{"type":"long","key":"max_shield","default":"100"}
  },
  "components":[
    {"id":"region","type":"display_region","box":{"x":-384,"y":-36,"width":768,"height":72}},
    {
      "id":"track","type":"background","box":{"x":-288,"y":-8,"width":636,"height":20},
      "paint":{"kind":"texture","uv":{"x":0,"y":0,"width":1,"height":1},"fit":"stretch"}
    },
    {
      "id":"emblem","type":"background","box":{"x":-364,"y":-32,"width":60,"height":60},
      "paint":{"kind":"texture","uv":{"x":3,"y":0,"width":1,"height":1},"fit":"contain"}
    },
    {
      "id":"health_fill","type":"bar","box":{"x":-284,"y":-4,"width":628,"height":12},
      "range":{"value":{"var":"health"},"min":{"type":"double","value":0},"max":{"var":"maxHealth"}},
      "fill":{"kind":"texture","uv":{"x":1,"y":0,"width":1,"height":1},"fit":"stretch"},
      "direction":"left-to-right","smoothMs":120,
      "trail":{"paint":{"kind":"texture","uv":{"x":2,"y":0,"width":1,"height":1},"fit":"stretch"},"delayMs":250,"durationMs":350}
    },
    {
      "id":"shield_fill","type":"bar","box":{"x":-284,"y":16,"width":628,"height":4},
      "range":{"value":{"var":"shield"},"min":{"type":"long","value":"0"},"max":{"var":"maxShield"}},
      "fill":{"kind":"texture","uv":{"x":2,"y":1,"width":1,"height":1},"fit":"stretch"}
    },
    {
      "id":"title","type":"text","box":{"x":-284,"y":-36,"width":628,"height":24},
      "fontSize":18,"color":"#FFFFFFFF","align":"center","verticalAlign":"middle","shadow":true,
      "runs":[{"var":"bossName","format":"string"},{"text":"  目标："},{"var":"targetName","format":"string"}]
    },
    {
      "id":"health_text","type":"text","box":{"x":-284,"y":-9,"width":628,"height":22},
      "fontSize":14,"color":"#FFFFFFFF","align":"center","verticalAlign":"middle","shadow":true,
      "runs":[
        {"var":"health","format":"compact","digits":1},{"text":"（"},
        {"ratio":{"value":{"var":"health"},"min":{"type":"double","value":0},"max":{"var":"maxHealth"}},"format":"percent","digits":1},
        {"text":"）"}
      ]
    },
    {
      "id":"rage_flame","type":"background","box":{"x":-276,"y":23,"width":608,"height":8},
      "visible":{"var":"enraged"},
      "paint":{
        "kind":"texture","uv":{"x":0,"y":1,"width":1,"height":1},"fit":"stretch",
        "animation":{"mode":"loop","phaseMs":0,"frames":[
          {"uv":{"x":0,"y":1,"width":1,"height":1},"durationMs":100},
          {"uv":{"x":1,"y":1,"width":1,"height":1},"durationMs":100}
        ]}
      }
    }
  ]
}
```

该例含一个显示区域、三个背景、两个条和两个文本，全部 box 在显示区域内，所有 UV 在唯一 PNG 内。模拟 health/maxHealth 为 1200000/1200000、420000/1200000、0/1200000，检查 100%、35%、0%；打开 enraged 检查 UV 动画。另以 `9223372036854775807` 测试 long 文本精度，模拟值始终是本机预览状态。

## 7. WebUI 编辑体验

### 7.1 工作区布局

设计/JSON 视图编辑同一份草稿，沿用现有文件树、页签、停靠面板与保存状态。设计区的“无限画布”和“游戏输出预览”分开呈现，作者可以始终识别显示区域边框。

| 区域 | 内容与操作 |
| --- | --- |
| 左侧 | `.bossbar` 文件树；唯一显示区域的固定条目；多个背景/条/文本图层 |
| 中央 | 无限网格、原点、显示区域轮廓；平移、缩放、框选、拖拽、吸附和方向键微调 |
| 右侧 | 组件几何、变量绑定、格式；显示区域选中时编辑 AABB；素材选中时查看唯一图集 |
| 图集面板 | PNG 上传/替换、Base64 粘贴、图集放大、UV 框选和精确像素输入、帧列表 |
| 下方 | 按显示区域裁出的游戏预览、GUI 尺寸模拟、时间轴、播放/暂停/逐帧、类型化测试变量 |

普通组件支持复制、删除、排序和编辑锁定，复制产生新 ID。显示区域不能复制、删除或新建第二个；只能调整已有区域。多选拖动遵循 AABB 包含约束；拖动显示区域本身与“整体移动”采用明确分开的操作，避免误移动全部内容。

提供“定位显示区域”“适配选中组件”和“回到原点”，使无限画布远距离平移后仍可快速找回内容。窄窗口中属性和图集可切为页签，不缩掉游戏预览中的显示区域边界。锁定、临时隐藏、相机、网格、参考底图和面板布局均为本机状态。

### 7.2 类型化变量和 UV 编辑

变量面板展示变量名、Map 键、long/double/bool/string 类型、默认值、模拟值和引用组件。来源固定显示为 `blackboard.bossbar`，没有任意黑板字段或 Actor 属性选择器。long 使用十进制文本输入和精确校验，禁止浏览器数值输入控件先把超大整数变成 Number。

修改变量名时同步更新本文件引用，作为一个撤销步骤；删除被引用变量须先列出受影响位置并由作者替换为同类型常量或取消。模拟器按类型输入，必须能复现缺失键、类型不符、long 极值和同范围不同数值，不执行 Python。

每个纹理 paint 在图集上框选 UV，也可输入 x/y/width/height。序列编辑支持复制一帧、框选后续 UV、按行列自动展开、重排、设置时长和循环方式。UV 编辑限制在图片内，预览显示像素坐标与当前帧；帧切换保持目标组件 box 不变。

图集替换是一项文档编辑，图片数据和全部 UV 共同组成一个草稿版本。图片损坏、UV 越界、显示区域缺失/重复或组件越界时，诊断能定位到具体组件或帧。设计视图不允许提交这些非法状态；源码视图保留错误原文和上一次有效预览，并标明预览版本。

### 7.3 保存、协作与单文件往返

保存继续走 `useProjectSession → 草稿 → saveProjectToDirectory → EditTransactions → S`。内嵌 PNG 与组件都是同一个 `.bossbar` 的正文，一次版本检查和文件事务提交，不另存 PNG，不建立外部图片引用。全局保存、另存和导出入口共用文档校验，非法编辑保留本机草稿，允许原文导出用于修复，但不能标记为已保存的有效模板。

只读成员能预览、平移画布和调整模拟值，不能修改共享文档。版本冲突保留完整草稿，不用最新版本号包装旧内容覆盖。由于 Base64 可能较长，JSON 编辑器可折叠 texture 字段，不能通过省略或占位符把真实纹理数据写坏。

文件改名、删除、远端移除、切换工程遵循现有 resourceLifecycle。异步解码与 UV 预览携带原工程、文档和纹理 hash，过期结果不得覆盖当前图集。撤销图集替换应恢复旧 Base64 和关联 UV；已解码图集按 hash 复用，避免每次拖动复制像素数据。

## 8. 单文件编译与资源交付

新增专用编译器，校验显示区域、全部组件、变量类型、唯一图集和 UV 后输出规范 v2 文档。运行文件仍然是一份带 Base64 的 `.bossbar`，放在 shared 平面，服务端和客户端使用相同字节。

| 产物 | PAK 路径 | 平面 |
| --- | --- | --- |
| 完整 BossBar 文档（含唯一 PNG） | `bossbars/<文件名>.bossbar` | shared |
| Actor 模板和 Python | 既有 `actors/…`、`script/actor/…` | server，沿用既有编译器 |

不生成 BossBar 专用外部 PNG、资源清单或旁路图集文件。server 包因 shared 文档也带有内嵌图片字节，这是保留单文件协议的明确选择；服务端不上传 GPU 纹理。文档复制、改名和分发不受外部图片移动影响。

规范文档显式补齐默认值，Base64 采用无空白的标准编码，按固定序列化规则输出 UTF-8。`templateHash=SHA-256(实际编译文档字节)`，覆盖图片、变量与布局；hash 存在目录/实例元数据中，不回写进被散列的文档。两端读取同一份编译字节计算 hash，避免各自序列化造成差异。客户端可另以 PNG 字节 hash 去重 GPU 纹理，但这不是第二份源资产。

服务端检查文档结构、Base64、PNG 签名/结构/尺寸、预算、UV 和 AABB，使用 server-safe 校验代码；客户端还进行有界像素解码与纹理创建。声明为 PNG 的 APNG 多帧数据拒绝，动画必须来自显式 UV 序列。不得只检查 Base64 前缀就将损坏数据视为已加载。

加载器准备完整候选后原子切换。新文档或纹理解码失败保留旧快照；旧 PAK 挂载关闭后，旧快照仍持有有效字节或纹理引用，不能混入新同名资源。未被引用的旧纹理在正确客户端线程释放。

自动发版复用既有门户和密码配置。上传成功后检查 BossBar kind、当前 hash 和画面，特别处理 RETAINED。本机客户端发版不更新远端 dedicated 服务端；分端验收分别安装 server/client 包并比对同一 `.bossbar` 的 hash。预览相机、模拟值和用户参考截图不进入 PAK。

## 9. 游戏接入与同步协议

### 9.1 模块职责

拟新增 `feature.bossbar` 模块，供 Actor 选择模板并生成显示实例。组件模型、范围计算、格式化、帧选择和校验保持为可单测的纯逻辑；具体包名可按现有代码组织调整，职责不得跨端。

| 层 | 拟新增内容 |
| --- | --- |
| 纯数据与规则 | `BossbarDocument/Validator/ValueResolver/FrameSampler`，含 AABB 与 UV 校验 |
| 服务端 | `BossbarCatalog`、`BossbarVariables`、实例生命周期、Java Map 投影、观看者跟踪和快照发送 |
| `network/` | `bossbar-1` 通道、DTO、codec、版本与大小限制 |
| `client/` | 单图集缓存、客户端实例、AABB 布局、背景/条/文本 renderer 和收包处理；显示区域本身不绘制 |
| Actor 适配 | 扩展 `ActorBossBar` 与 `ActorScriptHost`，连接脚本 API、黑板和会话生命周期 |

网络注册遵循项目 [客户端/服务端分离方针](../../../../ModRPGToolKit/docs/development/客户端服务端分离.md)：共享层不能引用 `Minecraft.getInstance()` 或任何 client 类型；客户端 handler 在 `Dist.CLIENT` 入口注册。首版沿用 NeoForge payload，不增加 Paper 实现或通用运输 SPI。

### 9.2 实例与观看者

一个 Actor 会话仍托管一条 BossBar，其唯一显示区域内可以包含多个背景、数值条和文本。模板是共享定义，实例有独立 UUID，不能仅以模板 ID 或实体数值 ID 当作运行时身份。实例记录 Actor UUID、维度、模板 ID/hash、原版 BossEvent UUID、起始 tick、优先级和最新变量投影。

观看者来自服务端的真实实体追踪关系。当前 `seedViewers` 使用距离估算，接入自定义模式时应改为真实追踪集合，或由持续跟踪事件建立索引；不能因某玩家距离接近就泄露该玩家尚未追踪的 Actor 黑板。迟加入者立即收到完整快照，不等待字段下一次变化。玩家停止追踪、切维度、退出、Actor 确认死亡或移除、会话重建与服务器停止时清除相应显示。

死亡默认显示最后零值最多到下一服务端 tick，之后移除；可取消的死亡 hook 不应提前清除。重绑或 PAK reload 导致 Actor 会话重建时，旧实例发 remove，新实例使用新 UUID 和起始时间，黑板仍遵循既有会话重置规则，不额外持久化。旧实例的迟到消息不能使新会话的血条复活。

### 9.3 `bossbar-1` 线协议

首版传有界的完整变量快照，暂不使用需要基线拼接的字段 delta。每个连接有新的 `connectionEpoch`，每个下行消息有单调递增 `seq`。客户端只接受当前连接 epoch 且序号更新的消息；连接切换时清空实例和序号。NeoForge 传输有序，异步资源加载还须核对实例 UUID 和最新 hash。

| 消息 | 必需业务字段 | 行为 |
| --- | --- | --- |
| `UPSERT` | instanceId、actorUuid、dimension、vanillaEventId、templateId、templateHash、startTick、sampleTick、priority、visible、values | 新建或整体替换该实例的变量视图 |
| `REMOVE` | instanceId、reason | 删除实例；普通更新不得重建已经失去追踪的实例 |
| `REPLACE_ALL` | sampleTick、该连接当前有权看到的完整实例数组 | 替换当前集合，删除列表之外的实例；登录就绪和恢复时发送 |

`REPLACE_ALL` 分批运输固定使用 `batchId/partIndex/partCount`，单批片段不超过 32KiB，总体不超过 512KiB，最多 32 片。接收端最多缓存一个待组装批次，2 秒超时丢弃；收齐并校验后才原子替换。服务端连续发送一个批次，暂存期间的变化紧接在批次后发送；客户端若已采纳序号更高的状态，不得用较旧批次回滚。连接退出即释放组装缓存。即使当前运输层允许大包，也采用相同分片规则。

`values` 按模板变量名携带明确的 long/double/bool/string 类型标签。二进制 codec 使用有符号 64 位整数、binary64、布尔值和有界 UTF-8；JSON 形式的模拟/诊断数据中 long 必须为十进制字符串。缺失或不匹配已经在服务端采用声明默认值，客户端再检查类型与大小。实例消息不传 Base64 PNG，图集随 PAK 预装；客户端没有写入 BossBar Map 或任意请求其他 Actor 投影的上行入口。

正常采样可随服务端 tick 执行；数值变化合并发送，默认上限每实例 10 次/秒。首次出现、模板变更、显隐和移除立即发送；变化很多时保留最后一份状态。每 2 秒发送一次 `REPLACE_ALL` 校准集合，即使 Actor 没有数值变化也能清理残留。资源就绪恢复不需要重发黑板，客户端使用最新完整快照。动画帧号从时钟计算，不逐帧发包。

从宿主持有的 BossbarVariables 取得一次不可变快照，过滤当前模板声明的键，无变化不广播；不进入 Python 遍历黑板属性。原版 `ServerBossEvent` 自身仍按其既有网络行为维护回退数据，10 次/秒约束针对新增自定义通道。发送前检查对方是否有本功能通道；没有通道时只发送原版事件。

### 9.4 原版回退和布局

保留每个 Actor 的原版 BossEvent。客户端只有在自定义实例、模板 hash 和内嵌图集均就绪时，才抑制对应 `vanillaEventId` 的原版条目并绘制自定义条。等待加载、未知版本、资源缺失和 hash 不一致时保留原版；运行中资源失效时同帧恢复原版。原版音乐、雾与暗屏计算继续读取原 BossEvent。

禁止隐藏整个原版 BOSS_OVERLAY，否则会误伤末影龙、凋灵和其他模组血条。实施时先核实当前 NeoForge 单条 BossBar 渲染钩子的取消与纵向增量能力；优先在原版单条布局位置替换，并返回唯一显示区域缩放后的实际行高；不按图层并集或当前可见像素计算。若钩子不能满足，则用范围明确的单条渲染适配维护同一布局游标，原版条目继续调用原绘制路径。这一接线点需要阶段二在当前版本代码中验证，不在方案里虚构方法签名。

多条自定义血条按优先级降序、首次可见次序、实例 UUID 排序，避免随距离抖动。排序与原版行布局统一处理：保留非自定义条目的相对顺序，自定义条目的槽位按上述顺序填入；每行使用自身实际高度，不能压在其他原版或自定义血条上。默认最多显示 3 条自定义血条；屏幕高度不足时继续减少，在队列尾显示“另有 N 个首领”。未展示实例仍维护最新状态，轮到显示时无需重新订阅。

HUD 隐藏时停止绘制但保留状态；退出世界必须清空。游戏暂停、GUI 缩放、窗口尺寸变化和资源重载均须重新计算布局，不能累积旧位置或旧纹理引用。

### 9.5 首版预算

以下为拟定限制和验收基线，不是已有性能结论。无限画布表示编辑空间可自由平移，输出尺寸由显示区域单独控制；预算约束具体输出和内存分配。

| 项目 | 初始限制 |
| --- | --- |
| 显示区域数量 | 必须为 1；宽高最大 4096×1024 设计像素 |
| 可绘制组件 / 声明变量数 | 128 / 64，背景、条、文本均可重复添加 |
| 每 Actor 的 BossbarVariables | 最多 256 键；string 最多 256 Unicode 码点，数值保留完整 long/double 类型 |
| 每份文档的图片数量 | 严格为 1；静态 PNG，最大 4096×4096、PNG 文件字节最多 4MiB |
| `.bossbar` 完整正文 | 最多 6MiB UTF-8，包含 Base64；非纹理元数据最多 256KiB |
| 单序列帧数 / 单帧时长 | 256 / 16–60000ms |
| 单图集像素内存 / 全局纹理缓存 | 64MiB / 128MiB，按 PNG hash 共享和引用计数回收 |
| 单次 UPSERT | 最多 32KiB；最坏实例编码预留为 30KiB；不带图片 |
| 每玩家同步实例数 | 最多 16，移出集合发 REMOVE，其余使用原版条目 |
| REPLACE_ALL | 总量最多 512KiB，按编号片段收齐后原子替换 |

Base64 会使 PNG 字节量约增加三分之一，原草案的 256KiB 文档上限不再适用。当前工程 S 单文件限制为 32MiB（[files.rs](../../../src-tauri/crates/project-core/src/files.rs)）；本方案使用更小的 6MiB 预算，实施时仍须验证 HTTP 请求封装、草稿存储与历史往返的总开销。

编译器按字符串 maxLength、变量名和实际 codec 计算最坏快照预算，超限文档须缩减声明，不等战斗发生后丢包。PNG 解码前检查尺寸、压缩字节与目标内存；帧循环只做时钟、UV 和绘制，不解码、读盘、访问 Python 或复制 Base64。性能记录包含基线机器、GUI 尺寸、组件与实例数、纹理内存、容器快照及渲染耗时。

## 10. 分阶段实施

### 10.1 协议准备

开始编码时先把第 3–6、8–9 节整理成 schema 与协议夹具，锁定字段默认值、数值边界、取帧规则和输出目录。协议准备属于第一阶段前置工作，不单独启动游戏开发，也不增加一次用户审批。

交付一份可机器校验的 v2 schema、一份 v1 迁移夹具、至少一份自包含演示文档，以及 TS/Java 共用的输入与期望结果。schema 定义结构，配套语义校验器验证显示区域数量、跨组件包含关系、PNG/UV、引用和数值类型；两端通过同一批夹具。旧草案已有的 schema、类型、测试及生成物必须整体对齐新版，不能仅修改文字说明。

夹具至少涵盖唯一显示区域、负坐标与 AABB 包含、单张 Base64 PNG、UV 越界、long 极值、数值类型、默认值、九宫格和动画边界。例如 4 帧各 100ms 的 loop 序列在 `0/99/100/399/400ms` 分别取 `0/0/1/3/0`；相同序列 pingpong 的帧序为 `0,1,2,3,2,1`，600ms 回到 0。布局输出可以比较矩形和裁切命令，字体字形差异单列，不用模糊的“看起来一致”代替数值规则。

### 10.2 阶段一：WebUI 编辑器与预览

目标是让作者在没有游戏连接的情况下完成编辑、保存、重新打开和动画预览，并导出可供下一阶段使用的 PAK。

| 顺序 | 工作 | 完成条件 |
| --- | --- | --- |
| W1 | v2 类型、schema、语义校验、默认文档、v1 迁移 | 新建即有一个显示区域和一张透明 PNG；未知版本保留原文 |
| W2 | 类型化取值、精确 long、范围、格式化、AABB 归一化、UV 取帧 | 通过协议夹具；没有对任意黑板或 Actor 属性的访问路径 |
| W3 | 背景、条、文本的浏览器 renderer | 共用唯一图集，静态 UV/动画 UV、九宫格、四方向裁切、尾条和文本可组合 |
| W4 | 无限画布、唯一显示区域、属性、图层、撤销和源码切换 | 组件拖拽/缩放受区域约束；整体移动保持相对位置；JSON 错误保留草稿 |
| W5 | Map 变量模拟、UV 编辑、时间轴、单 PNG 上传/粘贴 | 可演示四种值类型、满血、受伤、护盾、狂暴、空目标和长名称 |
| W6 | 单文件草稿/事务/资源生命周期 | Base64 与组件一次提交；替换/撤销/重开一致；viewer、冲突和切工程行为正确 |
| W7 | 单文件编译器、client/server/combined 导出 | 三种包中的 BossBar shared 字节一致；没有外链 PNG/清单；模拟数据不入包 |
| W8 | 演示图集与预览验收 | 参考构图模板和简单测试模板各自只内嵌一张 PNG，都有一个显示区域和多个可绘制组件 |

拟改动或新增的入口：

| 位置 | 任务 |
| --- | --- |
| `src/workspaces/audiovisual/bossbar.ts` | 从 v1 种子扩展到版本分派与迁移入口 |
| `src/workspaces/audiovisual/bossbar/` | 文档模型、语义校验、单图集/UV、无限画布、AABB 与编辑面板 |
| `src/workspaces/AudiovisualWorkspace.tsx` | 接入设计/JSON，复用已有页签、保存和生命周期 |
| `src/export/compile/compilers/bossbar.ts`（拟新增） | 验证自包含文档并输出 shared `.bossbar` |
| `src/export/compile/compilers/registerBuiltin.ts` | 注册专用编译器，BossBar 无外部图片资产 pass |
| `src/help/docs/audiovisual-workspace.md` | 阶段一完成后更新真实用法和能力边界 |

阶段一不修改 Mod 玩法代码。浏览器 renderer 推荐采用 Canvas 2D；编辑选框和手柄可用 DOM 覆盖层。每帧只重绘活动预览，隐藏页签暂停浏览器动画循环；数值计算与取帧不依赖 DOM。已有依赖能满足时不引入完整可视化画布框架。

阶段一必须实际检查以下用例：

- 新建文档恰有一个显示区域；添加多个背景、多个条和多个文本。缺失/重复显示区域、任意组件越界都拒绝；边界相切合法，隐藏组件也校验。
- 将显示区域与全部组件整体移动到负坐标，游戏预览保持相同；无限画布平移不改变输出。缩小显示区域不会静默裁切越界内容。
- 使用同一张内嵌 PNG 组合参考构图，背景和条填充都能播放 UV 序列；检查不同组件使用不同 UV、相同 UV 和独立动画。
- 血量依次设为 100%、35%、0、超过上限和负数，检查裁切、文本、尾条；最大值为 0 时无 NaN 或异常绘制。
- 测试静态 UV、行列切帧和手动帧列表，暂停、逐帧、拖动时间轴后结果可复现；帧 UV 越界或尺寸不一致能定位到具体帧。
- 变量入口只能选择 BossBar Map 键和 long/double/bool/string；测试缺失、类型不符及默认值，long 的最小/最大值和超过 2^53 的相邻整数往返不丢位。
- 验证 bool 不隐式当整数、long/double 不混用；中文、emoji、长名称与文本阴影始终位于组件 box 内。
- 拖动后撤销、源码编辑后切回、保存后重开、改名后续编，内容保持一致；无效源码不会被预览反向覆盖。
- 两个窗口并发编辑同一文件，后提交的旧版本收到冲突并保留草稿；只读成员能模拟预览且不能保存文档。
- 缺少 texture、额外纹理字段、损坏 Base64/PNG、APNG、UV 越界、重复 ID、AABB 越界和预算超限阻止保存为有效文档与导出。
- PNG 替换后 UV 越界不提交；撤销恢复图片与 UV。上传和粘贴同一 PNG 得到相同规范 Base64，保存重开仍只有一张图。
- 比较 client/server/combined 包内 `.bossbar` 字节和 hash，确认 PNG 已内嵌且无需任何外部图片；参考截图、编辑相机、时间轴和模拟值不入包。

执行前端构建和改动涉及的现有工程边界、资源生命周期检查；新增协议与渲染规则测试。浏览器交互验收按本机偏好使用 ego lite 的独立任务空间，届时先读取 ego-browser 技能。沿用既有测试脚本时检查其浏览器启动方式，不能为方便验收另起旧 Playwright Chromium。

### 10.3 检查点一：停止并打开 WebUI

W1–W8 和阶段一检查完成后，执行以下动作，然后结束开发回合：

1. 使用隔离演示工程，运行 WebUI 的 `npm run dev`，同时启动 Vite 与工程服务 S；按启动日志记录实际 URL，端口冲突时不抢占用户进程。
2. 通过 ego lite 打开页面，加载演示工程，切到“视听效果 → 演示 BossBar → 设计”，定位显示区域，展开 UV 图集、变量和时间轴面板。
3. 预置能立即观察的受伤/回血与狂暴动画，并提供可点击的场景按钮；用户无需先导入文件或补填路径。
4. 保持页面和必要进程运行，交付 URL、演示工程路径、截图、已验证项目及已知限制。记录启动进程身份，便于后续只管理本任务进程。
5. **停止新增功能与 Mod 开发，等待用户在当前预览上提出修改或明确要求进入游戏阶段。** 收到 WebUI 修改意见时先修复本阶段并重新展示，不自动进入下一阶段。

如果依赖、端口或工程加载失败，先排查到可实际打开；仍无法运行时明确说明失败点和缺少条件。仅给出启动命令、静态截图或“构建通过”，不能将此检查点标记为完成。用户接管浏览器后停止浏览器操作，按本机浏览器规范等待明确交还。

### 10.4 阶段二：游戏实装

只有检查点一得到用户继续指令后才开始。沿用已验收的协议和演示文件；涉及文件格式、坐标或帧时序的修改必须同步 WebUI，并重新跑对应夹具，不能让两端开始分叉。

| 顺序 | 工作 | 完成条件 |
| --- | --- | --- |
| G1 | Java 模型、单 PNG/UV/AABB 校验、精确 long 和 PAK kind | 与阶段一夹具一致；纯逻辑不依赖 client 包 |
| G2 | 自包含模板目录、hash 和重载快照 | dedicated 加载带内嵌 PNG 的 server PAK，不创建 GPU 纹理；失败保留旧快照 |
| G3 | Java BossbarVariables 注入、四类写入/读取、句柄和真实追踪 | 每会话独立、脚本间共享、只读 bossbar 属性、tick 后读取 Java 快照；任意黑板字段不参与 |
| G4 | `bossbar-1` 同步及生命周期 | 迟加入收到完整状态；移除、重绑、退出无残留；无通道正常回退 |
| G5 | 单图集缓存、UV 动画、AABB 布局、组件渲染、原版单条替换 | 原点归一化与预览一致，区域决定行高，其他原版血条可共存 |
| G6 | 字体、GUI 缩放、资源失效和性能调整 | 长文本可读；尺寸变化无重叠；帧循环无解码/I/O |
| G7 | 集成演示、自动发版和最终预览 | Actor 脚本向 bossbar Map 写入真实生命与其他变量，打开可交互游戏画面 |

重点改动入口为 Mod 的 `feature/actor/script/ActorBossBar.java`、`ActorScriptHost.java`、`ActorScriptApi.java`、`ActorPython.java`，以及新 `feature/bossbar/`。PAK 注册复用 `core/pak/PakBootstrap` 的处理器机制；HUD 接线参考现有 `feature/subtitle/client` 和区域预览层的当前版本写法，不能直接复制旧版 Minecraft 渲染签名。脚本宿主仍统一处理超时和串行进入，不为 BossBar 再建一个 Python 运行时。

新增测试按项目现有 JUnit、GameTest 和客户端验收职责拆分。GameTest 必须包含函数、集中注册与实例 JSON，不进入发行 JAR。执行目标包括：

- JUnit：Java 容器操作与失效句柄、四类值、完整 long 范围、PNG 验证、UV、唯一显示区域与包含规则、格式/帧时序、codec 和快照切换。
- Python 宿主集成：真实 GraalPy 调用 Java Map、四类值转换与错误类型拒绝；只读 bossbar 属性、多脚本共享、普通黑板字段隔离、会话重建/旧引用失效、init 顺序与同 tick 写后采样。
- GameTest：Actor 绑定/重绑、追踪加入/离开、死亡取消与确认死亡、清会话、不同维度、独立实例、资源重载和 dedicated 服务端边界。
- 原生客户端：同图不同 UV、UV 动画、九宫格、文本、尾条、负坐标 AABB、GUI 缩放、多组件、多 Boss 与原版条目共存；用实际画面验收。
- 分端联机：至少一名观看者先进入、另一名后进入，再分别离开；server/client 分包、缺失/旧资源、断线重连和资源重载，验证不会显示其他实例或其他会话的数据。

基础命令沿用 Mod 的 `./gradlew build`、目标 JUnit 与 `runGameTestServer`，运行前检查 Java 25。新测试选择器与隔离目录在实现时登记，不能在本文把尚未注册的测试名写成现成命令。构建通过、GameTest 通过和客户端画面通过分别记录；已知不相关基线失败注明复现证据，不改弱断言掩盖。

### 10.5 检查点二：停止并打开游戏

G1–G7 完成后，使用独立开发运行目录和演示世界启动实际 Minecraft 客户端，装入与 WebUI 相同的演示模板。既有 `./gradlew runClient` 是入口；隔离运行目录按当前 Gradle 配置增加命名开发 run 或使用项目已有支持方式，禁止覆盖用户已有世界来省去配置。

演示场景至少包含一只绑定脚本的首领和一个可重复触发变化的测试入口。测试脚本放在示例工程或测试资源中，具有以下场景：

| 场景 | 用户可观察的结果 |
| --- | --- |
| 满血与空目标 | 徽记、完整血条、默认“无”目标、正确数字 |
| 一次受伤与连续受伤 | 真实生命减少，主条平滑收缩，尾条按规则追赶 |
| 修改 blackboard.bossbar 的护盾/目标名/狂暴键 | 护盾长度、文本和 UV 动画显隐随 Map 改变；普通黑板同名字段不产生影响 |
| 两个同模板 Actor | 共用贴图，各自拥有独立数值、名称和生命周期 |
| 原版 Boss 与自定义 Boss 同屏 | 只替换目标条目，各行没有重叠 |
| 离开追踪、重新进入、死亡与重绑 | 及时移除、重新接收快照，无旧会话残影 |
| 替换内嵌图集后发版、故意损坏 PNG 或 UV | 新版本成功可见；失败有诊断并保留旧版或回退原版 |

将游戏窗口置于演示场景，保留 WebUI 供对照。原生游戏窗口操作使用 computer-use，网页继续使用 ego lite。交付客户端实际运行状态、演示世界与工程路径、操作入口、截图和分层验收记录；不能用浏览器模拟画面替代游戏验收。

**打开并确认演示可操作后停止开发，等待用户验收。** 不自动进入更多 HUD 组件、额外视觉特效、发布或推送工作。若游戏启动或场景加载失败，记录日志位置并修复；无法解决时如实保留为未完成检查点，不能用编译成功替代。

## 11. 完成判定与交付物

本轮方案修订只修改文档。后续开发的完成条件是：自包含 `.bossbar` 能在无限画布中编辑，且恰有一个显示区域包住全部组件；所有图像与动画来自其唯一 PNG 的 UV；实际 Actor 的 Java BossBar Map 驱动显示。两个检查点均须打开可操作预览，并由用户决定后续动作。

| 阶段 | 必须留下的成果 |
| --- | --- |
| 协议准备 | v2 schema/语义校验、唯一 AABB 与单 PNG/UV 规则、Java Map 契约、类型化网络定义和跨语言夹具 |
| WebUI | 无限画布、唯一显示区域、多组件、单图集/UV 编辑、四类型模拟、源码往返、自包含演示文件、三类 PAK 和运行中的预览 |
| 游戏 | Java BossbarVariables、协议解析、单图集/UV 渲染、AABB 布局、同步与回退、示例 Actor/脚本、独立演示世界和运行中的客户端 |
| 维护文档 | WebUI 现行用法、Mod BossBar 契约、Actor API、网络版本和实际验收记录；本方案保留为设计记录 |

实施时重点验证当前 NeoForge 单条替换的行高接线、GraalPy 与 Java 四类值的无歧义转换、内嵌大文档的事务往返，以及游戏字体与浏览器的差异，分别在 G5、G3、W6、G6 处理。普通黑板读取、多图外链或忽略显示区域均不能作为临时替代实现。
