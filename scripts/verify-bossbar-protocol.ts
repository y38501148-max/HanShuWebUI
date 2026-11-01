import assert from 'node:assert/strict'
import { deflateSync, gzipSync } from 'node:zlib'
import { readFile } from 'node:fs/promises'
import { createBossbar, parseBossbarDocument } from '../src/workspaces/audiovisual/bossbar/parse'
import { decodeBase64, encodeBase64, pngInfo, validatePngPixels } from '../src/workspaces/audiovisual/bossbar/png'
import { BOSSBAR_DEFAULT_TEXTURE, BOSSBAR_LIMITS } from '../src/workspaces/audiovisual/bossbar/protocol'
import { computeDoubleRatio, resolveRange } from '../src/workspaces/audiovisual/bossbar/rules/range'
import { estimateSnapshotBytes } from '../src/workspaces/audiovisual/bossbar/rules/values'

// Tests build PNG containers independently, with Node's zlib and a bitwise CRC.
function chunk(type: string, data: Uint8Array): Buffer {
  const payload = Buffer.concat([Buffer.from(type), data])
  let crc = 0xffffffff
  for (const value of payload) {
    crc ^= value
    for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
  }
  const size = Buffer.alloc(4)
  const checksum = Buffer.alloc(4)
  size.writeUInt32BE(data.length)
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0)
  return Buffer.concat([size, payload, checksum])
}

const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
const end = chunk('IEND', new Uint8Array())
function header(width = 1, height = 1, depth = 8, color = 6, interlace = 0): Buffer {
  const data = Buffer.alloc(13)
  data.writeUInt32BE(width)
  data.writeUInt32BE(height, 4)
  data[8] = depth
  data[9] = color
  data[12] = interlace
  return chunk('IHDR', data)
}
function png(raw: Uint8Array, options: {
  width?: number; height?: number; depth?: number; color?: number; interlace?: number
  palette?: number; before?: Buffer[]; compressed?: Uint8Array
} = {}): Buffer {
  return Buffer.concat([
    signature,
    header(options.width, options.height, options.depth, options.color, options.interlace),
    ...(options.palette ? [chunk('PLTE', Buffer.alloc(options.palette * 3))] : []),
    ...(options.before ?? []),
    chunk('IDAT', options.compressed ?? deflateSync(raw)),
    end,
  ])
}
function parseTexture(texture: Uint8Array) {
  return parseBossbarDocument(JSON.stringify({ ...createBossbar('png-test'), texture: encodeBase64(texture) }))
}
function rejectsTexture(texture: Uint8Array, label: string): void {
  const result = parseTexture(texture)
  assert.equal(result.ok, false, label)
  if (!result.ok) assert.ok(result.diagnostics.some((issue) => issue.path === 'texture'), label + ' diagnostic')
}

assert.equal(decodeBase64('AAĀ='), null, 'non-ASCII input cannot become zero bytes')
assert.equal(validatePngPixels(decodeBase64(BOSSBAR_DEFAULT_TEXTURE)!), true)
assert.equal(parseTexture(png(Uint8Array.of(0, 255, 0, 0, 255))).ok, true)

// Standard legal bit-depth/color combinations, with and without Adam7.
const modes: [number, number, number][] = [
  [0, 1, 1], [0, 2, 1], [0, 4, 1], [0, 8, 1], [0, 16, 1],
  [2, 8, 3], [2, 16, 3], [3, 1, 1], [3, 2, 1], [3, 4, 1], [3, 8, 1],
  [4, 8, 2], [4, 16, 2], [6, 8, 4], [6, 16, 4],
]
for (const [color, depth, samples] of modes) {
  for (const interlace of [0, 1]) {
    // The seven Adam7 passes for a 9×9 image have fixed dimensions.
    const dimensions = interlace ? [[2, 2], [1, 2], [3, 1], [2, 3], [5, 2], [4, 5], [9, 4]] : [[9, 9]]
    const rows: Buffer[] = []
    for (const [width, height] of dimensions) {
      for (let y = 0; y < height; y += 1) {
        const row = Buffer.alloc(1 + Math.ceil(width * samples * depth / 8))
        // Zero samples remain zero under all five PNG row filters.
        row[0] = y % 5
        rows.push(row)
      }
    }
    assert.equal(parseTexture(png(Buffer.concat(rows), {
      width: 9, height: 9, depth, color, interlace, palette: color === 3 ? 2 : undefined,
    })).ok, true, 'legal PNG color=' + color + ' depth=' + depth + ' interlace=' + interlace)
  }
}
// Empty Adam7 passes are omitted for a 1×1 image.
assert.equal(parseTexture(png(Uint8Array.of(0, 1, 2, 3, 255), { interlace: 1 })).ok, true)
for (const name of ['ember_guard', 'simple_bar']) {
  const source = await readFile(new URL('../demo-projects/bossbar-demo/src/bossbars/' + name + '.bossbar', import.meta.url), 'utf8')
  assert.equal(parseBossbarDocument(source).ok, true, 'demo remains valid: ' + name)
}

rejectsTexture(Buffer.concat([signature, header(), end]), 'missing IDAT')
const badCrc = png(Uint8Array.of(0, 1, 2, 3, 255))
badCrc[badCrc.length - 1] ^= 1
rejectsTexture(badCrc, 'CRC mismatch')
rejectsTexture(png(Uint8Array.of(0, 1, 2, 3, 255), { depth: 4 }), 'illegal RGBA depth')
rejectsTexture(png(Uint8Array.of(0, 1, 2, 3, 255), { before: [header()] }), 'duplicate IHDR')
rejectsTexture(png(Uint8Array.of(0, 1, 2, 3, 255), { before: [chunk('ABCD', new Uint8Array())] }), 'unknown critical chunk')
rejectsTexture(png(Uint8Array.of(0, 1, 2, 3, 255), { interlace: 2 }), 'invalid interlace method')
rejectsTexture(png(Uint8Array.of(5, 1, 2, 3, 255)), 'invalid scanline filter')
rejectsTexture(png(Uint8Array.of(0, 1, 2, 3)), 'truncated pixel stream')
rejectsTexture(png(Uint8Array.of(0, 1, 2, 3, 255, 0)), 'extra pixel stream')
rejectsTexture(png(new Uint8Array(), { compressed: gzipSync(Uint8Array.of(0, 1, 2, 3, 255)) }), 'PNG must use zlib, not gzip')
rejectsTexture(png(new Uint8Array(), { compressed: Uint8Array.of(120, 156, 0) }), 'truncated zlib stream')
const badAdler = deflateSync(Uint8Array.of(0, 1, 2, 3, 255))
badAdler[badAdler.length - 1] ^= 1
rejectsTexture(png(new Uint8Array(), { compressed: badAdler }), 'zlib checksum mismatch with valid chunk CRC')
rejectsTexture(Buffer.concat([png(Uint8Array.of(0, 1, 2, 3, 255)), Buffer.from([0])]), 'trailing bytes after IEND')
rejectsTexture(png(new Uint8Array(), { compressed: Buffer.concat([deflateSync(Uint8Array.of(0, 1, 2, 3, 255)), Buffer.from([0])]) }), 'trailing bytes after zlib stream')
rejectsTexture(png(Uint8Array.of(0, 2), { color: 3, palette: 2 }), 'palette index outside PLTE')
rejectsTexture(png(Uint8Array.of(0, 0), { color: 3 }), 'indexed PNG requires PLTE')
rejectsTexture(png(Uint8Array.of(0, 0), { color: 3, depth: 1, palette: 3 }), 'palette exceeds bit depth')
rejectsTexture(png(Uint8Array.of(0, 1, 2, 3, 255), { before: [chunk('acTL', new Uint8Array(8))] }), 'APNG rejected with valid CRC')
// An oversized expansion is rejected on the first 64KiB output block, without retaining the stream.
rejectsTexture(png(new Uint8Array(), { compressed: deflateSync(Buffer.alloc(8 * 1024 * 1024)) }), 'bounded decompression rejects bomb')
const idat = deflateSync(Uint8Array.of(0, 1, 2, 3, 255))
assert.equal(parseTexture(Buffer.concat([
  signature, header(), chunk('IDAT', idat.subarray(0, 3)), chunk('IDAT', idat.subarray(3)), end,
])).ok, true, 'consecutive split IDAT remains legal')
rejectsTexture(Buffer.concat([
  signature, header(), chunk('IDAT', idat.subarray(0, 3)), chunk('tEXt', Buffer.from('x\0y')),
  chunk('IDAT', idat.subarray(3)), end,
]), 'nonconsecutive IDAT')
assert.equal(pngInfo(png(Uint8Array.of(0, 1, 2, 3, 255)))?.width, 1)
console.log('PASS PNG integrity, legal color/depth/Adam7 and bounded decompression')

const longRange = {
  value: { type: 'long' as const, value: '9007199254740993' },
  min: { type: 'long' as const, value: '9007199254740992' },
  max: { type: 'long' as const, value: '9007199254740994' },
}
const longDocument = {
  ...createBossbar('long-test'),
  components: [...createBossbar('long-test').components, {
    id: 'bar', type: 'bar', box: { x: 0, y: 0, width: 100, height: 10 },
    range: longRange, fill: { kind: 'solid', color: '#FFFFFFFF' },
  }],
}
assert.equal(parseBossbarDocument(JSON.stringify(longDocument)).ok, true)
assert.equal(resolveRange(longRange, {}, {}).ratio, 0.5, 'adjacent integers above 2^53 remain exact')
for (const field of ['value', 'min', 'max'] as const) {
  for (const value of ['9223372036854775808', '-9223372036854775809']) {
    const invalid = structuredClone(longDocument)
    Object.assign(invalid.components[1], { range: { ...longRange, [field]: { type: 'long', value } } })
    const result = parseBossbarDocument(JSON.stringify(invalid))
    assert.equal(result.ok, false)
    if (!result.ok) assert.ok(result.diagnostics.some((issue) => issue.path === 'components[1].range.' + field + '.value'))
  }
}
for (const count of [29, 64]) {
  const document = { ...createBossbar('budget-test'), variables: Object.fromEntries(
    Array.from({ length: count }, (_, i) => ['v' + i, { type: 'string' as const, key: 'v' + i, default: '', maxLength: 256 }]),
  ) }
  const estimated = estimateSnapshotBytes(document).worstBytes
  const result = parseBossbarDocument(JSON.stringify(document))
  assert.equal(result.ok, estimated <= BOSSBAR_LIMITS.upsertBudgetBytes)
  if (!result.ok) assert.ok(result.diagnostics.some((issue) => issue.path === 'variables' && issue.code === 'budget'))
}
assert.equal(computeDoubleRatio(Number.MAX_VALUE, -Number.MAX_VALUE, 0), 1, 'overflow above maximum clamps full')
assert.equal(computeDoubleRatio(-Number.MAX_VALUE, 0, Number.MAX_VALUE), 0, 'below minimum clamps empty')
assert.equal(computeDoubleRatio(0, -Number.MAX_VALUE, Number.MAX_VALUE), 0.5, 'overflowing span normalizes')
assert.equal(computeDoubleRatio(1, 1, 1), 0, 'empty range remains empty')
console.log('PASS int64 constants, snapshot budget and extreme double clamping')
