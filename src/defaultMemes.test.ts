import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { DEFAULT_CONFIG } from './config'
import { DEFAULT_MEME_PACK_ID, DEFAULT_MEMES, installDefaultMemePack } from './defaultMemes'

describe('starter meme pack', () => {
  it('contains every bundled file', () => {
    expect(DEFAULT_MEMES).toHaveLength(14)
    for (const asset of DEFAULT_MEMES) {
      expect(existsSync(join(process.cwd(), 'public', 'default-memes', asset.storedName))).toBe(true)
    }
  })

  it('installs once and stays removable', () => {
    const installed = installDefaultMemePack(structuredClone(DEFAULT_CONFIG))
    expect(installed.media).toHaveLength(14)
    expect(installed.installedPacks).toContain(DEFAULT_MEME_PACK_ID)

    const afterDeletion = installDefaultMemePack({ ...installed, media: installed.media.slice(1) })
    expect(afterDeletion.media).toHaveLength(13)
  })
})
