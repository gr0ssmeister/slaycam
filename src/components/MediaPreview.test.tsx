import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { MediaAsset } from '../types'
import { MediaPreview } from './MediaPreview'

function asset(type: MediaAsset['type'], extension: string): MediaAsset {
  return {
    id: `${type}-${extension}`,
    name: `effect${extension}`,
    type,
    extension,
    src: `slaycam-asset://media/effect${extension}`,
    storedName: `effect${extension}`,
    createdAt: '2026-09-14T00:00:00.000Z',
  }
}

describe('native animated media preview', () => {
  it('keeps GIF files in an animated image element', () => {
    const html = renderToStaticMarkup(<MediaPreview asset={asset('image', '.gif')} />)
    expect(html).toContain('<img')
    expect(html).toContain('slaycam-asset://media/effect.gif')
  })

  it('renders video ready for muted looping autoplay', () => {
    const html = renderToStaticMarkup(<MediaPreview asset={asset('video', '.webm')} />)
    expect(html).toContain('<video')
    expect(html).toContain('autoplay=""')
    expect(html).toContain('loop=""')
    expect(html).toContain('muted=""')
    expect(html).toContain('preload="auto"')
  })
})
