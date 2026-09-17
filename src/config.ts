import type { AppProfile, BackgroundSettings, EffectRule, SlayCamConfig } from './types'

export const DEFAULT_PROFILE_ID = 'slaycam-default-profile'

export const DEFAULT_BACKGROUND: BackgroundSettings = {
  mode: 'none',
  mediaId: '',
  blur: 18,
  color: '#e45791',
}

export const DEFAULT_PROFILE: AppProfile = {
  id: DEFAULT_PROFILE_ID,
  name: 'Discord',
  emoji: '🎮',
  background: DEFAULT_BACKGROUND,
  createdAt: '2026-09-16T00:00:00.000Z',
}

export const DEFAULT_SETTINGS: SlayCamConfig['settings'] = {
  cameraId: '',
  width: 1280,
  height: 720,
  fps: 30,
  mirrorCamera: true,
  showLandmarks: false,
  showFps: true,
  inferenceFps: 24,
  startCameraOnLaunch: false,
  onboardingComplete: false,
}

export const DEFAULT_CONFIG: SlayCamConfig = {
  version: 3,
  media: [],
  gestures: [],
  rules: [],
  profiles: [DEFAULT_PROFILE],
  activeProfileId: DEFAULT_PROFILE_ID,
  installedPacks: [],
  settings: DEFAULT_SETTINGS,
}

export function createRule(mediaId = '', profileId = DEFAULT_PROFILE_ID): EffectRule {
  return {
    id: crypto.randomUUID(),
    profileId,
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
    soundSource: 'none',
    soundEnabled: false,
    soundMediaId: '',
    soundVolume: 0.8,
    soundOutputDeviceId: '',
  }
}

export function mergeConfig(value: Partial<SlayCamConfig> | null): SlayCamConfig {
  if (!value) return structuredClone(DEFAULT_CONFIG)
  const profiles = Array.isArray(value.profiles) && value.profiles.length
    ? value.profiles.map((profile) => ({
        ...profile,
        emoji: profile.emoji || '✨',
        background: { ...DEFAULT_BACKGROUND, ...(profile.background ?? {}) },
      }))
    : [structuredClone(DEFAULT_PROFILE)]
  const profileIds = new Set(profiles.map((profile) => profile.id))
  const activeProfileId = value.activeProfileId && profileIds.has(value.activeProfileId)
    ? value.activeProfileId
    : profiles[0].id
  return {
    ...DEFAULT_CONFIG,
    ...value,
    version: 3,
    media: Array.isArray(value.media) ? value.media : [],
    installedPacks: Array.isArray(value.installedPacks) ? value.installedPacks : [],
    gestures: Array.isArray(value.gestures)
      ? value.gestures.map((gesture) => ({ ...gesture, tracking: gesture.tracking ?? 'hand' }))
      : [],
    rules: Array.isArray(value.rules)
      ? value.rules.map((rule) => {
          const soundSource = rule.soundSource ?? (rule.soundEnabled ? 'file' : 'none')
          return {
            ...rule,
            profileId: profileIds.has(rule.profileId) ? rule.profileId : activeProfileId,
            soundSource,
            soundEnabled: soundSource !== 'none',
            soundMediaId: rule.soundMediaId ?? '',
            soundVolume: rule.soundVolume ?? 0.8,
            soundOutputDeviceId: rule.soundOutputDeviceId ?? '',
          }
        })
      : [],
    profiles,
    activeProfileId,
    settings: { ...DEFAULT_SETTINGS, ...(value.settings ?? {}) },
  }
}
