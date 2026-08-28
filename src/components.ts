import ApexCharts from 'apexcharts/ssr'

import { getGrade } from './grade.js'
import type { PlayerCardModel } from './types.js'

const navy = '#1d4ed8'
const lime = '#a3e635'
const amber = '#fbbf24'
const red = '#f87171'

function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

export function renderIdentity(model: PlayerCardModel): string {
  const { history, avatarDataUri } = model
  const avatar = avatarDataUri
    ? `<clipPath id="avatar-clip"><circle cx="92" cy="130" r="58"/></clipPath><image href="${avatarDataUri}" x="34" y="72" width="116" height="116" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/><circle cx="92" cy="130" r="58" fill="none" stroke="#dbe4f3" stroke-width="3"/>`
    : '<circle cx="92" cy="130" r="58" fill="#dbe4f3"/>'
  const clubName = model.latestClubName ? escapeXml(model.latestClubName) : '雀庄未知'
  return `<g>${avatar}<text x="174" y="77" class="name">${escapeXml(history.name)}</text><text x="174" y="113" class="club">${clubName}</text><text x="174" y="150" class="metric">全国排名 #${history.nationaSort}</text><text x="174" y="183" class="metric">雀庄排名 #${history.mahjongSort}</text><text x="174" y="216" class="metric">总局数 ${history.totalPosition}</text></g>`
}

export function renderSummary(model: PlayerCardModel): string {
  const { history } = model
  const grade = getGrade(history.grade)
  const averageRequirement = grade && grade.promotionGameTarget > 0 ? `（≤${grade.promotionAverageMax.toFixed(1)} 可升段）` : '（最高段位）'
  const sumRequirement = grade && grade.promotionGameTarget > 0 ? `（≤${grade.promotionSumMax} 可升段）` : '（最高段位）'
  return `<g class="summary"><text x="500" y="83" class="value">${history.maxPoint}</text><text x="500" y="112" class="label">最高点数</text><text x="710" y="83" class="value">${history.avgPoint.toFixed(2)}</text><text x="710" y="112" class="label">平均点数</text><text x="500" y="168" class="value">${history.upAvgPosition.toFixed(2)}</text><text x="500" y="197" class="label">当前均顺</text><text x="500" y="218" class="requirement">${averageRequirement}</text><text x="710" y="168" class="value">${history.sumPosition}</text><text x="710" y="197" class="label">顺位之和</text><text x="710" y="218" class="requirement">${sumRequirement}</text></g>`
}

export function renderRank(model: PlayerCardModel): string {
  const grade = getGrade(model.history.grade)
  const rank = grade?.name ?? `等级 ${model.history.grade}`
  return `<g text-anchor="middle"><text x="1040" y="113" class="rank">${rank}</text><text x="1040" y="154" class="rate">RATE #${model.history.rate}</text></g>`
}

const fastestColor = '#16a34a'
const loosestColor = '#dc2626'

type PromotionPath = {
  games: number
  requiredSum: number
  averagePlacement: number
}

function getPromotionPaths(model: PlayerCardModel): { fastest: PromotionPath; loosest: PromotionPath } | undefined {
  const grade = getGrade(model.history.grade)
  if (!grade || grade.promotionGameTarget === 0 || model.history.upAvgPosition <= 0) return undefined
  const promotionGames = Math.round(model.history.sumPosition / model.history.upAvgPosition)
  const history = model.recentPlacements.slice(-Math.min(promotionGames, grade.promotionGameTarget))
  const minimumFutureGames = Math.max(1, grade.promotionGameTarget - history.length)
  const candidates = Array.from(
    { length: grade.promotionGameTarget - minimumFutureGames + 1 },
    (_, index) => minimumFutureGames + index,
  )
    .map((games) => {
      const retainedGames = Math.max(0, grade.promotionGameTarget - games)
      const retainedSum = retainedGames === 0 ? 0 : history.slice(-retainedGames).reduce((total, value) => total + value, 0)
      const requiredSum = grade.promotionSumMax - retainedSum
      return { games, requiredSum, averagePlacement: requiredSum / games }
    })
    .filter((candidate) => candidate.requiredSum >= candidate.games && candidate.requiredSum <= candidate.games * 4)
  if (candidates.length === 0) return undefined
  return {
    fastest: candidates[0],
    loosest: candidates.reduce((best, candidate) => candidate.averagePlacement > best.averagePlacement ? candidate : best),
  }
}

export async function renderTrendChart(model: PlayerCardModel): Promise<string> {
  const placements = model.recentPlacements.slice(-50)
  const paths = getPromotionPaths(model)
  const latest = placements.at(-1)
  const projectionLength = Math.max(paths?.fastest.games ?? 0, paths?.loosest.games ?? 0)
  const categories = Array.from({ length: placements.length + projectionLength }, (_, index) => `${index + 1}`)
  const fastestProjection = paths && latest !== undefined
    ? [...Array(placements.length - 1).fill(null), latest, ...Array(paths.fastest.games).fill(paths.fastest.averagePlacement)]
    : []
  const loosestProjection = paths && latest !== undefined
    ? [...Array(placements.length - 1).fill(null), latest, ...Array(paths.loosest.games).fill(paths.loosest.averagePlacement)]
    : []
  return ApexCharts.renderToString({
    chart: { type: 'line', height: 150, toolbar: { show: false }, animations: { enabled: false }, parentHeightOffset: 0 },
    series: [
      { name: '最近 50 局', data: placements },
      { name: '最快升段预测', data: fastestProjection },
      { name: '最宽松升段预测', data: loosestProjection },
    ],
    stroke: { width: [3, 2, 2], curve: 'straight', dashArray: [0, 7, 7] },
    markers: { size: [3, 0, 0], strokeWidth: 2, strokeColors: '#ffffff', hover: { size: 4 } },
    colors: [navy, fastestColor, loosestColor],
    xaxis: { categories, labels: { show: false }, axisBorder: { show: false }, axisTicks: { show: false } },
    yaxis: { min: 1, max: 4, reversed: true, tickAmount: 3, labels: { show: false } },
    grid: { borderColor: '#dbe4f3', padding: { left: 12, right: 54, top: 6, bottom: 0 } },
    dataLabels: {
      enabled: true,
      enabledOnSeries: [1, 2],
      formatter: (_value, options) => {
        const projection = options?.seriesIndex === 1 ? fastestProjection : loosestProjection
        if (!options || options.seriesIndex < 1 || options.dataPointIndex !== projection.length - 1) return ''
        return options.seriesIndex === 1 ? '快速' : '宽松'
      },
      offsetX: 7,
      style: { fontSize: '13px', fontWeight: 600, colors: [navy, fastestColor, loosestColor] },
      background: { enabled: false },
    },
    legend: { show: false },
  }, { width: 930, height: 150 })
}


export function renderRecentMatches(model: PlayerCardModel, count?: number): string {
  const promotionGames = model.history.upAvgPosition > 0
    ? Math.round(model.history.sumPosition / model.history.upAvgPosition)
    : 0
  const requestedCount = count ?? promotionGames
  const matches = model.recentPlacements.slice(-Math.min(requestedCount, 50))
  const groups = Array.from({ length: Math.ceil(matches.length / 5) }, (_, index) => matches.slice(index * 5, index * 5 + 5))
  if (groups.length === 0) return '<text x="640" y="545" class="recent-empty" text-anchor="middle">暂无最近对局数据</text>'
  const groupWidth = 104
  const startX = 640 - groups.length * groupWidth / 2
  const cells = groups.map((group, index) => {
    const start = index * 5 + 1
    const x = startX + index * groupWidth + groupWidth / 2
    return `<text x="${x}" y="535" class="recent-range" text-anchor="middle">${start}-${start + group.length - 1}</text><text x="${x}" y="562" class="recent-values" text-anchor="middle">${group.join('')}</text>`
  }).join('')
  return `<g><text x="${startX - 42}" y="535" class="recent-header">场次</text><text x="${startX - 42}" y="562" class="recent-header">顺位</text>${cells}</g>`
}

export function renderQhRecentTiles(model: PlayerCardModel): string {
  const placements = model.history.recentlyPosition.split(',').map(Number).filter((value) => value >= 1 && value <= 4).reverse()
  const points = model.history.recentlyPoint.split(',').map(Number).filter(Number.isFinite).reverse()
  const count = Math.min(10, placements.length, points.length)
  if (count === 0) return '<text x="640" y="455" class="qh-empty" text-anchor="middle">暂无最近对局数据</text>'
  const recentPlacements = placements.slice(-count)
  const recentPoints = points.slice(-count)
  const tileWidth = 94
  const gap = 18
  const totalWidth = count * tileWidth + (count - 1) * gap
  const startX = (1280 - totalWidth) / 2
  const colors = [
    { fill: '#e5e9f5', stroke: '#c7d1ea', text: '#315aa4' },
    { fill: '#eaf5e4', stroke: '#d1e7c4', text: '#67ad56' },
    { fill: '#fff6dd', stroke: '#f5eac8', text: '#e9ae2f' },
    { fill: '#fbe8e8', stroke: '#f3cccc', text: '#e36363' },
  ]
  return recentPlacements.map((placement, index) => {
    const x = startX + index * (tileWidth + gap)
    const color = colors[placement - 1]
    return `<rect x="${x}" y="330" width="${tileWidth}" height="58" rx="10" fill="${color.fill}" stroke="${color.stroke}" stroke-width="2"/><text x="${x + tileWidth / 2}" y="370" class="qh-placement" text-anchor="middle" style="fill:${color.text}">${placement}</text><rect x="${x}" y="417" width="${tileWidth}" height="58" rx="10" fill="#ffffff" stroke="#e5e7eb" stroke-width="2"/><text x="${x + tileWidth / 2}" y="457" class="qh-point" text-anchor="middle">${recentPoints[index]}</text>`
  }).join('')
}
export async function renderRadarChart(model: PlayerCardModel): Promise<string> {
  const { history } = model
  const svg = await ApexCharts.renderToString({
    chart: { type: 'radar', height: 315, toolbar: { show: false }, animations: { enabled: false }, parentHeightOffset: 0 },
    series: [{ name: '能力', data: [
      1.0 * history.fire + 1.0,
      0.000125 * history.attack + 0.375,
      0.025 * history.technique + 0.5,
      10.0 * history.luck - 2.0,
      5.0 * history.stability - 2.0,
      history.defense / 0.3 - 2.0,
    ] }],
    labels: ['火力', '进攻', '技术', '运势', '稳定', '防守'],
    colors: [navy],
    fill: { opacity: 0.25 },
    stroke: { width: 2 },
    markers: { size: 3 },
    grid: { show: false, padding: { top: 0, right: 0, bottom: 0, left: 0 } },
    yaxis: { show: false },
  }, { width: 570, height: 315 })
  return svg.replace(/<line\b[^>]*\/>/g, '')
}
export async function renderPlacementChart(model: PlayerCardModel): Promise<string> {
  const { history } = model
  return ApexCharts.renderToString({
    chart: { type: 'donut', height: 315, toolbar: { show: false }, animations: { enabled: false } },
    series: [history.position1, history.position2, history.position3, history.position4],
    labels: ['一位', '二位', '三位', '四位'],
    colors: [navy, lime, amber, red],
    legend: { position: 'right' },
    dataLabels: { enabled: false },
    plotOptions: { pie: { donut: { size: '58%' } } },
  }, { width: 570, height: 315 })
}

export function renderPlacementLegend(model: PlayerCardModel): string {
  const counts = [model.history.position1, model.history.position2, model.history.position3, model.history.position4]
  const total = counts.reduce((sum, count) => sum + count, 0)
  const labels = ['一位', '二位', '三位', '四位']
  const colors = [navy, lime, amber, red]
  return counts.map((count, index) => {
    const percentage = total === 0 ? '0.00' : ((count / total) * 100).toFixed(2)
    const y = 824 + index * 48
    return `<circle cx="1120" cy="${y - 6}" r="10" fill="${colors[index]}"/><text x="1140" y="${y}" class="ring-legend">${labels[index]} · ${percentage}%</text>`
  }).join('')
}


export function renderPromotion(model: PlayerCardModel): string {
  const grade = getGrade(model.history.grade)
  if (!grade || grade.promotionGameTarget === 0) return '<text x="640" y="632" class="promotion" text-anchor="middle" style="fill:#ffffff">已达到最高段位</text>'
  const paths = getPromotionPaths(model)
  if (!paths) return `<text x="640" y="632" class="promotion" text-anchor="middle" style="fill:#ffffff">最近 ${model.recentPlacements.slice(-grade.promotionGameTarget).length}/${grade.promotionGameTarget} 局：无法推导升段条件</text>`
  return `<g class="promotion"><text x="640" y="622" text-anchor="middle" style="fill:#ffffff">当前最快的升段条件是：${paths.fastest.games} 半庄顺位之和 ≤ ${paths.fastest.requiredSum}</text><text x="640" y="650" text-anchor="middle" style="fill:#ffffff">当前最宽松升段条件是：${paths.loosest.games} 半庄顺位之和 ≤ ${paths.loosest.requiredSum}</text></g>`
}
