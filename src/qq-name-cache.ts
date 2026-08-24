import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

const qqIdentifierPattern = /^[A-Za-z0-9_-]{1,128}$/

export class QqNameCache {
  private readonly values: Record<string, string> = {}
  private loaded = false
  private writePromise = Promise.resolve()

  constructor(private readonly file: string) {}

  async getName(qq: string): Promise<string | undefined> {
    await this.load()
    return this.values[qq.trim()]
  }

  async remember(qq: string, name: string): Promise<void> {
    await this.load()
    const normalizedQq = qq.trim()
    const normalizedName = name.trim()
    if (!qqIdentifierPattern.test(normalizedQq) || !normalizedName) return
    this.values[normalizedQq] = normalizedName
    const data = Object.fromEntries(Object.entries(this.values).sort(([left], [right]) => left.localeCompare(right)))
    this.writePromise = this.writePromise.then(async () => {
      await mkdir(dirname(this.file), { recursive: true })
      await writeFile(this.file, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    })
    await this.writePromise
  }

  private async load(): Promise<void> {
    if (this.loaded) return
    this.loaded = true
    try {
      const data = JSON.parse(await readFile(this.file, 'utf8')) as Record<string, unknown>
      for (const [qq, name] of Object.entries(data)) {
        if (qqIdentifierPattern.test(qq) && typeof name === 'string' && name.trim()) this.values[qq] = name
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error
    }
  }
}
