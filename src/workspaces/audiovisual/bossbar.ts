import { randomId } from '../../project/crypto'

/** BOSS 血条文档：首版只保证可落盘与 JSON 往返，可视化编辑器后补。 */
export type BossbarDocument = {
  format: 'hanshu.bossbar'
  version: 1
  id: string
}

export function createBossbar(id = ''): BossbarDocument {
  const trimmed = id.trim()
  return {
    format: 'hanshu.bossbar',
    version: 1,
    id: trimmed || randomId(),
  }
}

export function stringifyBossbar(doc: BossbarDocument): string {
  return `${JSON.stringify(doc, null, 2)}\n`
}

export function parseBossbar(source: string): BossbarDocument {
  let raw: unknown
  try {
    raw = JSON.parse(source)
  } catch (cause) {
    throw new Error(`BOSS 血条 JSON 无法解析：${cause instanceof Error ? cause.message : String(cause)}`)
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('BOSS 血条正文必须是 JSON 对象')
  }
  const record = raw as Record<string, unknown>
  if (record.format !== 'hanshu.bossbar') throw new Error('format 必须是 hanshu.bossbar')
  if (record.version !== 1) throw new Error('version 必须是 1')
  if (typeof record.id !== 'string' || !record.id.trim()) throw new Error('id 必须是非空字符串')
  const known = new Set(['format', 'version', 'id'])
  for (const key of Object.keys(record)) {
    if (!known.has(key)) throw new Error(`未知字段：${key}`)
  }
  return { format: 'hanshu.bossbar', version: 1, id: record.id.trim() }
}
