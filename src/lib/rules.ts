import type { EffectRule, TriggerType } from '../types'

export interface RuleIdentity {
  mediaId: string
  triggerType: TriggerType
  gesture: string
  customGestureId?: string
}

export function findDuplicateRule(rules: EffectRule[], draft: RuleIdentity): EffectRule | undefined {
  return rules.find((rule) => {
    if (rule.mediaId !== draft.mediaId || rule.triggerType !== draft.triggerType) return false
    return draft.triggerType === 'built-in'
      ? rule.gesture === draft.gesture
      : rule.customGestureId === draft.customGestureId
  })
}
