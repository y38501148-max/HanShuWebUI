import assert from 'node:assert/strict'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { BossbarDesignView } from '../src/workspaces/audiovisual/bossbar/editor/BossbarDesignView'
import { updatePaintUv } from '../src/workspaces/audiovisual/bossbar/editor/editorPaint'
import { createBossbar, type BossbarTexturePaint } from '../src/workspaces/audiovisual/bossbar/index'

const render = (content: string, readOnly = false) => renderToStaticMarkup(createElement(BossbarDesignView, {
  content, readOnly, fileId: 'review', fileName: 'review.bossbar', projectId: 'review', packageId: null,
  assets: [], active: false, onChange: () => assert.fail('渲染不能反向修改源码'),
}))
const legacy = JSON.stringify({ format: 'hanshu.bossbar', version: 1, id: 'legacy' })
const legacyHtml = render(legacy)
assert.match(legacyHtml, /升级为可视化血条/)
assert.doesNotMatch(legacyHtml, /无法显示设计视图/)
assert.match(render(legacy, true), /<button[^>]*disabled[^>]*>升级为可视化血条<\/button>/)
assert.match(render('{broken json'), /无法显示设计视图/)
assert.match(render(JSON.stringify({ format: 'hanshu.bossbar', version: 99 })), /不支持 version 99/)
assert.match(render(JSON.stringify(createBossbar('review'))), /游戏输出预览/)
console.log('通过：首次打开 v1 显示升级入口，只读升级禁用，非法和未知版本保留原文')

const uv = { x: 0, y: 0, width: 8, height: 8 }
const second = { ...uv, x: 8 }
const moved = { ...uv, x: 24 }
const paint: BossbarTexturePaint = {
  kind: 'texture', fit: 'stretch', uv,
  animation: { mode: 'loop', phaseMs: 0, frames: [{ uv, durationMs: 100 }, { uv: second, durationMs: 200 }] },
}
const next = updatePaintUv(paint, moved, 1)
assert.equal(next.kind, 'texture')
if (next.kind === 'texture') {
  assert.deepEqual(next.uv, uv)
  assert.deepEqual(next.animation?.frames[0].uv, uv)
  assert.deepEqual(next.animation?.frames[1].uv, moved)
  assert.equal(next.animation?.frames[1].durationMs, 200)
}
const first = updatePaintUv(paint, moved, 0)
if (first.kind === 'texture') {
  assert.deepEqual(first.uv, moved)
  assert.deepEqual(first.animation?.frames[0].uv, moved)
  assert.deepEqual(first.animation?.frames[1].uv, second)
}
assert.deepEqual(paint.animation?.frames[1].uv, second, 'UV 编辑不修改旧草稿')
assert.equal(updatePaintUv(paint, moved, 9), paint)
console.log('通过：图集框选精确更新指定帧，第一帧与静态 UV 同步，旧草稿保持不变')
console.log('PASS verify-bossbar-design-view')
