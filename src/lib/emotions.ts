import type { GestureReading, Point3D } from '../types'

interface BlendshapeCategory {
  categoryName: string
  score: number
}

const MIN_VISIBLE_SCORE = 0.35

export function blendshapeVector(categories: BlendshapeCategory[]): number[] {
  return [...categories]
    .filter((category) => category.categoryName !== '_neutral')
    .sort((a, b) => a.categoryName.localeCompare(b.categoryName))
    .map((category) => category.score)
}

export function emotionReadings(categories: BlendshapeCategory[], landmarks: Point3D[]): GestureReading[] {
  const scores = new Map(categories.map((category) => [category.categoryName, category.score]))
  const score = (name: string) => scores.get(name) ?? 0
  const average = (...values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length
  const candidates = [
    { name: 'smile', score: average(score('mouthSmileLeft'), score('mouthSmileRight')) },
    { name: 'mouth-open', score: score('jawOpen') },
    { name: 'eyes-closed', score: Math.min(score('eyeBlinkLeft'), score('eyeBlinkRight')) },
    { name: 'wink-left', score: Math.max(0, score('eyeBlinkLeft') - score('eyeBlinkRight') * 0.45) },
    { name: 'wink-right', score: Math.max(0, score('eyeBlinkRight') - score('eyeBlinkLeft') * 0.45) },
    { name: 'brows-up', score: Math.max(score('browInnerUp'), average(score('browOuterUpLeft'), score('browOuterUpRight'))) },
    { name: 'cheek-puff', score: score('cheekPuff') },
  ]
  return candidates
    .filter((candidate) => candidate.score >= MIN_VISIBLE_SCORE)
    .map((candidate) => ({ name: `emotion:${candidate.name}`, score: candidate.score, landmarks, handedness: 'Unknown' }))
}
