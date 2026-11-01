import assert from 'node:assert/strict'
import {
  createBossbar,
  parseBossbar,
  stringifyBossbar,
} from '../src/workspaces/audiovisual/bossbar'
import { sourcePathOf } from '../src/workspace'
import { AUDIOVISUAL_CATEGORIES, resourceTypeForExtension } from '../src/resourceTypes'
import { findNewFileType } from '../src/newFileTypes'

const doc = createBossbar('demo')
assert.equal(doc.format, 'hanshu.bossbar')
assert.equal(doc.version, 1)
assert.equal(doc.id, 'demo')
assert.deepEqual(parseBossbar(stringifyBossbar(doc)), doc)
assert.throws(() => parseBossbar('{"format":"hanshu.bossbar","version":1,"id":"x","extra":1}'), /未知字段/)
assert.equal(resourceTypeForExtension('.bossbar')?.directory, 'src/bossbars')
assert.equal(sourcePathOf({ name: 'demo.bossbar' }), 'src/bossbars/demo.bossbar')
assert.equal(AUDIOVISUAL_CATEGORIES.bossbar.name, 'BOSS血条')
assert.equal(findNewFileType('bossbar')?.ext, '.bossbar')
assert.match(findNewFileType('bossbar')!.seed('demo', {
  goalDefinitions: [],
  ttsPresets: [],
  firstLocale: null,
  firstServiceId: 'svc',
  firstVoiceId: null,
}), /"format": "hanshu.bossbar"/)

console.log('PASS verify-bossbar')
