import { useLayoutEffect, useMemo, useRef } from 'react'
import type { ActiveEffect, MediaAsset } from '../types'
import { anchorPoint, animationTransform } from '../lib/compositor'
import { MediaPreview } from './MediaPreview'

export function LiveEffects({ effects, media, frameWidth, frameHeight, mirrorCamera }: {
  effects: ActiveEffect[]
  media: MediaAsset[]
  frameWidth: number
  frameHeight: number
  mirrorCamera: boolean
}) {
  const mediaMap = useMemo(() => new Map(media.map((asset) => [asset.id, asset])), [media])

  return (
    <div className="live-effects" aria-hidden="true">
      {[...effects]
        .sort((a, b) => a.rule.layer - b.rule.layer)
        .map((effect) => {
          const asset = mediaMap.get(effect.mediaId)
          return asset ? (
            <LiveEffect
              key={effect.id}
              effect={effect}
              asset={asset}
              frameWidth={frameWidth}
              frameHeight={frameHeight}
              mirrorCamera={mirrorCamera}
            />
          ) : null
        })}
    </div>
  )
}

function LiveEffect({ effect, asset, frameWidth, frameHeight, mirrorCamera }: {
  effect: ActiveEffect
  asset: MediaAsset
  frameWidth: number
  frameHeight: number
  mirrorCamera: boolean
}) {
  const layerRef = useRef<HTMLDivElement>(null)
  const point = anchorPoint(effect, frameWidth, frameHeight, mirrorCamera)

  useLayoutEffect(() => {
    let frame = 0
    const render = (now: number) => {
      const layer = layerRef.current
      if (!layer) return
      const transform = animationTransform(effect, now)
      const x = (point.x + effect.rule.offsetX) / frameWidth * 100
      const y = (point.y + effect.rule.offsetY + transform.y) / frameHeight * 100
      const mirror = effect.rule.mirror ? -1 : 1

      layer.style.left = `${x}%`
      layer.style.top = `${y}%`
      layer.style.opacity = String(effect.rule.opacity * transform.opacity)
      layer.style.transform = `translate(-50%, -50%) rotate(${effect.rule.rotation + transform.rotation}deg) scale(${mirror * transform.scale}, ${transform.scale})`

      if (now < effect.endsAt) frame = requestAnimationFrame(render)
    }

    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [effect, frameHeight, frameWidth, point.x, point.y])

  return (
    <div
      ref={layerRef}
      className="live-effect"
      style={{
        width: `${effect.rule.scale * 100}%`,
        zIndex: effect.rule.layer,
      }}
    >
      <MediaPreview asset={asset} className="live-effect-media" alt="" />
    </div>
  )
}
