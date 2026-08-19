export type Grade = {
  number: number
  name: string
  promotionGameTarget: number
  promotionAverageMax: number
  promotionSumMax: number
}

const grades: readonly Grade[] = [
  { number: 0, name: '新人', promotionGameTarget: 7, promotionAverageMax: 2.9, promotionSumMax: 20 },
  { number: 1, name: '5级', promotionGameTarget: 7, promotionAverageMax: 2.8, promotionSumMax: 19 },
  { number: 2, name: '4级', promotionGameTarget: 10, promotionAverageMax: 2.7, promotionSumMax: 27 },
  { number: 3, name: '3级', promotionGameTarget: 10, promotionAverageMax: 2.7, promotionSumMax: 27 },
  { number: 4, name: '2级', promotionGameTarget: 12, promotionAverageMax: 2.6, promotionSumMax: 31 },
  { number: 5, name: '1级', promotionGameTarget: 16, promotionAverageMax: 2.6, promotionSumMax: 41 },
  { number: 6, name: '初段', promotionGameTarget: 16, promotionAverageMax: 2.5, promotionSumMax: 40 },
  { number: 7, name: '二段', promotionGameTarget: 20, promotionAverageMax: 2.5, promotionSumMax: 50 },
  { number: 8, name: '三段', promotionGameTarget: 25, promotionAverageMax: 2.4, promotionSumMax: 60 },
  { number: 9, name: '四段', promotionGameTarget: 25, promotionAverageMax: 2.4, promotionSumMax: 60 },
  { number: 10, name: '五段', promotionGameTarget: 30, promotionAverageMax: 2.3, promotionSumMax: 69 },
  { number: 11, name: '六段', promotionGameTarget: 40, promotionAverageMax: 2.1, promotionSumMax: 84 },
  { number: 12, name: '七段', promotionGameTarget: 45, promotionAverageMax: 2, promotionSumMax: 90 },
  { number: 13, name: '八段', promotionGameTarget: 50, promotionAverageMax: 1.9, promotionSumMax: 95 },
  { number: 14, name: '九段', promotionGameTarget: 0, promotionAverageMax: 0, promotionSumMax: 0 },
  { number: 15, name: '十段', promotionGameTarget: 0, promotionAverageMax: 0, promotionSumMax: 0 },
]

export function getGrade(number: number): Grade | undefined {
  return grades[number]
}
