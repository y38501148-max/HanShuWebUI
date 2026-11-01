import type { BossbarTextFormat, BossbarValue } from '../protocol'
import { formatCompact, formatLongCompact, formatLongNumber, formatLongPercent, formatNumber, formatPercent } from './numberFormat'

/**
 * 文本片段 → 文本。
 *
 * long 走精确整数格式化（保留全部位），double 走数值格式化；
 * 类型与格式不匹配返回 null，由调用方报诊断。
 */

export function formatRunValue(
  value: BossbarValue | undefined,
  format: BossbarTextFormat,
  digits: number,
): string | null {
  if (!value) return null
  if (format === 'string') {
    if (value.type === 'string') return value.value
    if (value.type === 'bool') return value.value ? 'true' : 'false'
    return null
  }
  if (value.type === 'long') {
    if (format === 'number') return formatLongNumber(BigInt(value.value))
    if (format === 'compact') return formatLongCompact(BigInt(value.value), digits)
    return formatLongPercent(BigInt(value.value))
  }
  if (value.type === 'double') {
    if (format === 'number') return formatNumber(value.value, digits)
    if (format === 'compact') return formatCompact(value.value, digits)
    return formatPercent(value.value, digits)
  }
  return null
}
