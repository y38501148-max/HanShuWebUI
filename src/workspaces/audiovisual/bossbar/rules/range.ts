import type {
  BossbarNumericOperand,
  BossbarRange,
  BossbarValueMap,
  BossbarVariable,
  BossbarVariableType,
} from '../protocol'
import { parseLong } from '../protocol'

/**
 * 条与比例片段的统一规则。
 *
 * long 用精确整数相减后再转浮点（Java 侧 BigInteger），不先转 double 再相减；
 * double 用归一化写法防止 max-min 溢出。
 */

export type ResolvedRange = {
  type: 'long' | 'double'
  value: number
  min: number
  max: number
  ratio: number
  long: { value: bigint; min: bigint; max: bigint } | null
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0
  if (value <= 0) return 0
  if (value >= 1) return 1
  return value
}

/** double 比例：跨度溢出或为 0 时归一化处理 */
export function computeDoubleRatio(value: number, min: number, max: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(max)) return 0
  if (max <= min || value <= min) return 0
  if (value >= max) return 1
  const span = max - min
  if (Number.isFinite(span) && span > 0) {
    return clamp01((value - min) / span)
  }
  const scale = Math.max(Math.abs(max), Math.abs(min), Math.abs(value))
  if (!(scale > 0) || !Number.isFinite(scale)) return 0
  const scaledMin = min / scale
  const scaledMax = max / scale
  const scaledSpan = scaledMax - scaledMin
  if (!(scaledSpan > 0)) return 0
  return clamp01((value / scale - scaledMin) / scaledSpan)
}

/** long 比例：精确整数相减，边界处理后才转浮点 */
export function computeLongRatio(value: bigint, min: bigint, max: bigint): number {
  const span = max - min
  if (span <= BigInt(0)) return 0
  if (value <= min) return 0
  if (value >= max) return 1
  return clamp01(Number(value - min) / Number(span))
}

type OperandValue =
  | { type: 'long'; value: bigint }
  | { type: 'double'; value: number }

function operandValue(
  operand: BossbarNumericOperand,
  variables: Record<string, BossbarVariable>,
  values: BossbarValueMap,
): OperandValue | null {
  if ('var' in operand) {
    const variable = variables[operand.var]
    if (!variable) return null
    const value = values[operand.var]
    if (!value) return null
    if (variable.type === 'long') {
      const parsed = parseLong((value as { value?: unknown }).value)
      return parsed === null ? null : { type: 'long', value: parsed }
    }
    if (variable.type === 'double') {
      const numeric = (value as { value?: unknown }).value
      return typeof numeric === 'number' && Number.isFinite(numeric)
        ? { type: 'double', value: numeric }
        : null
    }
    return null
  }
  if (operand.type === 'long') {
    const parsed = parseLong(operand.value)
    return parsed === null ? null : { type: 'long', value: parsed }
  }
  if (operand.type === 'double') {
    return Number.isFinite(operand.value) ? { type: 'double', value: operand.value } : null
  }
  return null
}

/** 三项必须同属 long 或 double；解析阶段已校验，这里防御性取第一条可用类型 */
export function resolveRange(
  range: BossbarRange,
  variables: Record<string, BossbarVariable>,
  values: BossbarValueMap,
): ResolvedRange {
  const value = operandValue(range.value, variables, values)
  const min = operandValue(range.min, variables, values)
  const max = operandValue(range.max, variables, values)
  const type: BossbarVariableType =
    value?.type ?? min?.type ?? max?.type ?? 'double'

  if (type === 'long') {
    const longValue = value?.type === 'long' ? value.value : BigInt(0)
    const longMin = min?.type === 'long' ? min.value : BigInt(0)
    const longMax = max?.type === 'long' ? max.value : BigInt(0)
    return {
      type: 'long',
      value: Number(longValue),
      min: Number(longMin),
      max: Number(longMax),
      ratio: computeLongRatio(longValue, longMin, longMax),
      long: { value: longValue, min: longMin, max: longMax },
    }
  }

  const doubleValue = value?.type === 'double' ? value.value : 0
  const doubleMin = min?.type === 'double' ? min.value : 0
  const doubleMax = max?.type === 'double' ? max.value : 0
  return {
    type: 'double',
    value: doubleValue,
    min: doubleMin,
    max: doubleMax,
    ratio: computeDoubleRatio(doubleValue, doubleMin, doubleMax),
    long: null,
  }
}
