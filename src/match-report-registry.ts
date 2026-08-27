import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { ClubMatchRecord } from './types.js'

type GroupReportState = { clubId: string; admins: string[]; running: boolean; lastMatchIds: string[] }
type StoredState = Record<string, GroupReportState>

export class MatchReportRegistry {
  private states: StoredState = {}
  private loaded = false
  private writePromise = Promise.resolve()

  constructor(private readonly file: string) {}

  async get(groupId: string): Promise<GroupReportState | undefined> {
    await this.load()
    return this.states[groupId]
  }

  async listRunning(): Promise<[string, GroupReportState][]> {
    await this.load()
    return Object.entries(this.states).filter(([, state]) => state.running)
  }

  async add(groupId: string, clubId: string, adminId: string): Promise<boolean> {
    await this.load()
    if (this.states[groupId]) return false
    this.states[groupId] = { clubId: clubId.trim(), admins: [adminId.trim()], running: false, lastMatchIds: [] }
    await this.persist()
    return true
  }

  async isAdmin(groupId: string, userId: string): Promise<boolean> {
    return (await this.get(groupId))?.admins.includes(userId.trim()) ?? false
  }

  async addAdmin(groupId: string, userId: string): Promise<boolean> {
    const state = await this.require(groupId)
    const normalizedUserId = userId.trim()
    if (!normalizedUserId || state.admins.includes(normalizedUserId)) return false
    state.admins.push(normalizedUserId)
    await this.persist()
    return true
  }

  async setRunning(groupId: string, running: boolean): Promise<void> {
    const state = await this.require(groupId)
    state.running = running
    await this.persist()
  }

  async setBaseline(groupId: string, records: ClubMatchRecord[]): Promise<void> {
    const state = await this.require(groupId)
    state.lastMatchIds = records.map(matchId).filter(Boolean).slice(0, 12)
    await this.persist()
  }

  async updateMatches(groupId: string, records: ClubMatchRecord[]): Promise<ClubMatchRecord[]> {
    const state = await this.require(groupId)
    const previous = new Set(state.lastMatchIds)
    const fresh = records.filter((record) => {
      const id = matchId(record)
      return id !== '' && !previous.has(id)
    })
    state.lastMatchIds = records.map(matchId).filter(Boolean).slice(0, 12)
    await this.persist()
    return fresh
  }
  private async require(groupId: string): Promise<GroupReportState> { const state = await this.get(groupId); if (!state) throw new Error('本群尚未配置比赛报告，请先使用 /add 场所ID'); return state }
  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try { this.states = JSON.parse(await readFile(this.file, 'utf8')) as StoredState } catch (error) { if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error }
  }
  private async persist(): Promise<void> {
    this.writePromise = this.writePromise.then(async () => { await mkdir(dirname(this.file), { recursive: true }); await writeFile(this.file, `${JSON.stringify(this.states, null, 2)}\n`, 'utf8') })
    await this.writePromise
  }
}

function matchId(record: ClubMatchRecord): string { return String(record.id ?? record.recordId ?? '') }
export type { GroupReportState }
