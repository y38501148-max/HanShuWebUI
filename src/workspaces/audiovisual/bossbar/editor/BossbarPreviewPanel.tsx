import { useEffect, useMemo, useRef, useState } from 'react'
import { isDisplayRegion, type BossbarAnimation, type BossbarDocument, type BossbarPaint, type BossbarUv, type BossbarValueMap } from '../protocol'
import { buildScene, type BossbarBarView } from '../render/scene'
import { drawBossbarScene } from '../render/canvas'
import { placeRegion } from '../rules/layout'
import { animationCycle, sampleAnimation, stepAnimationFrame } from '../rules/frames'
import { Button, Empty, NumberField, Row, SelectField } from './BossbarEditorUi'
import { createTextMeasurer } from './useBossbarImages'
import type { BossbarScenario } from './editorState'

/**
 * 游戏输出预览：按显示区域裁出的画面 + GUI 尺寸模拟 + 时间轴与场景按钮。
 *
 * 只使用显示区域的 AABB：坐标归一化与游戏一致——组件屏幕位置为
 * screenX + (x - rx) * s，screenY 为行首 + (y - ry) * s。
 */

const GUI_PRESETS = [
  { label: '1280×400 / GUI 2', width: 640, height: 200 },
  { label: '1920×1080 / GUI 2', width: 960, height: 540 },
  { label: '1920×1080 / GUI 3', width: 640, height: 360 },
  { label: '2560×1440 / GUI 3', width: 853, height: 480 },
]

export function BossbarPreviewPanel({
  document,
  values,
  bars,
  timeMs,
  playing,
  speed,
  guiWidth,
  texture,
  textureImage,
  issues,
  scenarios,
  onPlayingChange,
  onTimeChange,
  onSpeedChange,
  onGuiWidthChange,
  onScenario,
}: {
  document: BossbarDocument
  values: BossbarValueMap
  bars: Record<string, BossbarBarView>
  timeMs: number
  playing: boolean
  speed: number
  guiWidth: number
  texture: { width: number; height: number }
  textureImage: CanvasImageSource | null
  issues: string[]
  scenarios: BossbarScenario[]
  active: boolean
  onPlayingChange: (playing: boolean) => void
  onTimeChange: (timeMs: number) => void
  onSpeedChange: (speed: number) => void
  onGuiWidthChange: (width: number) => void
  onScenario: (scenario: BossbarScenario) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const measure = useMemo(() => createTextMeasurer(), [])
  const region = document.components.find(isDisplayRegion) ?? null
  const [animationTarget, setAnimationTarget] = useState('')

  const animations = useMemo(() => {
    const entries: { key: string; label: string; animation: BossbarAnimation; uv: BossbarUv }[] = []
    for (const component of document.components) {
      const add = (slot: string, paint: BossbarPaint) => {
        if (paint.kind === 'texture' && paint.animation) {
          entries.push({ key: component.id + '.' + slot, label: component.id + ' · ' + slot, animation: paint.animation, uv: paint.uv })
        }
      }
      if (component.type === 'background') add('背景', component.paint)
      if (component.type === 'bar') {
        add('填充', component.fill)
        if (component.trail) add('尾条', component.trail.paint)
      }
    }
    return entries
  }, [document.components])
  const selectedAnimation = animations.find((entry) => entry.key === animationTarget) ?? animations[0]
  const timeline = selectedAnimation ? animationCycle(selectedAnimation.animation) : 1000

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !region) return
    const ratio = window.devicePixelRatio || 1
    const placement = placeRegion(document.layout, region.box, guiWidth, 12)
    const height = Math.max(48, (placement?.height ?? 0) + 24)
    canvas.width = Math.round(guiWidth * ratio)
    canvas.height = Math.round(height * ratio)
    canvas.style.width = guiWidth + 'px'
    canvas.style.height = height + 'px'
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    const sky = ctx.createLinearGradient(0, 0, 0, height)
    sky.addColorStop(0, '#1b2a38')
    sky.addColorStop(1, '#0d1318')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, guiWidth, height)

    if (!placement) return
    ctx.save()
    ctx.beginPath()
    ctx.rect(placement.x, placement.y, placement.width, placement.height)
    ctx.clip()
    const scene = buildScene({
      document,
      values,
      timeMs,
      texture,
      bars,
      scale: placement.scale,
      origin: {
        x: placement.x - region.box.x * placement.scale,
        y: placement.y - region.box.y * placement.scale,
      },
    })
    drawBossbarScene(ctx, scene, { texture: textureImage, measure })
    ctx.restore()
    ctx.strokeStyle = 'rgba(120,180,255,0.35)'
    ctx.setLineDash([4, 3])
    ctx.strokeRect(placement.x + 0.5, placement.y + 0.5, placement.width - 1, placement.height - 1)
    ctx.setLineDash([])
  }, [bars, document, guiWidth, measure, region, texture, textureImage, timeMs, values])

  if (!region) return <div className="bb-preview"><Empty>没有显示区域，无法生成游戏预览。</Empty></div>

  const frameInfo = selectedAnimation ? {
    index: sampleAnimation(selectedAnimation.animation, selectedAnimation.uv, timeMs).index,
    total: selectedAnimation.animation.frames.length,
  } : null

  const step = (direction: -1 | 1) => {
    onPlayingChange(false)
    onTimeChange(selectedAnimation
      ? stepAnimationFrame(selectedAnimation.animation, timeMs, direction)
      : Math.max(0, timeMs + direction * 100))
  }

  return (
    <div className="bb-preview">
      <div className="bb-preview-head">
        <span className="bb-preview-title">游戏输出预览</span>
        <span className="bb-tag">
          显示区域 {Math.round(region.box.width)}×{Math.round(region.box.height)} · 缩放{' '}
          {document.layout.scale}
        </span>
        <span className="bb-preview-spacer" />
        <Button onClick={() => onPlayingChange(!playing)} variant={playing ? 'primary' : undefined}>
          {playing ? '暂停' : '播放'}
        </Button>
        <Button onClick={() => step(-1)}>◀ 帧</Button>
        <Button onClick={() => step(1)}>帧 ▶</Button>
        <Button
          onClick={() => {
            onPlayingChange(false)
            onTimeChange(0)
          }}
        >
          重置
        </Button>
      </div>
      <div className="bb-preview-canvas-wrap">
        <canvas ref={canvasRef} className="bb-preview-canvas" />
      </div>
      <div className="bb-preview-controls">
        {animations.length > 0 && <Row label="逐帧目标">
          <SelectField value={selectedAnimation.key} options={animations.map((entry) => ({ value: entry.key, label: entry.label }))}
            onCommit={setAnimationTarget} />
        </Row>}
        <label className="bb-preview-slider">
          <span>时间轴</span>
          <input
            type="range"
            min={0}
            max={Math.max(1000, timeline || 1000)}
            step={1}
            value={Math.min(timeMs, Math.max(1000, timeline || 1000))}
            onChange={(event) => {
              onPlayingChange(false)
              onTimeChange(Number(event.target.value))
            }}
          />
          <code>{Math.round(timeMs)}ms</code>
        </label>
        <label className="bb-preview-slider bb-preview-speed">
          <span>速度</span>
          <input
            type="range"
            min={0.1}
            max={2}
            step={0.1}
            value={speed}
            onChange={(event) => onSpeedChange(Number(event.target.value))}
          />
          <code>{speed.toFixed(1)}×</code>
        </label>
        <Row label="GUI 宽度">
          <NumberField value={guiWidth} min={64} max={4096} onCommit={onGuiWidthChange} />
        </Row>
        <select
          className="bb-input bb-preview-preset"
          value=""
          onChange={(event) => {
            const preset = GUI_PRESETS[Number(event.target.value)]
            if (preset) onGuiWidthChange(preset.width)
          }}
        >
          <option value="">常用分辨率…</option>
          {GUI_PRESETS.map((preset, index) => (
            <option key={preset.label} value={index}>
              {preset.label}
            </option>
          ))}
        </select>
      </div>
      <div className="bb-preview-scenarios">
        {scenarios.map((scenario) => (
          <Button key={scenario.id} onClick={() => onScenario(scenario)}>
            {scenario.label}
          </Button>
        ))}
        {frameInfo && (
          <span className="bb-tag">
            帧 {frameInfo.index + 1}/{frameInfo.total}
          </span>
        )}
      </div>
      {issues.length > 0 && (
        <ul className="bb-problems">
          {issues.slice(0, 6).map((issue, index) => (
            <li key={index}>{issue}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
