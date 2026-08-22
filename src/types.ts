export interface FormulaHistory {
  customerId: string
  name: string
  grade: number
  avgPoint: number
  rate: number
  totalScore: number
  totalPosition: number
  recentlyPosition: string
  recentlyPoint: string
  upPosition: number
  upAvgPosition: number
  sumPosition: number
  position1: number
  position2: number
  position3: number
  position4: number
  fire: number
  attack: number
  technique: number
  luck: number
  stability: number
  defense: number
  maxPoint: number
  nationaSort: number
  mahjongSort: number
  knockBackNum: number
  version: number
  versionDate: string
}

export interface PlayerRecord {
  id: string
  recordId: string
  mahjongId: string
  mahjongName: string
  name1: string
  point1: number
  name2: string
  point2: number
  name3: string
  point3: number
  name4: string
  point4: number
  logtime: string
}

export interface PlayerRecordsResult {
  total?: number
  current?: number
  size?: number
  records?: PlayerRecord[]
}

export interface OpponentStat {
  opponentName: string
  hateValue: number
  meetCount: number
  myWinRate: number
  opponentPosition1: number
  opponentPosition2: number
  opponentPosition3: number
  opponentPosition4: number
  opponentAvgPosition: number
  myPosition1: number
  myPosition2: number
  myPosition3: number
  myPosition4: number
  myAvgPosition: number
}

export interface OpponentStatsResult {
  total?: number
  size?: number
  current?: number
  pages?: number
  records?: OpponentStat[]
}

export interface PlayerHistoryResult {
  history?: FormulaHistory | null
  qq?: string
}

export interface PlayerCardModel {
  history: FormulaHistory
  qq?: string
  avatarDataUri?: string
  latestClubName?: string
  recentPlacements: number[]
  recentPoints: number[]
}
