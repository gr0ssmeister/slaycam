import { FileVideo, ImageIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { MediaAsset } from '../types'

export function MediaPreview({ asset, className = '', alt, animated = true }: {
  asset?: MediaAsset
  className?: string
  alt?: string
  animated?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => setFailed(false), [asset?.id])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !animated) return
    video.currentTime = 0
    void video.play().catch(() => undefined)
  }, [animated, asset?.id])

  if (!asset || failed) {
    return asset?.type === 'video'
      ? <FileVideo className={className} aria-hidden="true" />
      : <ImageIcon className={className} aria-hidden="true" />
  }

  if (asset.type === 'video') {
    return (
      <video
        ref={videoRef}
        className={className}
        src={asset.src}
        aria-label={alt ?? `Предпросмотр ${asset.name}`}
        muted
        loop
        autoPlay={animated}
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        onCanPlay={(event) => {
          if (animated) void event.currentTarget.play().catch(() => undefined)
        }}
        onError={() => setFailed(true)}
      />
    )
  }

  return <img className={className} src={asset.src} alt={alt ?? `Предпросмотр ${asset.name}`} onError={() => setFailed(true)} />
}
