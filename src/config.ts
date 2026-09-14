import type { EffectRule, SlayCamConfig } from './types'

export const DEFAULT_SETTINGS: SlayCamConfig['settings'] = {
  cameraId: '',
  width: 1280,
  height: 720,
  fps: 30,
  mirrorCamera: true,
  showLandmarks: false,
  showFps: true,
  inferenceFps: 24,
  onboardingComplete: false,
}

export const DEFAULT_CONFIG: SlayCamConfig = {
  version: 1,
  media: [],
  gestures: [],
  rules: [],
  installedPacks: [],
  settings: DEFAULT_SETTINGS,
}

export function createRule(mediaId = ''): EffectRule {
  return {
    id: crypto.randomUUID(),
    name: 'Новый эффект',
    enabled: true,
    triggerType: 'built-in',
    gesture: 'Thumb_Up',
    mediaId,
    confidence: 0.72,
    holdMs: 180,
    cooldownMs: 1800,
    durationMs: 2200,
    mode: 'once',
    anchor: 'gesture-hand',
    offsetX: 0,
    offsetY: -12,
    scale: 0.32,
    rotation: 0,
    opacity: 1,
    mirror: false,
    layer: 10,
    animation: 'pop',
  }
}

export function mergeConfig(value: Partial<SlayCamConfig> | null): SlayCamConfig {
  if (!value) return structuredClone(DEFAULT_CONFIG)
  return {
    ...DEFAULT_CONFIG,
    ...value,
    media: Array.isArray(value.media) ? value.media : [],
    installedPacks: Array.isArray(value.installedPacks) ? value.installedPacks : [],
    gestures: Array.isArray(value.gestures)
      ? value.gestures.map((gesture) => ({ ...gesture, tracking: gesture.tracking ?? 'hand' }))
      : [],
    rules: Array.isArray(value.rules) ? value.rules : [],
    settings: { ...DEFAULT_SETTINGS, ...(value.settings ?? {}) },
  }
}
