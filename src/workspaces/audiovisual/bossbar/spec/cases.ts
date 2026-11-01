import type { BossbarAnimation, BossbarUv } from '../protocol'
import { BOSSBAR_DEFAULT_TEXTURE, BOSSBAR_SAMPLE_TEXTURE, BOSSBAR_TEST_TEXTURE_16 } from '../protocol'

/**
 * 协议夹具的**输入**部分（声明式，只有输入，没有期望值）。
 *
 * 期望值由 `generate.ts` 用当前实现算出来，冻结在 `spec/bossbar-v2.fixtures.json`；
 * `npm run test:bossbar` 比较磁盘上的冻结结果。Java 端读同一份 JSON 对拍。
 */

/** 设计文档第 6 节的完整示例（原样，含内嵌 4×2 图集） */
export const DEMO_EMBER_GUARD = {
  format: 'hanshu.bossbar',
  version: 2,
  id: 'hanshu:ember_guard',
  texture: BOSSBAR_SAMPLE_TEXTURE,
  layout: { dock: 'top-center', scale: 0.5, safeMargin: 12 },
  variables: {
    health: { type: 'double', key: 'health', default: 0 },
    maxHealth: { type: 'double', key: 'max_health', default: 1 },
    bossName: { type: 'string', key: 'boss_name', default: '首领', maxLength: 64 },
    targetName: { type: 'string', key: 'target_name', default: '无', maxLength: 64 },
    enraged: { type: 'bool', key: 'enraged', default: false },
    shield: { type: 'long', key: 'shield', default: '0' },
    maxShield: { type: 'long', key: 'max_shield', default: '100' },
  },
  components: [
    { id: 'region', type: 'display_region', box: { x: -384, y: -36, width: 768, height: 72 } },
    {
      id: 'track',
      type: 'background',
      box: { x: -288, y: -8, width: 636, height: 20 },
      paint: { kind: 'texture', uv: { x: 0, y: 0, width: 1, height: 1 }, fit: 'stretch' },
    },
    {
      id: 'emblem',
      type: 'background',
      box: { x: -364, y: -32, width: 60, height: 60 },
      paint: { kind: 'texture', uv: { x: 3, y: 0, width: 1, height: 1 }, fit: 'contain' },
    },
    {
      id: 'health_fill',
      type: 'bar',
      box: { x: -284, y: -4, width: 628, height: 12 },
      range: {
        value: { var: 'health' },
        min: { type: 'double', value: 0 },
        max: { var: 'maxHealth' },
      },
      fill: { kind: 'texture', uv: { x: 1, y: 0, width: 1, height: 1 }, fit: 'stretch' },
      direction: 'left-to-right',
      smoothMs: 120,
      trail: {
        paint: { kind: 'texture', uv: { x: 2, y: 0, width: 1, height: 1 }, fit: 'stretch' },
        delayMs: 250,
        durationMs: 350,
      },
    },
    {
      id: 'shield_fill',
      type: 'bar',
      box: { x: -284, y: 16, width: 628, height: 4 },
      range: {
        value: { var: 'shield' },
        min: { type: 'long', value: '0' },
        max: { var: 'maxShield' },
      },
      fill: { kind: 'texture', uv: { x: 2, y: 1, width: 1, height: 1 }, fit: 'stretch' },
    },
    {
      id: 'title',
      type: 'text',
      box: { x: -284, y: -36, width: 628, height: 24 },
      fontSize: 18,
      color: '#FFFFFFFF',
      align: 'center',
      verticalAlign: 'middle',
      shadow: true,
      runs: [
        { var: 'bossName', format: 'string' },
        { text: '  目标：' },
        { var: 'targetName', format: 'string' },
      ],
    },
    {
      id: 'health_text',
      type: 'text',
      box: { x: -284, y: -9, width: 628, height: 22 },
      fontSize: 14,
      color: '#FFFFFFFF',
      align: 'center',
      verticalAlign: 'middle',
      shadow: true,
      runs: [
        { var: 'health', format: 'compact', digits: 1 },
        { text: '（' },
        {
          ratio: {
            value: { var: 'health' },
            min: { type: 'double', value: 0 },
            max: { var: 'maxHealth' },
          },
          format: 'percent',
          digits: 1,
        },
        { text: '）' },
      ],
    },
    {
      id: 'rage_flame',
      type: 'background',
      box: { x: -276, y: 23, width: 608, height: 8 },
      visible: { var: 'enraged' },
      paint: {
        kind: 'texture',
        uv: { x: 0, y: 1, width: 1, height: 1 },
        fit: 'stretch',
        animation: {
          mode: 'loop',
          phaseMs: 0,
          frames: [
            { uv: { x: 0, y: 1, width: 1, height: 1 }, durationMs: 100 },
            { uv: { x: 1, y: 1, width: 1, height: 1 }, durationMs: 100 },
          ],
        },
      },
    },
  ],
} as const

/** 最简 v2：一个显示区域 + 透明 1×1 图集 */
export const MINIMAL_V2 = {
  format: 'hanshu.bossbar',
  version: 2,
  id: 'hanshu:minimal',
  texture: BOSSBAR_DEFAULT_TEXTURE,
  layout: { dock: 'top-center', scale: 1, safeMargin: 8 },
  variables: {},
  components: [
    { id: 'region', type: 'display_region', box: { x: 0, y: 0, width: 320, height: 40 } },
  ],
}

/** 模拟值：本机预览状态，不写进文档也不进 PAK */
export const DEMO_SCENARIOS = [
  {
    name: 'full',
    values: {
      health: { type: 'double', value: 1200000 },
      maxHealth: { type: 'double', value: 1200000 },
      bossName: { type: 'string', value: '赤焰守卫' },
      targetName: { type: 'string', value: '无' },
      enraged: { type: 'bool', value: false },
      shield: { type: 'long', value: '40' },
      maxShield: { type: 'long', value: '100' },
    },
  },
  {
    name: 'injured',
    values: {
      health: { type: 'double', value: 420000 },
      maxHealth: { type: 'double', value: 1200000 },
      bossName: { type: 'string', value: '赤焰守卫' },
      targetName: { type: 'string', value: '史蒂夫' },
      enraged: { type: 'bool', value: false },
      shield: { type: 'long', value: '12' },
      maxShield: { type: 'long', value: '100' },
    },
  },
  {
    name: 'enraged-long-extreme',
    values: {
      health: { type: 'double', value: 300000 },
      maxHealth: { type: 'double', value: 1200000 },
      bossName: { type: 'string', value: '赤焰守卫' },
      targetName: { type: 'string', value: '史蒂夫' },
      enraged: { type: 'bool', value: true },
      shield: { type: 'long', value: '9223372036854775807' },
      maxShield: { type: 'long', value: '9223372036854775807' },
    },
  },
  {
    name: 'empty',
    values: {
      health: { type: 'double', value: 0 },
      maxHealth: { type: 'double', value: 1200000 },
      bossName: { type: 'string', value: '赤焰守卫' },
      targetName: { type: 'string', value: '无' },
      enraged: { type: 'bool', value: false },
      shield: { type: 'long', value: '0' },
      maxShield: { type: 'long', value: '100' },
    },
  },
] as const

/** 在合法 PNG 里插入带有效 CRC 的 acTL 块，验证 APNG 拒绝规则。 */
export function makeApngBase64(): string {
  const bytes = base64ToBytesUnsafe(BOSSBAR_DEFAULT_TEXTURE)
  const output: number[] = []
  for (let index = 0; index < bytes.length; index += 1) output.push(bytes[index])
  // IHDR 之后插入 acTL（长度 8，类型 acTL，数据 8 字节）。
  const insertAt = 8 + 4 + 4 + 13 + 4
  const chunk = [0, 0, 0, 8, 97, 99, 84, 76, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0]
  let crc = 0xffffffff
  for (const byte of chunk.slice(4, 16)) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  crc = (crc ^ 0xffffffff) >>> 0
  for (let index = 0; index < 4; index += 1) chunk[16 + index] = (crc >>> (24 - index * 8)) & 255
  output.splice(insertAt, 0, ...chunk)
  return encodeBase64Unsafe(new Uint8Array(output))
}

function base64ToBytesUnsafe(text: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  const clean = text.replace(/=+$/, '')
  const out: number[] = []
  let bits = 0
  let count = 0
  for (const char of clean) {
    const value = alphabet.indexOf(char)
    if (value < 0) continue
    bits = (bits << 6) | value
    count += 6
    if (count >= 8) {
      count -= 8
      out.push((bits >>> count) & 0xff)
    }
  }
  return new Uint8Array(out)
}

function encodeBase64Unsafe(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let out = ''
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index]
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0
    const bits = (a << 16) | (b << 8) | c
    out += alphabet[(bits >>> 18) & 63]
    out += alphabet[(bits >>> 12) & 63]
    out += index + 1 < bytes.length ? alphabet[(bits >>> 6) & 63] : '='
    out += index + 2 < bytes.length ? alphabet[bits & 63] : '='
  }
  return out
}

const regionOnly = [{ id: 'region', type: 'display_region', box: { x: 0, y: 0, width: 100, height: 40 } }]

/** 非法输入：全部应被拒绝，且诊断路径要指到具体字段 */
export const INVALID_CASES: { name: string, path: string, input: unknown }[] = [
  { name: 'unknown-field', path: 'extra', input: { ...MINIMAL_V2, extra: 1 } },
  { name: 'missing-texture', path: 'texture', input: (() => { const { texture: _texture, ...rest } = MINIMAL_V2; void _texture; return rest })() },
  { name: 'bad-base64', path: 'texture', input: { ...MINIMAL_V2, texture: 'not a png' } },
  { name: 'not-png', path: 'texture', input: { ...MINIMAL_V2, texture: 'aGVsbG8gd29ybGQ=' } },
  { name: 'png-no-idat', path: 'texture', input: { ...MINIMAL_V2, texture: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAAElFTkSuQmCC' } },
  { name: 'apng', path: 'texture', input: { ...MINIMAL_V2, texture: makeApngBase64() } },
  { name: 'no-display-region', path: 'components', input: { ...MINIMAL_V2, components: [{ id: 'bg', type: 'background', box: { x: 0, y: 0, width: 10, height: 10 }, paint: { kind: 'solid', color: '#000000FF' } }] } },
  {
    name: 'duplicate-display-region',
    path: 'components[1].type',
    input: { ...MINIMAL_V2, components: [...regionOnly, { id: 'region2', type: 'display_region', box: { x: 0, y: 0, width: 10, height: 10 } }] },
  },
  { name: 'id-leading-space', path: 'id', input: { ...MINIMAL_V2, id: ' hanshu:x' } },
  { name: 'dock-unsupported', path: 'layout.dock', input: { ...MINIMAL_V2, layout: { ...MINIMAL_V2.layout, dock: 'bottom-left' } } },
  { name: 'scale-over', path: 'layout.scale', input: { ...MINIMAL_V2, layout: { ...MINIMAL_V2.layout, scale: 4.5 } } },
  {
    name: 'component-zero-width',
    path: 'components[1].box.width',
    input: {
      ...MINIMAL_V2,
      components: [...regionOnly, { id: 'a', type: 'background', box: { x: 0, y: 0, width: 0, height: 10 }, paint: { kind: 'solid', color: '#000000FF' } }],
    },
  },
  {
    name: 'component-outside-region',
    path: 'components[1].box',
    input: {
      ...MINIMAL_V2,
      components: [...regionOnly, { id: 'a', type: 'background', box: { x: 90, y: 0, width: 20, height: 10 }, paint: { kind: 'solid', color: '#000000FF' } }],
    },
  },
  {
    name: 'hidden-component-outside-region',
    path: 'components[1].box',
    input: {
      ...MINIMAL_V2,
      components: [
        ...regionOnly,
        { id: 'a', type: 'background', box: { x: 0, y: 30, width: 20, height: 20 }, visible: false, paint: { kind: 'solid', color: '#000000FF' } },
      ],
    },
  },
  {
    name: 'component-duplicate-id',
    path: 'components[2].id',
    input: {
      ...MINIMAL_V2,
      components: [
        ...regionOnly,
        { id: 'same', type: 'background', box: { x: 0, y: 0, width: 10, height: 10 }, paint: { kind: 'solid', color: '#000000FF' } },
        { id: 'same', type: 'background', box: { x: 10, y: 0, width: 10, height: 10 }, paint: { kind: 'solid', color: '#000000FF' } },
      ],
    },
  },
  {
    name: 'uv-out-of-bounds',
    path: 'components[1].paint.uv',
    input: {
      ...MINIMAL_V2,
      components: [
        ...regionOnly,
        { id: 'a', type: 'background', box: { x: 0, y: 0, width: 10, height: 10 }, paint: { kind: 'texture', uv: { x: 1, y: 0, width: 1, height: 1 }, fit: 'stretch' } },
      ],
    },
  },
  {
    name: 'animation-first-frame-mismatch',
    path: 'components[1].paint.animation.frames[0].uv',
    input: {
      ...MINIMAL_V2,
      texture: BOSSBAR_SAMPLE_TEXTURE,
      components: [
        ...regionOnly,
        {
          id: 'a',
          type: 'background',
          box: { x: 0, y: 0, width: 10, height: 10 },
          paint: {
            kind: 'texture',
            uv: { x: 0, y: 0, width: 1, height: 1 },
            fit: 'stretch',
            animation: { mode: 'loop', phaseMs: 0, frames: [{ uv: { x: 1, y: 0, width: 1, height: 1 }, durationMs: 100 }] },
          },
        },
      ],
    },
  },
  {
    name: 'animation-frame-size-mismatch',
    path: 'components[1].paint.animation.frames[1].uv',
    input: {
      ...MINIMAL_V2,
      texture: BOSSBAR_SAMPLE_TEXTURE,
      components: [
        ...regionOnly,
        {
          id: 'a',
          type: 'background',
          box: { x: 0, y: 0, width: 10, height: 10 },
          paint: {
            kind: 'texture',
            uv: { x: 0, y: 0, width: 1, height: 1 },
            fit: 'stretch',
            animation: {
              mode: 'loop',
              phaseMs: 0,
              frames: [
                { uv: { x: 0, y: 0, width: 1, height: 1 }, durationMs: 100 },
                { uv: { x: 2, y: 0, width: 2, height: 1 }, durationMs: 100 },
              ],
            },
          },
        },
      ],
    },
  },
  {
    name: 'nine-slice-insets-too-big',
    path: 'components[1].paint.insets',
    input: {
      ...MINIMAL_V2,
      components: [
        ...regionOnly,
        { id: 'a', type: 'background', box: { x: 0, y: 0, width: 10, height: 10 }, paint: { kind: 'texture', uv: { x: 0, y: 0, width: 1, height: 1 }, fit: 'nine-slice', insets: [8, 8, 8, 8] } },
      ],
    },
  },
  {
    name: 'bar-fill-media-contain',
    path: 'components[1].fill.fit',
    input: {
      ...MINIMAL_V2,
      components: [
        ...regionOnly,
        {
          id: 'bar',
          type: 'bar',
          box: { x: 0, y: 0, width: 100, height: 10 },
          range: { value: { type: 'double', value: 50 }, min: { type: 'double', value: 0 }, max: { type: 'double', value: 100 } },
          fill: { kind: 'texture', uv: { x: 0, y: 0, width: 1, height: 1 }, fit: 'contain' },
        },
      ],
    },
  },
  {
    name: 'range-type-mixed',
    path: 'components[1].range',
    input: {
      ...MINIMAL_V2,
      components: [
        ...regionOnly,
        {
          id: 'bar',
          type: 'bar',
          box: { x: 0, y: 0, width: 100, height: 10 },
          range: { value: { type: 'long', value: '5' }, min: { type: 'double', value: 0 }, max: { type: 'double', value: 100 } },
          fill: { kind: 'solid', color: '#FF0000FF' },
        },
      ],
    },
  },
  {
    name: 'unknown-variable',
    path: 'components[1].range.value.var',
    input: {
      ...MINIMAL_V2,
      components: [
        ...regionOnly,
        {
          id: 'bar',
          type: 'bar',
          box: { x: 0, y: 0, width: 100, height: 10 },
          range: { value: { var: 'nope' }, min: { type: 'double', value: 0 }, max: { type: 'double', value: 100 } },
          fill: { kind: 'solid', color: '#FF0000FF' },
        },
      ],
    },
  },
  {
    name: 'visibility-number-variable',
    path: 'components[1].visible.var',
    input: {
      ...MINIMAL_V2,
      variables: { hp: { type: 'double', key: 'hp', default: 0 } },
      components: [
        ...regionOnly,
        { id: 'a', type: 'background', box: { x: 0, y: 0, width: 10, height: 10 }, visible: { var: 'hp' }, paint: { kind: 'solid', color: '#000000FF' } },
      ],
    },
  },
  {
    name: 'text-format-mismatch',
    path: 'components[1].runs[0].format',
    input: {
      ...MINIMAL_V2,
      variables: { name: { type: 'string', key: 'name', default: 'x' } },
      components: [
        ...regionOnly,
        { id: 't', type: 'text', box: { x: 0, y: 0, width: 100, height: 10 }, runs: [{ var: 'name', format: 'compact' }] },
      ],
    },
  },
  {
    name: 'long-default-out-of-range',
    path: 'variables.big.default',
    input: {
      ...MINIMAL_V2,
      variables: { big: { type: 'long', key: 'big', default: '9223372036854775808' } },
    },
  },
  {
    name: 'long-default-leading-zero',
    path: 'variables.big.default',
    input: {
      ...MINIMAL_V2,
      variables: { big: { type: 'long', key: 'big', default: '007' } },
    },
  },
  {
    name: 'long-range-overflow',
    path: 'components[1].range.value.value',
    input: {
      ...MINIMAL_V2,
      components: [...regionOnly, {
        id: 'bar', type: 'bar', box: { x: 0, y: 0, width: 10, height: 10 },
        range: { value: { type: 'long', value: '9223372036854775808' }, min: { type: 'long', value: '0' }, max: { type: 'long', value: '100' } },
        fill: { kind: 'solid', color: '#FFFFFFFF' },
      }],
    },
  },
  {
    name: 'snapshot-budget-overflow',
    path: 'variables',
    input: {
      ...MINIMAL_V2,
      variables: Object.fromEntries(Array.from({ length: 64 }, (_, index) => [
        'v' + index, { type: 'string', key: 'v' + index, default: '', maxLength: 256 },
      ])),
    },
  },
  {
    name: 'string-default-too-long',
    path: 'variables.short.default',
    input: {
      ...MINIMAL_V2,
      variables: { short: { type: 'string', key: 'short', default: 'abcdef', maxLength: 3 } },
    },
  },
  {
    name: 'bad-color',
    path: 'components[1].paint.color',
    input: {
      ...MINIMAL_V2,
      components: [...regionOnly, { id: 'a', type: 'background', box: { x: 0, y: 0, width: 10, height: 10 }, paint: { kind: 'solid', color: '#FFF' } }],
    },
  },
  {
    name: 'missing-runs',
    path: 'components[1].runs',
    input: {
      ...MINIMAL_V2,
      components: [...regionOnly, { id: 't', type: 'text', box: { x: 0, y: 0, width: 10, height: 10 } }],
    },
  },
  {
    name: 'display-region-with-visible',
    path: 'components[0].visible',
    input: {
      ...MINIMAL_V2,
      components: [{ ...regionOnly[0], visible: true }],
    },
  },
]

export const UNSUPPORTED_VERSION = { format: 'hanshu.bossbar', version: 3, id: 'x' }

/** double 与 long 的格式化表：TS 与 Java 共用 */
export const NUMBER_FORMAT_CASES: {
  kind: 'double' | 'long'
  value: string | number
  digits: number
  number: string
  compact: string
  percent: string
}[] = [
  { kind: 'double', value: 0, digits: 0, number: '0', compact: '0', percent: '0%' },
  { kind: 'double', value: -0, digits: 1, number: '0.0', compact: '0.0', percent: '0.0%' },
  { kind: 'double', value: 0.5, digits: 0, number: '1', compact: '1', percent: '50%' },
  { kind: 'double', value: -0.5, digits: 0, number: '-1', compact: '-1', percent: '-50%' },
  { kind: 'double', value: 1.25, digits: 1, number: '1.3', compact: '1.3', percent: '125.0%' },
  { kind: 'double', value: 1.24, digits: 1, number: '1.2', compact: '1.2', percent: '124.0%' },
  { kind: 'double', value: 999.94, digits: 1, number: '999.9', compact: '999.9', percent: '99994.0%' },
  { kind: 'double', value: 999.96, digits: 1, number: '1000.0', compact: '1.0K', percent: '99996.0%' },
  { kind: 'double', value: 1200000, digits: 1, number: '1200000.0', compact: '1.2M', percent: '120000000.0%' },
  { kind: 'double', value: 999999, digits: 0, number: '999999', compact: '1M', percent: '99999900%' },
  { kind: 'double', value: -1500, digits: 0, number: '-1500', compact: '-2K', percent: '-150000%' },
  { kind: 'double', value: 2500000000, digits: 2, number: '2500000000.00', compact: '2.50B', percent: '250000000000.00%' },
  { kind: 'double', value: 0.0001, digits: 4, number: '0.0001', compact: '0.0001', percent: '0.0100%' },
  { kind: 'long', value: '0', digits: 0, number: '0', compact: '0', percent: '0%' },
  { kind: 'long', value: '9007199254740993', digits: 0, number: '9007199254740993', compact: '9007199B', percent: '900719925474099300%' },
  { kind: 'long', value: '9223372036854775807', digits: 0, number: '9223372036854775807', compact: '9223372037B', percent: '922337203685477580700%' },
  { kind: 'long', value: '9223372036854775807', digits: 1, number: '9223372036854775807', compact: '9223372036.9B', percent: '922337203685477580700%' },
  { kind: 'long', value: '-9223372036854775808', digits: 0, number: '-9223372036854775808', compact: '-9223372037B', percent: '-922337203685477580800%' },
  { kind: 'long', value: '1200000', digits: 1, number: '1200000', compact: '1.2M', percent: '120000000%' },
  { kind: 'long', value: '999950', digits: 1, number: '999950', compact: '1.0M', percent: '99995000%' },
  { kind: 'long', value: '999', digits: 0, number: '999', compact: '999', percent: '99900%' },
  { kind: 'long', value: '-1500', digits: 0, number: '-1500', compact: '-2K', percent: '-150000%' },
]

/** 取帧表：设计文档 10.1 节的例子 */
export const FRAME_CASES: {
  mode: 'loop' | 'once' | 'pingpong'
  durations: number[]
  phaseMs: number
  samples: { timeMs: number, index: number }[]
}[] = [
  {
    mode: 'loop',
    durations: [100, 100, 100, 100],
    phaseMs: 0,
    samples: [0, 99, 100, 399, 400].map((timeMs, index) => ({
      timeMs,
      index: [0, 0, 1, 3, 0][index],
    })),
  },
  {
    mode: 'pingpong',
    durations: [100, 100, 100, 100],
    phaseMs: 0,
    samples: [0, 100, 200, 300, 400, 500, 599, 600].map((timeMs, index) => ({
      timeMs,
      index: [0, 1, 2, 3, 2, 1, 1, 0][index],
    })),
  },
  {
    mode: 'once',
    durations: [100, 100],
    phaseMs: 50,
    samples: [0, 49, 50, 149, 150, 10000].map((timeMs, index) => ({
      timeMs,
      index: [0, 0, 1, 1, 1, 1][index],
    })),
  },
  {
    mode: 'pingpong',
    durations: [40, 120, 60],
    phaseMs: 0,
    samples: [0, 39, 40, 159, 160, 219, 220, 339, 340].map((timeMs, index) => ({
      timeMs,
      index: [0, 0, 1, 1, 2, 2, 1, 1, 0][index],
    })),
  },
]

/** 范围计算表：double 与 long 各一组 */
export const RATIO_CASES: {
  kind: 'double' | 'long'
  value: string | number
  min: string | number
  max: string | number
  ratio: number
}[] = [
  { kind: 'double', value: 50, min: 0, max: 100, ratio: 0.5 },
  { kind: 'double', value: 0, min: 0, max: 100, ratio: 0 },
  { kind: 'double', value: 100, min: 0, max: 100, ratio: 1 },
  { kind: 'double', value: -10, min: 0, max: 100, ratio: 0 },
  { kind: 'double', value: 150, min: 0, max: 100, ratio: 1 },
  { kind: 'double', value: 5, min: 5, max: 5, ratio: 0 },
  { kind: 'double', value: 5, min: 10, max: 0, ratio: 0 },
  { kind: 'double', value: 300000, min: 0, max: 1200000, ratio: 0.25 },
  { kind: 'double', value: 1, min: -1, max: 1, ratio: 1 },
  { kind: 'double', value: 0, min: -1, max: 1, ratio: 0.5 },
  { kind: 'double', value: Number.MAX_VALUE, min: -Number.MAX_VALUE, max: 0, ratio: 1 },
  { kind: 'double', value: 0, min: -Number.MAX_VALUE, max: Number.MAX_VALUE, ratio: 0.5 },
  { kind: 'long', value: '0', min: '0', max: '100', ratio: 0 },
  { kind: 'long', value: '50', min: '0', max: '100', ratio: 0.5 },
  { kind: 'long', value: '100', min: '0', max: '100', ratio: 1 },
  { kind: 'long', value: '-5', min: '0', max: '100', ratio: 0 },
  { kind: 'long', value: '9223372036854775807', min: '0', max: '9223372036854775807', ratio: 1 },
  {
    kind: 'long',
    value: '4611686018427387903',
    min: '0',
    max: '9223372036854775807',
    // 2^62-1 / (2^63-1)：精确相减后转浮点，两端应得同一 double
    ratio: Number(BigInt('4611686018427387903')) / Number(BigInt('9223372036854775807')),
  },
  { kind: 'long', value: '-9223372036854775808', min: '-9223372036854775808', max: '9223372036854775807', ratio: 0 },
]

/** 九宫格（源坐标相对 UV 原点） */
export const NINE_SLICE_CASES: {
  name: string
  src: [number, number]
  dst: { x: number, y: number, width: number, height: number }
  insets: [number, number, number, number]
}[] = [
  { name: 'normal', src: [64, 32], dst: { x: 0, y: 0, width: 200, height: 40 }, insets: [8, 8, 8, 8] },
  { name: 'too-small', src: [64, 32], dst: { x: 4, y: 4, width: 8, height: 6 }, insets: [8, 8, 8, 8] },
  { name: 'zero-center', src: [64, 32], dst: { x: 0, y: 0, width: 16, height: 16 }, insets: [8, 8, 8, 8] },
]

export const BAR_SEGMENT_CASES: {
  box: { x: number, y: number, width: number, height: number }
  from: number
  to: number
  direction: 'left-to-right' | 'right-to-left' | 'bottom-to-top' | 'top-to-bottom'
}[] = [
  { box: { x: 100, y: 32, width: 628, height: 12 }, from: 0, to: 0.25, direction: 'left-to-right' },
  { box: { x: 100, y: 32, width: 628, height: 12 }, from: 0.5, to: 0.8, direction: 'right-to-left' },
  { box: { x: 0, y: 0, width: 10, height: 100 }, from: 0, to: 0.35, direction: 'bottom-to-top' },
  { box: { x: 0, y: 0, width: 10, height: 100 }, from: 0.2, to: 0.9, direction: 'top-to-bottom' },
  { box: { x: 0, y: 0, width: 10, height: 100 }, from: 0.3, to: 0.3, direction: 'top-to-bottom' },
]

/** 文本截断：每个字形按固定宽度计，两端可复现 */
export const TRUNCATE_CASES: { text: string, maxWidth: number }[] = [
  { text: '赤焰守卫', maxWidth: 1000 },
  { text: '赤焰守卫', maxWidth: 45 },
  { text: '目标：史蒂夫（35.0%）', maxWidth: 120 },
  { text: '😀😀😀😀😀', maxWidth: 45 },
  { text: 'abcdef', maxWidth: 5 },
]

/** 布局表：显示区域可能位于负坐标，GUI 宽度不同时按显示区域宽度缩放 */
export const LAYOUT_CASES: {
  guiWidth: number
  layout: { dock: 'top-center', scale: number, safeMargin: number }
  region: { x: number, y: number, width: number, height: number }
  rowY: number
  boxes: { x: number, y: number, width: number, height: number }[]
}[] = [
  {
    guiWidth: 320,
    layout: { dock: 'top-center', scale: 0.5, safeMargin: 12 },
    region: { x: -384, y: -36, width: 768, height: 72 },
    rowY: 12,
    boxes: [
      { x: -384, y: -36, width: 768, height: 72 },
      { x: -288, y: -8, width: 636, height: 20 },
    ],
  },
  {
    guiWidth: 1920,
    layout: { dock: 'top-center', scale: 0.5, safeMargin: 12 },
    region: { x: -384, y: -36, width: 768, height: 72 },
    rowY: 12,
    boxes: [{ x: -364, y: -32, width: 60, height: 60 }],
  },
  {
    guiWidth: 20,
    layout: { dock: 'top-center', scale: 0.5, safeMargin: 12 },
    region: { x: 0, y: 0, width: 768, height: 72 },
    rowY: 12,
    boxes: [{ x: 0, y: 0, width: 10, height: 10 }],
  },
]

/** 规范化对拍：作者手写（省略默认值）→ 规范文档 */
export const NORMALIZE_CASES: { name: string, input: unknown }[] = [
  { name: 'minimal-v2', input: MINIMAL_V2 },
  { name: 'demo-ember-guard', input: DEMO_EMBER_GUARD },
  {
    name: 'defaults-filled',
    input: {
      format: 'hanshu.bossbar',
      version: 2,
      id: 'hanshu:defaults',
      texture: ' ' + BOSSBAR_TEST_TEXTURE_16 + '\n',
      layout: {},
      variables: {
        note: { type: 'string', key: 'note', default: 'x' },
        big: { type: 'long', key: 'big', default: '0' },
      },
      components: [
        { id: 'region', type: 'display_region', box: { x: -10, y: -10, width: 100, height: 40 } },
        { id: 'bg', type: 'background', box: { x: 0, y: 0, width: 10, height: 10 }, paint: { kind: 'solid', color: '#11223344' } },
        {
          id: 'nine',
          type: 'background',
          box: { x: 0, y: 0, width: 10, height: 10 },
          paint: { kind: 'texture', uv: { x: 0, y: 0, width: 16, height: 16 }, fit: 'nine-slice' },
        },
        {
          id: 'bar',
          type: 'bar',
          box: { x: 0, y: 0, width: 10, height: 10 },
          range: { value: { type: 'double', value: 1 }, min: { type: 'double', value: 0 }, max: { type: 'double', value: 4 } },
          fill: { kind: 'solid', color: '#FF0000FF' },
        },
        {
          id: 'txt',
          type: 'text',
          box: { x: 0, y: 0, width: 10, height: 10 },
          runs: [{ text: 'a' }, { var: 'note' }, { ratio: { value: { type: 'double', value: 1 }, min: { type: 'double', value: 0 }, max: { type: 'double', value: 2 } } }],
        },
      ],
    },
  },
]

/** 紧凑动画构造：4 帧各 100ms，UV 横向排布 */
export function sequenceAnimation(mode: BossbarAnimation['mode'], durations: number[], phaseMs: number): BossbarAnimation {
  return {
    mode,
    phaseMs,
    frames: durations.map((durationMs, index) => ({
      uv: { x: index, y: 0, width: 1, height: 1 } as BossbarUv,
      durationMs,
    })),
  }
}
