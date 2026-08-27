import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { MatchReporter } from '../src/match-reporter.js'
import { MatchReportRegistry } from '../src/match-report-registry.js'
import type { ClubMatchRecord } from '../src/types.js'

const temporaryDirectory = await mkdtemp(join(tmpdir(), 'rmj-match-report-'))
try {
  const registry = new MatchReportRegistry(join(temporaryDirectory, 'reports.json'))
  await registry.add('group-1', '122', 'owner')
  if (!await registry.isAdmin('group-1', 'owner')) throw new Error('Expected /add sender to be an administrator')
  if (await registry.isAdmin('group-1', 'member')) throw new Error('Unexpected administrator access')
  if (!await registry.addAdmin('group-1', 'member') || !await registry.isAdmin('group-1', 'member')) throw new Error('Expected administrator addition')

  const records = (ids: string[]): ClubMatchRecord[] => ids.map((id, index) => ({
    id, mahjongId: '122', mahjongName: 'Club 122',
    name1: `A${index}`, point1: 400, name2: `B${index}`, point2: 300,
    name3: `C${index}`, point3: 200, name4: `D${index}`, point4: 100,
    logtime: '2026-08-27 12:00:00',
  }))
  let latest = records(['r12', 'r11', 'r10'])
  const sent: string[] = []
  const reporter = new MatchReporter({
    getClubMatchRecords: async (clubId: string, pageSize: number) => {
      if (clubId !== '122' || pageSize !== 12) throw new Error('Expected configured club and 12-match page')
      return { records: latest }
    },
  } as never, registry, async (_groupId, message) => { sent.push(message) }, 30_000)

  await reporter.begin('group-1')
  if (sent.length !== 0) throw new Error('Expected /start baseline to suppress existing matches')
  latest = records(['r13', 'r12', 'r11', 'r10'])
  await reporter.poll()
  if (sent[0] !== '1. A0 400\n2. B0 300\n3. C0 200\n4. D0 100') throw new Error('Expected the requested four-line match report')
  await reporter.end('group-1')
  latest = records(['r14', 'r13', 'r12'])
  await reporter.poll()
  if (sent[1] !== undefined) throw new Error('Expected /stop to suppress polling reports')
  console.log('Match reporting baselines on start, reports new club matches, and stops cleanly')
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true })
}
