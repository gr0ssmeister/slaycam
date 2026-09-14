import { describe, expect, it } from 'vitest'
import { createRule } from '../config'
import type { ActiveEffect, Point3D } from '../types'
import { anchorPoint, animationTransform } from './compositor'

function effect(anchor: ActiveEffect['rule']['anchor'], poseLandmarks: Point3D[] = []): ActiveEffect {
  return {
    id: 'effect',
    ruleId: 'rule',
    mediaId: 'media',
    startedAt: 0,
    endsAt: 2000,
    rule: { ...createRule('media'), anchor },
    landmarks: [],
    poseLandmarks,
    handedness: 'Unknown',
  }
}

describe('effect anchors', () => {
  it('places fixed anchors at every edge and corner', () => {
    expect(anchorPoint(effect('screen-top-left'), 1000, 500, false)).toEqual({ x: 160, y: 80 })
    expect(anchorPoint(effect('screen-bottom-right'), 1000, 500, false)).toEqual({ x: 840, y: 420 })
    expect(anchorPoint(effect('screen-bottom'), 1000, 500, false)).toEqual({ x: 500, y: 420 })
  })

  it('tracks face and wrists from body landmarks', () => {
    const pose = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0 }))
    pose[0] = { x: 0.45, y: 0.24, z: 0 }
    pose[15] = { x: 0.24, y: 0.7, z: 0 }
    pose[16] = { x: 0.76, y: 0.7, z: 0 }
    expect(anchorPoint(effect('face', pose), 1000, 500, false)).toEqual({ x: 450, y: 120 })
    expect(anchorPoint(effect('left-hand', pose), 1000, 500, false)).toEqual({ x: 240, y: 350 })
    expect(anchorPoint(effect('right-hand', pose), 1000, 500, true)).toEqual({ x: 240, y: 350 })
  })

  it('starts and finishes live media with the selected entrance animation', () => {
    const active = effect('screen-center')
    active.startedAt = 1000
    active.endsAt = 3000
    active.rule.animation = 'pop'

    expect(animationTransform(active, 1000)).toMatchObject({ scale: 0.72, opacity: 0 })
    expect(animationTransform(active, 1220)).toMatchObject({ scale: 1, opacity: 1 })
    expect(animationTransform(active, 3000).opacity).toBe(0)
  })
})
