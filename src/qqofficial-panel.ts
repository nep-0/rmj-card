type FetchLike = typeof fetch

export type CommandPanelItem = {
  name: string
  type: 'command' | 'link'
  desc?: string
  only_admin?: boolean
  link?: string
}

export type CommandPanel = {
  items: readonly CommandPanelItem[]
  remark?: string
}

type PanelRecord = {
  panel_id: string
  scope: string
  target_type: string
  panel: CommandPanel & { version?: number }
}

type PanelList = { records?: PanelRecord[] }
type PanelDetail = { panel?: { version?: number } }
type TokenResponse = { access_token?: string; expires_in?: number }

const tokenUrl = 'https://bots.qq.com/app/getAppAccessToken'
const apiBaseUrl = 'https://api.sgroup.qq.com'

export class QqOfficialPanelClient {
  private accessToken = ''
  private tokenExpiresAt = 0

  constructor(
    private readonly appid: string,
    private readonly secret: string,
    private readonly request: FetchLike = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  async synchronizeGroupPanel(panel: CommandPanel, groupOpenids: readonly string[]): Promise<void> {
    if (groupOpenids.length === 0) return

    const panels = await this.requestJson<PanelList>('GET', '/v2/panels?scope=group&limit=100')
    const matching = panels.records?.find((record) =>
      record.target_type === 'specific' && record.panel.remark === panel.remark,
    )

    if (!matching) {
      await this.requestJson('POST', '/v2/panels', {
        scope: 'group',
        target_type: 'specific',
        group_openids: groupOpenids,
        panel,
      })
      return
    }

    const detail = await this.requestJson<PanelDetail>('GET', `/v2/panels/${encodeURIComponent(matching.panel_id)}`)
    await this.requestJson('PUT', `/v2/panels/${encodeURIComponent(matching.panel_id)}`, {
      panel: { ...panel, ...(typeof detail.panel?.version === 'number' ? { version: detail.panel.version } : {}) },
    })
    await this.requestJson('PUT', `/v2/panels/${encodeURIComponent(matching.panel_id)}/target`, {
      op: 'add',
      group_openids: groupOpenids,
    })
  }

  private async requestJson<T = Record<string, never>>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<T> {
    const accessToken = await this.getAccessToken()
    const response = await this.request(`${apiBaseUrl}${path}`, {
      method,
      headers: {
        Authorization: `QQBot ${accessToken}`,
        'Content-Type': 'application/json',
        'X-Union-Appid': this.appid,
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
    const data = await response.json().catch(() => ({})) as Record<string, unknown>
    if (!response.ok) throw new Error(`QQ command panel API failed: HTTP ${response.status}, code=${String(data.code ?? 'unknown')}`)
    return data as T
  }

  private async getAccessToken(): Promise<string> {
    if (this.accessToken && this.now() < this.tokenExpiresAt) return this.accessToken

    const response = await this.request(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: this.appid, clientSecret: this.secret }),
    })
    const data = await response.json().catch(() => ({})) as TokenResponse
    if (!response.ok || !data.access_token) throw new Error(`QQ access token request failed: HTTP ${response.status}`)

    this.accessToken = data.access_token
    const expiresInSeconds = typeof data.expires_in === 'number' ? data.expires_in : 7200
    this.tokenExpiresAt = this.now() + Math.max(30, expiresInSeconds - 60) * 1000
    return this.accessToken
  }
}
