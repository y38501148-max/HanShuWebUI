# 视听效果工作区

工作区 ID 为 `audiovisual`，与剧本（`stageplay`）、游戏性（`gameplay`）并列。工程读写仍经同一 `ProjectClient` 与文件事务；不要另开写通道。

## 资源分类

当前仅一个顶层分类：

| 分类 | 格式 | 物理目录 | 说明 |
| --- | --- | --- | --- |
| BOSS血条 | `.bossbar` | `src/bossbars/` | JSON 正文；首版用源码编辑器，可视化编辑器后补 |

资源类型登记在 `RESOURCE_TYPES`；业务分类在 `AUDIOVISUAL_CATEGORIES`（**不要**塞进 `GAMEPLAY_CATEGORIES`）。路径一律走 `sourcePathOf`。

## 编辑与保存

- 左侧资源管理器按分类列出 `.bossbar`；可新建、重命名、删除。
- 打开文档后以 Monaco JSON 编辑；`Ctrl+S` / 菜单「保存」走 `saveProjectToDirectory`。
- 布局、页签、折叠为本机状态（`hanshu.audiovisualUi.v1` 等）；共享虚拟文件夹首版未接入。

## 种子正文

新建种子形如：

```json
{
  "format": "hanshu.bossbar",
  "version": 1,
  "id": "新血条"
}
```

未知字段会被严格解析器拒绝；可视化字段契约确定后再扩展。

## 导出

未注册专用编译器时，由 identity 编译器原样写入 PAK 的 `bossbars/<名>.bossbar`（默认 client 平面）。
