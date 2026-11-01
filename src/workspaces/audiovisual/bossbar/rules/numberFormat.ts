/**
 * 数值格式：number / compact / percent，double 与 long 两条实现。
 *
 * double 的舍入规则是协议的一部分：**按最短往返十进制表示做四舍五入（0.5 远离零）**。
 * JS 用 `String(x)`，Java 用 `BigDecimal.valueOf(x)`，取到同一串数字后再按位进位。
 * long 全程用 BigInt，不经过 double，保证 2^53 以上的整数不丢位。
 */

type Decimals = { negative: boolean; int: string; frac: string }

function parseDecimal(value: number): Decimals {
  const negative = value < 0 || Object.is(value, -0)
  let text = String(Math.abs(value))
  let exponent = 0
  const marker = text.indexOf('e') >= 0 ? text.indexOf('e') : text.indexOf('E')
  if (marker >= 0) {
    exponent = Number(text.slice(marker + 1))
    text = text.slice(0, marker)
  }
  const [whole, fraction = ''] = text.split('.')
  let intDigits = whole
  let fracDigits = fraction
  if (exponent > 0) {
    const all = intDigits + fracDigits
    const point = intDigits.length + exponent
    intDigits = all.slice(0, point).padEnd(point, '0')
    fracDigits = all.slice(point)
  } else if (exponent < 0) {
    const all = intDigits + fracDigits
    const point = intDigits.length + exponent
    if (point > 0) {
      intDigits = all.slice(0, point)
      fracDigits = all.slice(point)
    } else {
      intDigits = '0'
      fracDigits = '0'.repeat(-point) + all
    }
  }
  intDigits = intDigits.replace(/^0+/, '') || '0'
  return { negative, int: intDigits, frac: fracDigits }
}

function roundDecimals(decimals: Decimals, digits: number): Decimals {
  if (decimals.frac.length <= digits) {
    return { negative: decimals.negative, int: decimals.int, frac: decimals.frac.padEnd(digits, '0') }
  }
  const keep = decimals.frac.slice(0, digits)
  const dropped = decimals.frac.slice(digits)
  if (dropped.charCodeAt(0) < '5'.charCodeAt(0)) {
    return { negative: decimals.negative, int: decimals.int, frac: keep }
  }
  const chars = (decimals.int + keep).split('')
  let index = chars.length - 1
  while (index >= 0) {
    if (chars[index] === '9') {
      chars[index] = '0'
      index -= 1
    } else {
      chars[index] = String(Number(chars[index]) + 1)
      break
    }
  }
  const joined = index < 0 ? '1' + chars.join('') : chars.join('')
  const intLength = joined.length - keep.length
  const intPart = joined.slice(0, intLength).replace(/^0+/, '') || '0'
  return { negative: decimals.negative, int: intPart, frac: joined.slice(intLength) }
}

function renderDecimals(decimals: Decimals, digits: number): string {
  const zero = decimals.int === '0' && /^0*$/.test(decimals.frac)
  const sign = decimals.negative && !zero ? '-' : ''
  return sign + decimals.int + (digits > 0 ? '.' + decimals.frac : '')
}

/** double 定点小数；digits 位小数（0–4） */
export function formatNumber(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return formatNumber(0, digits)
  return renderDecimals(roundDecimals(parseDecimal(value), digits), digits)
}

/** 舍入到 digits 位小数的数值形式（阈值判断用，不看字符串） */
export function roundTo(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return 0
  return Number(renderDecimals(roundDecimals(parseDecimal(value), digits), digits))
}

const COMPACT_UNITS = ['', 'K', 'M', 'B']

/** double 的 K/M/B 阈值：舍入后达到下一级就提升单位 */
export function formatCompact(value: number, digits = 0): string {
  if (!Number.isFinite(value)) return formatCompact(0, digits)
  const negative = value < 0
  const magnitude = Math.abs(value)
  let unit = 0
  while (unit < COMPACT_UNITS.length - 1 && magnitude >= Math.pow(1000, unit + 1)) unit += 1
  while (unit < COMPACT_UNITS.length - 1 && roundTo(magnitude / Math.pow(1000, unit), digits) >= 1000) {
    unit += 1
  }
  const scaled = magnitude / Math.pow(1000, unit)
  const text = formatNumber(negative ? -scaled : scaled, digits)
  return text + COMPACT_UNITS[unit]
}

/** double percent：数值乘以 100 并追加 % */
export function formatPercent(value: number, digits = 0): string {
  return formatNumber(value * 100, digits) + '%'
}

// ------------------------------------------------------------------ long

/** long 的 number / percent 保留全部位，不使用 digits */
export function formatLongNumber(value: bigint): string {
  return value.toString(10)
}

export function formatLongPercent(value: bigint): string {
  return (value * BigInt(100)).toString(10) + '%'
}

/** 精确十进制舍入：返回 num/den 保留 digits 位小数后的整数部分（已乘 10^digits） */
function roundRational(numerator: bigint, denominator: bigint, digits: number): bigint {
  if (denominator === BigInt(0)) return BigInt(0)
  const scale = BigInt(10) ** BigInt(digits)
  const scaled = numerator * scale
  let quotient = scaled / denominator
  const remainder = scaled % denominator
  if (remainder * BigInt(2) >= denominator) quotient += BigInt(1)
  return quotient
}

function renderScaled(value: bigint, digits: number): string {
  const text = value.toString(10)
  if (digits <= 0) return text
  const padded = text.padStart(digits + 1, '0')
  return padded.slice(0, padded.length - digits) + '.' + padded.slice(padded.length - digits)
}

/** long 的 K/M/B：整数或十进制算法舍入，不经过 double */
export function formatLongCompact(value: bigint, digits = 0): string {
  const negative = value < BigInt(0)
  let magnitude = negative ? -value : value
  let unit = 0
  const thousand = BigInt(1000)
  while (unit < COMPACT_UNITS.length - 1 && magnitude >= thousand ** BigInt(unit + 1)) unit += 1
  let scaled = roundRational(magnitude, thousand ** BigInt(unit), digits)
  const threshold = thousand * BigInt(10) ** BigInt(digits)
  while (unit < COMPACT_UNITS.length - 1 && scaled >= threshold) {
    unit += 1
    scaled = roundRational(magnitude, thousand ** BigInt(unit), digits)
  }
  const sign = negative && scaled !== BigInt(0) ? '-' : ''
  return sign + renderScaled(scaled, digits) + COMPACT_UNITS[unit]
}

export { COMPACT_UNITS }
