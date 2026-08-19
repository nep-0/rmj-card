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
await writeFile('/tmp/rmj-card-fixture.svg', svg)
await writeFile('/tmp/rmj-card-fixture.png', png)
console.log(`Rendered SVG (${svg.length} bytes) and PNG (${png.length} bytes)`)
