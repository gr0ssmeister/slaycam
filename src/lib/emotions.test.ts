import { describe, expect, it } from 'vitest'
import { blendshapeVector, emotionReadings } from './emotions'

const points = [{ x: 0.5, y: 0.5, z: 0 }]

describe('emotion readings', () => {
  it('keeps a stable blendshape order for recorded emotions', () => {
    expect(blendshapeVector([
      { categoryName: 'mouthSmileRight', score: 0.8 },
      { categoryName: '_neutral', score: 0.2 },
      { categoryName: 'eyeBlinkLeft', score: 0.6 },
    ])).toEqual([0.6, 0.8])
  })
  it('turns face blendshapes into named emotion triggers', () => {
    const readings = emotionReadings([
      { categoryName: 'mouthSmileLeft', score: 0.9 },
      { categoryName: 'mouthSmileRight', score: 0.8 },
      { categoryName: 'jawOpen', score: 0.1 },
    ], points)
    expect(readings.find((reading) => reading.name === 'emotion:smile')?.score).toBeCloseTo(0.85)
    expect(readings.some((reading) => reading.name === 'emotion:mouth-open')).toBe(false)
  })

  it('distinguishes a wink from both eyes closed', () => {
    const readings = emotionReadings([
      { categoryName: 'eyeBlinkLeft', score: 0.92 },
      { categoryName: 'eyeBlinkRight', score: 0.08 },
    ], points)
    expect(readings.some((reading) => reading.name === 'emotion:wink-left')).toBe(true)
    expect(readings.some((reading) => reading.name === 'emotion:eyes-closed')).toBe(false)
  })
})
