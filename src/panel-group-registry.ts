import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export class PanelGroupRegistry {
  private readonly groupIds = new Set<string>()
  private loaded = false
  private writePromise = Promise.resolve()

  constructor(private readonly file: string) {}

  async list(): Promise<string[]> {
    await this.load()
    return [...this.groupIds].sort()
  }

  async add(groupId: string): Promise<boolean> {
    await this.load()
    const normalized = groupId.trim()
    if (!normalized || this.groupIds.has(normalized)) return false
    this.groupIds.add(normalized)
    const data = [...this.groupIds].sort()
    this.writePromise = this.writePromise.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      await writeFile(this.file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    })
    await this.writePromise
    return true
  }

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8')) as unknown
      if (Array.isArray(data)) {
        for (const groupId of data) if (typeof groupId === 'string' && groupId.trim()) this.groupIds.add(groupId.trim())
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}
