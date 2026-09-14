import { describe, expect, it } from 'vitest'
import type { EffectRule } from '../types'
import { findDuplicateRule } from './rules'

const rule: EffectRule = {
  id: 'rule-1', name: 'Slay', enabled: true, triggerType: 'built-in', gesture: 'Victory', mediaId: 'meme-1',
  confidence: 0.72, holdMs: 180, cooldownMs: 1800, durationMs: 2200, mode: 'once', anchor: 'screen-center',
  offsetX: 0, offsetY: 0, scale: 0.3, rotation: 0, opacity: 1, mirror: false, layer: 10, animation: 'pop',
}

describe('effect draft duplicate protection', () => {
  it('finds the same built-in trigger and media pair', () => {
    expect(findDuplicateRule([rule], { mediaId: 'meme-1', triggerType: 'built-in', gesture: 'Victory' })?.id).toBe('rule-1')
  })

  it('allows the same gesture with another meme', () => {
    expect(findDuplicateRule([rule], { mediaId: 'meme-2', triggerType: 'built-in', gesture: 'Victory' })).toBeUndefined()
  })

  it('compares custom triggers by their recording id', () => {
    const custom = { ...rule, id: 'rule-2', triggerType: 'custom' as const, customGestureId: 'motion-1' }
    expect(findDuplicateRule([custom], { mediaId: 'meme-1', triggerType: 'custom', gesture: '', customGestureId: 'motion-1' })?.id).toBe('rule-2')
  })
})
