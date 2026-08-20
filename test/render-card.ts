import { writeFile } from 'node:fs/promises'

import { PlayerCardService } from '../src/player-card-service.js'
import type { FormulaHistory } from '../src/types.js'

const history: FormulaHistory = {
  customerId: '23340', name: '邀月', grade: 13, avgPoint: 255.77, rate: 1602, totalScore: 2771.6,
  totalPosition: 2569, recentlyPosition: '2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2,2', recentlyPoint: '162,119,410',
  upPosition: 1886, upAvgPosition: 2.54, sumPosition: 127, position1: 698, position2: 594,
  position3: 636, position4: 641, fire: 2.47, attack: 2771.6, technique: 1.08, luck: 0.2717,
  stability: 0.5029, defense: 0.7505, maxPoint: 936, nationaSort: 2700, mahjongSort: 9,
  knockBackNum: 228, version: 82, versionDate: '2026-08-17 23:40:51',
}

const service = new PlayerCardService({
  getHistory: async () => ({ history, qq: '526482608' }),
  getPlayerRecords: async () => ({ records: [] }),
} as never)
const svg = await service.render('邀月', 'svg')
const png = await service.render('邀月', 'png')
if (!svg.subarray(0, 4).equals(Buffer.from('<svg'))) throw new Error('Expected SVG output')
if (!png.subarray(1, 4).equals(Buffer.from('PNG'))) throw new Error('Expected PNG output')
if (!svg.includes('1-5') || !svg.includes('46-50')) throw new Error('Expected grouped recent match history')
const compactHistory = { ...history, grade: 1, sumPosition: 13, upAvgPosition: 2, upPosition: 50 }
const compactSvg = await new PlayerCardService({
  getHistory: async () => ({ history: compactHistory, qq: '526482608' }),
  getPlayerRecords: async () => ({ records: [] }),
} as never).render('邀月', 'svg')
if (!compactSvg.includes('1-5') || !compactSvg.includes('6-7') || compactSvg.includes('46-50')) {
  throw new Error('Expected compact promotion match groups')
}
await writeFile('/tmp/rmj-card-compact-fixture.png', await new PlayerCardService({
  getHistory: async () => ({ history: compactHistory, qq: '526482608' }),
  getPlayerRecords: async () => ({ records: [] }),
} as never).render('邀月', 'png'))
const nepHistory = { ...history, name: 'NeP', grade: 7, sumPosition: 18, upAvgPosition: 3, upPosition: 6, recentlyPosition: '4,2,2,2,4,4,2,3,3,3' }
const nepSvg = await new PlayerCardService({
  getHistory: async () => ({ history: nepHistory }),
  getPlayerRecords: async () => ({ records: [] }),
} as never).render('NeP', 'svg')
if (!nepSvg.includes('1-5') || !nepSvg.includes('6-6') || nepSvg.includes('16-20')) {
  throw new Error('Expected NeP six-match history groups')
}
if (!nepSvg.includes('快速') || !nepSvg.includes('宽松') || !nepSvg.includes('14 半庄顺位之和 ≤ 31')) {
  throw new Error('Expected NeP promotion paths to include remaining required matches')
}
await writeFile('/tmp/rmj-card-nep-fixture.png', await new PlayerCardService({
  getHistory: async () => ({ history: nepHistory }),
  getPlayerRecords: async () => ({ records: [] }),
} as never).render('NeP', 'png'))
await writeFile('/tmp/rmj-card-fixture.svg', svg)
await writeFile('/tmp/rmj-card-fixture.png', png)
console.log(`Rendered SVG (${svg.length} bytes) and PNG (${png.length} bytes)`)
