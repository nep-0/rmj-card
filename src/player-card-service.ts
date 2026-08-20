import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import sharp from 'sharp'

import {
  renderIdentity,
  renderPlacementLegend,
  renderPlacementChart,
  renderRecentMatches,
  renderPromotion,
  renderRadarChart,
  renderRank,
  renderSummary,
  renderTrendChart,
} from './components.js'
import { FormulaClient } from './formula-client.js'
import type { PlayerCardModel } from './types.js'

const fontDataUri = readFile(resolve('NotoSansSC-Regular.otf')).then((font) => `data:font/otf;base64,${font.toString('base64')}`)

export class PlayerCardService {
  constructor(private readonly formula: FormulaClient) {}

  async render(name: string, format: 'png' | 'svg'): Promise<Buffer> {
    if (name.trim().length === 0) throw new Error('Player name must not be empty')
    const historyResult = await this.formula.getHistory(name)
    const history = historyResult.history
    if (!history) throw new Error(`No Formula statistics found for ${name}`)

    const recordPage = await this.formula.getPlayerRecords(history.customerId, 1, 50)
    const avatarDataUri = historyResult.qq ? await this.fetchAvatar(historyResult.qq) : undefined
    const playerRecords = recordPage.records ?? []
    const latestClubName = playerRecords
      .filter((record) => record.mahjongName.trim().length > 0)
      .sort((left, right) => right.logtime.localeCompare(left.logtime))[0]
      ?.mahjongName
    const recordPlacements = playerRecords
      .map((record) => ({
        logtime: record.logtime,
        placement: [record.name1, record.name2, record.name3, record.name4].indexOf(history.name) + 1,
      }))
      .filter((record) => record.placement > 0)
      .sort((left, right) => left.logtime.localeCompare(right.logtime))
      .map((record) => record.placement)
    const recentPlacements = recordPlacements.length > 0
      ? recordPlacements
      : history.recentlyPosition.split(',').filter(Boolean).map(Number).filter((value) => value >= 1 && value <= 4)
    const model: PlayerCardModel = {
      history,
      qq: historyResult.qq,
      avatarDataUri,
      latestClubName,
      recentPlacements,
      recentPoints: history.recentlyPoint.split(',').filter(Boolean).map(Number),
    }
    const svg = await this.renderSvg(model)
    return format === 'svg' ? Buffer.from(svg) : sharp(Buffer.from(svg)).png().toBuffer()
  }

  private async fetchAvatar(qq: string): Promise<string | undefined> {
    if (!/^\d{5,12}$/.test(qq)) return undefined
    const response = await fetch(`https://q1.qlogo.cn/g?b=qq&s=640&nk=${qq}`)
    if (!response.ok) return undefined
    const contentType = response.headers.get('content-type')
    if (!contentType?.startsWith('image/')) return undefined
    const avatar = Buffer.from(await response.arrayBuffer())
    if (avatar.length === 0 || avatar.length > 2_000_000) return undefined
    return `data:${contentType};base64,${avatar.toString('base64')}`
  }

  private async renderSvg(model: PlayerCardModel): Promise<string> {
    const [font, trend, radar, placement] = await Promise.all([
      fontDataUri,
      renderTrendChart(model),
      renderRadarChart(model),
      renderPlacementChart(model),
    ])
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1100" viewBox="0 0 1280 1100">
      <style>
        @font-face { font-family: "RMJ Noto Sans SC"; src: url("${font}") format("opentype"); font-weight: 400; font-style: normal; }
        text { font-family: "RMJ Noto Sans SC", sans-serif; }
        .card { fill: #ffffff; stroke: #e4eaf4; stroke-width: 1; } .name { font-size: 36px; font-weight: 700; fill: #1e3a8a; } .club { font-size: 17px; fill: #55708f; } .metric { font-size: 18px; fill: #27364a; } .value { font-size: 31px; font-weight: 700; fill: #1e3a8a; text-anchor: middle; } .label { font-size: 16px; fill: #5c6c80; text-anchor: middle; } .requirement { font-size: 13px; fill: #7b8797; text-anchor: middle; } .rank { font-size: 41px; font-weight: 700; fill: #1e3a8a; } .rate { font-size: 22px; fill: #27364a; } .section { font-size: 21px; font-weight: 700; fill: #15243f; } .promotion { fill: #ffffff; font-size: 17px; } .recent-header { font-size: 17px; fill: #475569; } .recent-range { font-size: 17px; fill: #0f766e; } .recent-values { font-size: 20px; font-weight: 700; fill: #15243f; } .recent-empty { font-size: 17px; fill: #7b8797; }
      </style>
      <rect width="1280" height="1100" fill="#f5f7fb"/>
      <rect class="card" x="20" y="20" width="350" height="220" rx="8"/><rect class="card" x="390" y="20" width="430" height="220" rx="8"/><rect class="card" x="840" y="20" width="420" height="220" rx="8"/>
      ${renderIdentity(model)}${renderSummary(model)}${renderRank(model)}
      <rect class="card" x="20" y="260" width="1240" height="430" rx="8"/><text x="640" y="295" text-anchor="middle" class="section">最近顺位数据（旧 → 新）</text><g transform="translate(175 315)">${trend}</g>${renderRecentMatches(model)}<rect x="20" y="585" width="1240" height="78" rx="8" fill="#1d4ed8"/>${renderPromotion(model)}
      <rect class="card" x="20" y="710" width="590" height="370" rx="8"/><text x="315" y="745" text-anchor="middle" class="section">能力分析</text><g transform="translate(30 750)">${radar}</g>
      <rect class="card" x="630" y="710" width="630" height="370" rx="8"/><text x="945" y="745" class="section" text-anchor="middle">顺位分布</text><g transform="translate(660 750)">${placement}</g>${renderPlacementLegend(model)}
    </svg>`
  }
}
