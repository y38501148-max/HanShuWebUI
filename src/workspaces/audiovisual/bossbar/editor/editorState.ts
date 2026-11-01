import { useCallback, useEffect, useRef, useState } from 'react'
import {
  defaultValueOf,
  isValueCompatible,
  parseLong,
  type BossbarDocument,
  type BossbarValue,
  type BossbarValueMap,
  type BossbarVariable,
  type BossbarVariableType,
} from '../protocol'

/**
 * 编辑器本机状态与撤销栈。
 *
 * 相机、网格、参考底图、临时锁定/隐藏和面板布局只保存在当前工程/文档的本机状态里，
 * 不写进 .bossbar，也不是共享工程数据。
 */

export type BossbarInspectorTab = 'component' | 'variables' | 'atlas'

export type BossbarEditorViewState = {
  zoom: number
  panX: number
  panY: number
  grid: number
  showGrid: boolean
  showRulers: boolean
  /** 本机临时锁定（不影响游戏） */
  locked: string[]
  /** 本机临时隐藏（不影响游戏显隐） */
  hidden: string[]
  /** 预览底图：工程内 assets/ 路径，仅本机参考 */
  referenceAsset: string | null
  referenceOpacity: number
  previewOpen: boolean
  previewGuiWidth: number
  previewGuiHeight: number
  playbackSpeed: number
  inspectorTab: BossbarInspectorTab
}

export const DEFAULT_EDITOR_VIEW: BossbarEditorViewState = {
  zoom: 1,
  panX: 0,
  panY: 0,
  grid: 8,
  showGrid: true,
  showRulers: true,
  locked: [],
  hidden: [],
  referenceAsset: null,
  referenceOpacity: 0.35,
  previewOpen: true,
  previewGuiWidth: 1280,
  previewGuiHeight: 400,
  playbackSpeed: 1,
  inspectorTab: 'component',
}

const STORAGE_PREFIX = 'hanshu.bossbarEditor.v2::'

function storageKey(projectId: string, fileId: string): string {
  return STORAGE_PREFIX + projectId + '::' + fileId
}

export function loadEditorViewState(projectId: string, fileId: string): BossbarEditorViewState {
  try {
    const raw = localStorage.getItem(storageKey(projectId, fileId))
    if (!raw) return { ...DEFAULT_EDITOR_VIEW }
    const parsed = JSON.parse(raw) as Partial<BossbarEditorViewState>
    return {
      ...DEFAULT_EDITOR_VIEW,
      ...parsed,
      locked: Array.isArray(parsed.locked) ? parsed.locked.filter((id): id is string => typeof id === 'string') : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden.filter((id): id is string => typeof id === 'string') : [],
      zoom: typeof parsed.zoom === 'number' && parsed.zoom > 0 ? parsed.zoom : 1,
      grid: typeof parsed.grid === 'number' && parsed.grid > 0 ? parsed.grid : 8,
      referenceOpacity:
        typeof parsed.referenceOpacity === 'number'
          ? Math.max(0, Math.min(1, parsed.referenceOpacity))
          : 0.35,
      inspectorTab:
        parsed.inspectorTab === 'variables' || parsed.inspectorTab === 'atlas'
          ? parsed.inspectorTab
          : 'component',
    }
  } catch {
    return { ...DEFAULT_EDITOR_VIEW }
  }
}

export function saveEditorViewState(
  projectId: string,
  fileId: string,
  state: BossbarEditorViewState,
): void {
  try {
    localStorage.setItem(storageKey(projectId, fileId), JSON.stringify(state))
  } catch {
    /* 无痕模式只保留内存 */
  }
}

/** 文档源码的撤销栈：设计视图与源码视图编辑同一份草稿，所以以字符串为步骤 */
export type BossbarHistory = {
  canUndo: boolean
  canRedo: boolean
  commit: (content: string) => void
  undo: () => string | null
  redo: () => string | null
  reset: () => void
  depth: number
}

const HISTORY_LIMIT = 128

export function useBossbarHistory(current: string): BossbarHistory {
  const [past, setPast] = useState<string[]>([])
  const [future, setFuture] = useState<string[]>([])
  const seenRef = useRef(current)
  const expectedRef = useRef<string | null>(null)

  useEffect(() => {
    if (current === seenRef.current) return
    const previous = seenRef.current
    seenRef.current = current
    if (expectedRef.current === current) {
      expectedRef.current = null
      return
    }
    expectedRef.current = null
    setPast((stack) => [...stack, previous].slice(-HISTORY_LIMIT))
    setFuture([])
  }, [current])

  const commit = useCallback(
    (content: string) => {
      if (content === current) return
      expectedRef.current = content
      setPast((stack) => {
        const next = [...stack, current]
        return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next
      })
      setFuture([])
    },
    [current],
  )

  const undo = useCallback((): string | null => {
    if (!past.length) return null
    const previous = past[past.length - 1]
    expectedRef.current = previous
    setPast(past.slice(0, -1))
    setFuture([...future, current])
    return previous
  }, [current, future, past])

  const redo = useCallback((): string | null => {
    if (!future.length) return null
    const next = future[future.length - 1]
    expectedRef.current = next
    setFuture(future.slice(0, -1))
    setPast([...past, current])
    return next
  }, [current, future, past])

  const reset = useCallback(() => {
    expectedRef.current = null
    setPast([])
    setFuture([])
  }, [])

  return {
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    commit,
    undo,
    redo,
    reset,
    depth: past.length,
  }
}

// -------------------------------------------------------------- 模拟数据与场景

export function defaultsForVariables(document: BossbarDocument): BossbarValueMap {
  const values: BossbarValueMap = {}
  for (const [name, variable] of Object.entries(document.variables ?? {})) {
    values[name] = defaultValueOf(variable)
  }
  return values
}

export type BossbarScenario = {
  id: string
  label: string
  values: BossbarValueMap
}

export type BossbarSimulationMode = 'value' | 'missing' | 'wrong-type'

export function variableSimulationMode(variable: BossbarVariable, value: BossbarValue | undefined): BossbarSimulationMode {
  return value === undefined ? 'missing' : isValueCompatible(variable, value) ? 'value' : 'wrong-type'
}

export function simulateVariable(
  values: BossbarValueMap,
  name: string,
  variable: BossbarVariable,
  mode: BossbarSimulationMode,
): BossbarValueMap {
  const next = { ...values }
  if (mode === 'missing') delete next[name]
  else if (mode === 'wrong-type') next[name] = variable.type === 'bool'
    ? { type: 'string', value: 'true' }
    : { type: 'bool', value: true }
  else next[name] = values[name] && isValueCompatible(variable, values[name]) ? values[name] : defaultValueOf(variable)
  return next
}

function numericMagnitude(variable: BossbarVariable): bigint | number | null {
  if (variable.type === 'long') {
    const parsed = parseLong(variable.default)
    return parsed
  }
  if (variable.type === 'double') return variable.default
  return null
}

function scaledValue(variable: BossbarVariable, factor: number): BossbarValue {
  const magnitude = numericMagnitude(variable) ?? 0
  if (variable.type === 'long') {
    const base = typeof magnitude === 'bigint' ? magnitude : BigInt(0)
    return { type: 'long', value: (base * BigInt(Math.round(factor * 1000))) / BigInt(1000) + '' }
  }
  const base = typeof magnitude === 'number' ? magnitude : 0
  return { type: 'double', value: base * factor }
}

/** 根据声明变量推导可点的场景按钮；没有数值变量时只给「默认值」 */
export function buildScenarios(document: BossbarDocument): BossbarScenario[] {
  const defaults = defaultsForVariables(document)
  const scenarios: BossbarScenario[] = [{ id: 'default', label: '默认值', values: { ...defaults } }]
  const names = Object.keys(document.variables ?? {})
  const numericNames = names.filter((name) => {
    const type = document.variables[name].type
    return type === 'long' || type === 'double'
  })
  if (!numericNames.length) return scenarios

  const healthName =
    numericNames.find((name) => /^(health|hp)$/i.test(name)) ?? numericNames[0]
  const maxName =
    numericNames.find((name) => /^max/i.test(name) && name !== healthName) ??
    numericNames.find((name) => name !== healthName) ??
    null
  const healthVariable = document.variables[healthName]

  if (maxName) {
    const maxVariable = document.variables[maxName]
    scenarios.push(
      { id: 'full', label: '满血', values: { ...defaults, [healthName]: defaultValueOf(maxVariable) } },
      { id: 'injured', label: '受伤 35%', values: { ...defaults, [healthName]: scaledValue(maxVariable, 0.35) } },
      { id: 'low', label: '残血 8%', values: { ...defaults, [healthName]: scaledValue(maxVariable, 0.08) } },
      {
        id: 'empty',
        label: '空血',
        values: {
          ...defaults,
          [healthName]:
            healthVariable.type === 'long' ? { type: 'long', value: '0' } : { type: 'double', value: 0 },
        },
      },
      { id: 'overheal', label: '超过上限', values: { ...defaults, [healthName]: scaledValue(maxVariable, 1.4) } },
    )
  } else {
    scenarios.push(
      { id: 'full', label: '满值', values: { ...defaults, [healthName]: defaultValueOf(healthVariable) } },
      { id: 'half', label: '一半', values: { ...defaults, [healthName]: scaledValue(healthVariable, 0.5) } },
      {
        id: 'empty',
        label: '零值',
        values: {
          ...defaults,
          [healthName]: healthVariable.type === 'long' ? { type: 'long', value: '0' } : { type: 'double', value: 0 },
        },
      },
    )
  }

  const boolName = names.find((name) => document.variables[name].type === 'bool')
  if (boolName) {
    scenarios.push({
      id: 'toggle-' + boolName,
      label: '切换 ' + boolName,
      values: { ...defaults, [boolName]: { type: 'bool', value: defaults[boolName]?.value !== true } },
    })
  }
  return scenarios
}

/** 长名字 / emoji / 空值等边界输入的快捷场景 */
export function edgeCaseScenarios(document: BossbarDocument): BossbarScenario[] {
  const defaults = defaultsForVariables(document)
  const stringNames = Object.keys(document.variables ?? {}).filter(
    (name) => document.variables[name].type === 'string',
  )
  if (!stringNames.length) return []
  const target = stringNames[stringNames.length - 1]
  return [
    {
      id: 'edge-long',
      label: '长名字',
      values: { ...defaults, [target]: { type: 'string', value: '被诅咒的赤焰守卫·终焉形态（第二阶段）' } },
    },
    { id: 'edge-emoji', label: 'emoji', values: { ...defaults, [target]: { type: 'string', value: '🔥赤焰守卫🔥 👑' } } },
    { id: 'edge-empty', label: '空字符串', values: { ...defaults, [target]: { type: 'string', value: '' } } },
  ]
}

/** 变量面板的类型化输入：返回新值或 null（输入不合法） */
export function parseVariableInput(
  variable: BossbarVariable,
  raw: string,
): BossbarValue | null {
  const trimmed = raw.trim()
  switch (variable.type) {
    case 'long': {
      const parsed = parseLong(trimmed)
      if (parsed === null) return null
      return { type: 'long', value: parsed.toString(10) }
    }
    case 'double': {
      if (!/^[+-]?(?:[0-9]+\.?[0-9]*|\.[0-9]+)(?:[eE][+-]?[0-9]+)?$/.test(trimmed)) return null
      const value = Number(trimmed)
      if (!Number.isFinite(value)) return null
      return { type: 'double', value }
    }
    case 'bool':
      return trimmed === 'true' ? { type: 'bool', value: true } : trimmed === 'false' ? { type: 'bool', value: false } : null
    default: {
      if ([...raw].length > variable.maxLength) return null
      return { type: 'string', value: raw }
    }
  }
}

export function defaultValueText(variable: BossbarVariable): string {
  switch (variable.type) {
    case 'long':
      return variable.default
    case 'double':
      return String(variable.default)
    case 'bool':
      return variable.default ? 'true' : 'false'
    default:
      return variable.default
  }
}

export const VARIABLE_TYPE_LABELS: Record<BossbarVariableType, string> = {
  long: 'long（64 位整数）',
  double: 'double（浮点）',
  bool: 'bool',
  string: 'string',
}
