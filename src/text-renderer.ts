import type { FormulaHistory, OpponentStat } from './types.js'

function pad(value: string | number, width: number): string {
  return String(value).padStart(width, ' ')
}

function percentage(value: number): string {
  return `${value.toFixed(2)}%`
}

export function renderPlayerStats(history: FormulaHistory): string {
  const promotionGames = history.upAvgPosition > 0
    ? Math.round(history.sumPosition / history.upAvgPosition)
    : 0
  const positions = [history.position1, history.position2, history.position3, history.position4]
  const totalGames = positions.reduce((sum, count) => sum + count, 0)
  const winRate = totalGames > 0 ? history.position1 / totalGames * 100 : 0
  return [
    `${history.name} 玩家统计`,
    `段位 ${history.grade}  RATE ${history.rate}`,
    `总分 ${history.totalScore.toFixed(2)}  平均点数 ${history.avgPoint.toFixed(2)}`,
    `对局 ${totalGames}  一位 ${positions[0]}  二位 ${positions[1]}  三位 ${positions[2]}  四位 ${positions[3]}`,
    `一位率 ${percentage(winRate)}  平均顺位 ${history.upAvgPosition.toFixed(2)}`,
    `升段场次 ${promotionGames}  最大点数 ${history.maxPoint}`,
  ].join('\n')
}

export function renderOpponentRanking(name: string, opponents: OpponentStat[], kind: '好人榜' | '仇人榜'): string {
  const rows = opponents.map((opponent, index) => [
    pad(opponent.hateValue, 3),
    pad(opponent.meetCount, 4),
    pad(percentage(opponent.myWinRate), 7),
    opponent.opponentName,
  ].join('  '))
  const valueLabel = kind === '好人榜' ? '好人值' : '仇人值'
  return [`${name} ${kind}`, `${valueLabel} 相遇 胜率 对手`, ...rows].join('\n')
}

