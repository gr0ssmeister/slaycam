import { describe, expect, it } from 'vitest'
import { DEFAULT_PROFILE_ID, createRule, mergeConfig } from './config'
import type { SlayCamConfig } from './types'

describe('config migration', () => {
  it('moves old rules into the default profile and fills sound defaults', () => {
    const oldRule = createRule('meme')
    const legacy = {
      version: 1,
      media: [],
      gestures: [],
      rules: [{
        ...oldRule,
        profileId: undefined,
        soundEnabled: undefined,
        soundSource: undefined,
        soundMediaId: undefined,
        soundVolume: undefined,
        soundOutputDeviceId: undefined,
      }],
      installedPacks: [],
      settings: {},
    } as unknown as Partial<SlayCamConfig>

    const migrated = mergeConfig(legacy)

    expect(migrated.version).toBe(3)
    expect(migrated.activeProfileId).toBe(DEFAULT_PROFILE_ID)
    expect(migrated.profiles).toHaveLength(1)
    expect(migrated.rules[0]).toMatchObject({
      profileId: DEFAULT_PROFILE_ID,
      soundEnabled: false,
      soundSource: 'none',
      soundMediaId: '',
      soundVolume: 0.8,
      soundOutputDeviceId: '',
    })
  })

  it('migrates an enabled legacy sound to a separate file source', () => {
    const legacyRule = { ...createRule('meme'), soundEnabled: true, soundSource: undefined, soundMediaId: 'sound' }
    const migrated = mergeConfig({ rules: [legacyRule] } as unknown as Partial<SlayCamConfig>)

    expect(migrated.rules[0]).toMatchObject({ soundSource: 'file', soundEnabled: true, soundMediaId: 'sound' })
    expect(migrated.settings.startCameraOnLaunch).toBe(false)
  })

  it('keeps profile background settings while filling new defaults', () => {
    const config = mergeConfig({
      profiles: [{
        id: 'stream',
        name: 'Стрим',
        emoji: '🎬',
        createdAt: '2026-09-16T00:00:00.000Z',
        background: { mode: 'blur', blur: 24, mediaId: '', color: '#111111' },
      }],
      activeProfileId: 'stream',
    })

    expect(config.activeProfileId).toBe('stream')
    expect(config.profiles[0].background).toEqual({ mode: 'blur', blur: 24, mediaId: '', color: '#111111' })
  })
})
