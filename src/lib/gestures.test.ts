import { describe, expect, it } from 'vitest'
import { gestureDistance, matchCustomGesture, matchCustomPose, matchMotionGesture, motionEnergy, normalizeLandmarks, normalizePoseLandmarks, RuleEngine } from './gestures'

const hand = Array.from({ length: 21 }, (_, index) => ({
  x: 0.4 + index * 0.01,
  y: 0.6 - index * 0.008,
  z: index * 0.001,
}))

describe('gesture normalization', () => {
  it('is invariant to position and scale', () => {
    const moved = hand.map((point) => ({ x: point.x * 2 + 1, y: point.y * 2 - 1, z: point.z * 2 }))
    expect(gestureDistance(normalizeLandmarks(hand), normalizeLandmarks(moved))).toBeLessThan(0.00001)
  })

  it('recognizes a recorded custom gesture after position changes', () => {
    const sample = normalizeLandmarks(hand)
    const moved = hand.map((point) => ({ x: point.x * 1.7 - 0.2, y: point.y * 1.7 + 0.1, z: point.z * 1.7 }))
    const result = matchCustomGesture(moved, [{ id: 'custom-heart', name: 'Сердечко', samples: [sample], threshold: 0.22, tracking: 'hand', createdAt: '' }])
    expect(result?.id).toBe('custom-heart')
    expect(result?.score).toBeGreaterThan(0.9)
  })
})

describe('pose and motion matching', () => {
  const pose = Array.from({ length: 33 }, (_, index) => ({ x: 0.35 + index * 0.008, y: 0.2 + index * 0.014, z: index * 0.002 }))

  it('recognizes a saved body pose after camera position changes', () => {
    const moved = pose.map((point) => ({ x: point.x * 1.4 + 0.1, y: point.y * 1.4 - 0.05, z: point.z * 1.4 }))
    const result = matchCustomPose(moved, [{ id: 'pose', name: 'Наклон', samples: [normalizePoseLandmarks(pose)], threshold: 0.22, tracking: 'pose', createdAt: '' }])
    expect(result?.id).toBe('pose')
  })

  it('matches a recorded sequence and rejects a still pose', () => {
    const sequence = Array.from({ length: 18 }, (_, frame) => normalizePoseLandmarks(pose.map((point, index) => ({ ...point, x: point.x + Math.sin(frame / 4) * (index > 10 && index < 17 ? 0.08 : 0) }))))
    const gesture = { id: 'wave', name: 'Взмах', samples: sequence, threshold: 0.12, tracking: 'motion' as const, motionEnergy: motionEnergy(sequence), createdAt: '' }
    expect(matchMotionGesture(sequence, [gesture])?.id).toBe('wave')
    expect(matchMotionGesture(Array(18).fill(sequence[0]), [gesture])).toBeNull()
  })
})

describe('rule engine', () => {
  it('fires once per visible gesture and rearms after the gesture disappears', () => {
    const engine = new RuleEngine()
    expect(engine.evaluate('a', true, 0.9, 0.7, 200, 1000, 0)).toBe(false)
    expect(engine.evaluate('a', true, 0.9, 0.7, 200, 1000, 220)).toBe(true)
    expect(engine.evaluate('a', true, 0.9, 0.7, 200, 1000, 600)).toBe(false)
    expect(engine.evaluate('a', true, 0.9, 0.7, 200, 1000, 1300)).toBe(false)
    expect(engine.evaluate('a', false, 0, 0.7, 200, 1000, 1400)).toBe(false)
    expect(engine.evaluate('a', false, 0, 0.7, 200, 1000, 1660)).toBe(false)
    expect(engine.evaluate('a', true, 0.9, 0.7, 200, 1000, 1700)).toBe(false)
    expect(engine.evaluate('a', true, 0.9, 0.7, 200, 1000, 1920)).toBe(true)
  })

  it('does not rearm from a one-frame recognition flicker', () => {
    const engine = new RuleEngine()
    expect(engine.evaluate('flicker', true, 0.9, 0.7, 0, 0, 0)).toBe(true)
    expect(engine.evaluate('flicker', false, 0, 0.7, 0, 0, 100)).toBe(false)
    expect(engine.evaluate('flicker', true, 0.9, 0.7, 0, 0, 150)).toBe(false)
  })

  it('can refresh an effect while a gesture is held when that mode is explicit', () => {
    const engine = new RuleEngine()
    expect(engine.evaluate('loop', true, 0.9, 0.7, 0, 500, 0, true)).toBe(true)
    expect(engine.evaluate('loop', true, 0.9, 0.7, 0, 500, 300, true)).toBe(false)
    expect(engine.evaluate('loop', true, 0.9, 0.7, 0, 500, 520, true)).toBe(true)
  })
})
