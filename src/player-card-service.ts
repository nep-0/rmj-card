import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

import sharp from 'sharp'
import { LRUCache } from 'lru-cache'

import {
  renderIdentity,
  renderPlacementLegend,
  renderPlacementChart,
  renderRecentMatches,
  renderQhRecentTiles,
  renderPromotion,
  renderRadarChart,
  renderRank,
  renderSummary,
  renderTrendChart,
} from './components.js'
import { DEFAULT_CARD_CACHE_MAX_BYTES, DEFAULT_CARD_CACHE_MAX_ENTRIES } from './card-cache-config.js'
import { FormulaClient } from './formula-client.js'
import type { PlayerCardModel } from './types.js'
import { renderOpponentRanking, renderPlayerStats } from './text-renderer.js'

const fontDataUri = readFile(resolve('NotoSansSC-Regular.otf')).then((font) => `data:font/otf;base64,${font.toString('base64')}`)

export const cardStyles = ['modern', 'QH'] as const
export type CardStyle = (typeof cardStyles)[number]

export function isCardStyle(value: string): value is CardStyle {
  return cardStyles.includes(value as CardStyle)
}

export class PlayerCardService {
  private readonly renderCache: LRUCache<string, Buffer>
  private readonly inFlightRenders = new Map<string, Promise<Buffer>>()
  private readonly renderCacheTtlMs = 5 * 60 * 1000

  constructor(
    private readonly formula: FormulaClient,
    renderCacheMaxEntries = DEFAULT_CARD_CACHE_MAX_ENTRIES,
    renderCacheMaxBytes = DEFAULT_CARD_CACHE_MAX_BYTES,
  ) {
    this.renderCache = new LRUCache({
      max: renderCacheMaxEntries,
      maxSize: renderCacheMaxBytes,
      ttl: this.renderCacheTtlMs,
      sizeCalculation: (image) => image.byteLength,
    })
  }

  async render(name: string, format: 'png' | 'svg', style: CardStyle = 'modern'): Promise<Buffer> {
    const cacheKey = `${name}\0${format}\0${style}`
    if (format === 'png') {
      const cached = this.renderCache.get(cacheKey)
      if (cached) return cached
    }
    const existing = this.inFlightRenders.get(cacheKey)
    if (existing) return existing
    const renderPromise = this.renderUncached(name, format, style)
    this.inFlightRenders.set(cacheKey, renderPromise)
    try {
      const image = await renderPromise
      if (format === 'png') this.renderCache.set(cacheKey, image)
      return image
    } finally {
      this.inFlightRenders.delete(cacheKey)
    }
  }

  private async renderUncached(name: string, format: 'png' | 'svg', style: CardStyle): Promise<Buffer> {
    if (name.trim().length === 0) throw new Error('Player name must not be empty')
    const historyResult = await this.formula.getHistory(name)
    const history = historyResult.history
    if (!history) throw new Error(`No Formula statistics found for ${name}`)
    const recordPage = await this.formula.getPlayerRecords(history.customerId, 1, 50)
    const avatarDataUri = historyResult.qq ? await this.fetchAvatar(historyResult.qq) : undefined
    const playerRecords = recordPage.records ?? []
    const latestClubName = playerRecords.filter((record) => record.mahjongName.trim().length > 0).sort((left, right) => right.logtime.localeCompare(left.logtime))[0]?.mahjongName
    const recordPlacements = playerRecords.map((record) => ({ logtime: record.logtime, placement: [record.name1, record.name2, record.name3, record.name4].indexOf(history.name) + 1 })).filter((record) => record.placement > 0).sort((left, right) => left.logtime.localeCompare(right.logtime)).map((record) => record.placement)
    const historyPlacements = history.recentlyPosition.split(',').filter(Boolean).map(Number).filter((value) => value >= 1 && value <= 4).reverse()
    const historyPoints = history.recentlyPoint.split(',').filter(Boolean).map(Number).reverse()
    const model: PlayerCardModel = { history, qq: historyResult.qq, avatarDataUri, latestClubName, recentPlacements: recordPlacements.length > 0 ? recordPlacements : historyPlacements, recentPoints: historyPoints }
    const svg = await this.renderStyleSvg(model, style)
    return format === 'svg' ? Buffer.from(svg) : sharp(Buffer.from(svg)).png().toBuffer()
  }

  async renderStatsText(name: string): Promise<string> {
    const history = await this.requireHistory(name)
    return renderPlayerStats(history)
  }

  async renderGoodOpponentText(name: string): Promise<string> {
    const history = await this.requireHistory(name)
    const firstPage = await this.formula.getOpponentStats(history.customerId, 1, 10)
    const total = firstPage.total ?? firstPage.records?.length ?? 0
    const lastPageNumber = firstPage.pages ?? Math.ceil(total / 10)
    const pageNumbers = [Math.max(1, lastPageNumber - 1), lastPageNumber].filter((pageNo, index, values) => values.indexOf(pageNo) === index)
    const pages = await Promise.all(pageNumbers.map((pageNo) => this.formula.getOpponentStats(history.customerId, pageNo, 10)))
    return renderOpponentRanking(history.name, pages.flatMap((page) => page.records ?? []).slice(-10), '好人榜')
  }

  async renderBadOpponentText(name: string): Promise<string> {
    const history = await this.requireHistory(name)
    const page = await this.formula.getOpponentStats(history.customerId, 1, 10)
    return renderOpponentRanking(history.name, (page.records ?? []).slice(0, 10), '仇人榜')
  }

  private async requireHistory(name: string) {
    if (name.trim().length === 0) throw new Error('Player name must not be empty')
    const result = await this.formula.getHistory(name)
    if (!result.history) throw new Error(`No Formula statistics found for ${name}`)
    return result.history
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

  private renderStyleSvg(model: PlayerCardModel, style: CardStyle): Promise<string> {
    return style === 'modern' ? this.renderModernSvg(model) : this.renderQhSvg(model)
  }

  private async renderModernSvg(model: PlayerCardModel): Promise<string> {
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

  private async renderQhSvg(model: PlayerCardModel): Promise<string> {
    const [font, radar, placement] = await Promise.all([
      fontDataUri,
      renderRadarChart(model),
      renderPlacementChart(model),
    ])
    return `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="1100" viewBox="0 0 1280 1100">
      <style>
        @font-face { font-family: "RMJ Noto Sans SC"; src: url("${font}") format("opentype"); font-weight: 400; font-style: normal; }
        text { font-family: "RMJ Noto Sans SC", sans-serif; }
        .card { fill: #ffffff; stroke: #e4eaf4; stroke-width: 1; } .name { font-size: 36px; font-weight: 700; fill: #1e3a8a; } .club { font-size: 17px; fill: #55708f; } .metric { font-size: 18px; fill: #27364a; } .value { font-size: 31px; font-weight: 700; fill: #1e3a8a; text-anchor: middle; } .label { font-size: 16px; fill: #5c6c80; text-anchor: middle; } .requirement { font-size: 13px; fill: #7b8797; text-anchor: middle; } .rank { font-size: 41px; font-weight: 700; fill: #1e3a8a; } .rate { font-size: 22px; fill: #27364a; } .section { font-size: 21px; font-weight: 700; fill: #15243f; } .promotion { fill: #ffffff; font-size: 17px; } .recent-header { font-size: 17px; fill: #475569; } .recent-range { font-size: 17px; fill: #0f766e; } .recent-values { font-size: 20px; font-weight: 700; fill: #15243f; } .qh-placement { font-size: 32px; font-weight: 700; } .qh-point { font-size: 25px; font-weight: 700; fill: #172033; } .qh-empty { font-size: 18px; fill: #7b8797; }
      </style>
      <rect width="1280" height="1100" fill="#f5f7fb"/>
      <rect class="card" x="20" y="20" width="350" height="220" rx="8"/><rect class="card" x="390" y="20" width="430" height="220" rx="8"/><rect class="card" x="840" y="20" width="420" height="220" rx="8"/>
      ${renderIdentity(model)}${renderSummary(model)}${renderRank(model)}
      <rect class="card" x="20" y="260" width="1240" height="430" rx="8"/><text x="640" y="295" text-anchor="middle" class="section">最近顺位数据（旧 → 新）</text>${renderQhRecentTiles(model)}${renderRecentMatches(model)}<rect x="20" y="585" width="1240" height="78" rx="8" fill="#1d4ed8"/>${renderPromotion(model)}
      <rect class="card" x="20" y="710" width="590" height="370" rx="8"/><text x="315" y="745" text-anchor="middle" class="section">能力分析</text><g transform="translate(30 750)">${radar}</g>
      <rect class="card" x="630" y="710" width="630" height="370" rx="8"/><text x="945" y="745" class="section" text-anchor="middle">顺位分布</text><g transform="translate(660 750)">${placement}</g>${renderPlacementLegend(model)}
    </svg>`
  }
}
