import type { MediaAsset, SlayCamConfig } from './types'

export const DEFAULT_MEME_PACK_ID = 'slaycam-starter-v1'

const DEFAULT_MEME_FILES = [
  'anime.gif',
  'aura.gif',
  'cat.gif',
  'ghul.gif',
  'happy.gif',
  'hide.gif',
  'like.gif',
  'nyancat.gif',
  'omg.gif',
  'rickroll.gif',
  'snoop.gif',
  'think.gif',
  'thinking.gif',
  'zootopia.gif',
] as const

function bundledSource(filename: string) {
  if (typeof window !== 'undefined' && ['http:', 'https:'].includes(window.location.protocol)) {
    return `/default-memes/${encodeURIComponent(filename)}`
  }
  return `slaycam-builtin://media/${encodeURIComponent(filename)}`
}

export const DEFAULT_MEMES: MediaAsset[] = DEFAULT_MEME_FILES.map((filename) => ({
  id: `starter-${filename.replace(/\.[^.]+$/, '')}`,
  name: filename,
  type: 'image',
  extension: '.gif',
  src: bundledSource(filename),
  storedName: filename,
  pack: 'Стартовый пак',
  createdAt: '2026-09-12T00:00:00.000Z',
}))

export function installDefaultMemePack(config: SlayCamConfig): SlayCamConfig {
  if (config.installedPacks.includes(DEFAULT_MEME_PACK_ID)) return config
  const existingIds = new Set(config.media.map((asset) => asset.id))
  return {
    ...config,
    media: [...DEFAULT_MEMES.filter((asset) => !existingIds.has(asset.id)), ...config.media],
    installedPacks: [...config.installedPacks, DEFAULT_MEME_PACK_ID],
  }
}
