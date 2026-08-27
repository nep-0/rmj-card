import type { ClubMatchRecord } from './types.js'
import { FormulaClient } from './formula-client.js'
import { MatchReportRegistry } from './match-report-registry.js'

export function renderMatchReport(record: ClubMatchRecord): string {
  return [
    `1. ${record.name1} ${record.point1}`,
    `2. ${record.name2} ${record.point2}`,
    `3. ${record.name3} ${record.point3}`,
    `4. ${record.name4} ${record.point4}`,
  ].join('\n')
}

export class MatchReporter {
  private timer?: ReturnType<typeof setInterval>

  constructor(
    private readonly formula: FormulaClient,
    private readonly registry: MatchReportRegistry,
    private readonly send: (groupId: string, message: string) => Promise<void>,
    private readonly intervalMs: number,
  ) {}

  start(): void { if (!this.timer) this.timer = setInterval(() => { void this.poll() }, this.intervalMs) }
  stop(): void { if (this.timer) clearInterval(this.timer); this.timer = undefined }
  async begin(groupId: string): Promise<void> {
    const state = await this.registry.get(groupId)
    if (!state) throw new Error('本群尚未配置对局报告，请先使用 /add 场所ID')
    const records = (await this.formula.getClubMatchRecords(state.clubId, 12)).records ?? []
    await this.registry.setBaseline(groupId, records)
    await this.registry.setRunning(groupId, true)
  }
  async end(groupId: string): Promise<void> { await this.registry.setRunning(groupId, false) }
  async poll(): Promise<void> {
    const groups = await this.registry.listRunning()
    await Promise.all(groups.map(async ([groupId, state]) => {
      const records = (await this.formula.getClubMatchRecords(state.clubId, 12)).records ?? []
      const fresh = await this.registry.updateMatches(groupId, records)
      await Promise.all(fresh.reverse().map((record) => this.send(groupId, renderMatchReport(record))))
    }))
  }
}
