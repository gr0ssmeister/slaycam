import type { ActiveEffect, MediaAsset, Point3D, SlayCamConfig } from '../types'

type Drawable = HTMLImageElement | HTMLVideoElement

export class MediaBank {
  private items = new Map<string, Drawable>()

  get(asset: MediaAsset): Drawable {
    const cached = this.items.get(asset.id)
    if (cached) return cached
    if (asset.type === 'video') {
      const video = document.createElement('video')
      video.src = asset.src
      video.muted = true
      video.loop = true
      video.playsInline = true
      void video.play().catch(() => undefined)
      this.items.set(asset.id, video)
      return video
    }
    const image = new Image()
    image.src = asset.src
    image.decoding = 'async'
    this.items.set(asset.id, image)
    return image
  }

  removeMissing(media: MediaAsset[]) {
    const ids = new Set(media.map((asset) => asset.id))
    for (const [id, item] of this.items) {
      if (!ids.has(id)) {
        if (item instanceof HTMLVideoElement) item.pause()
        this.items.delete(id)
      }
    }
  }
}

export function anchorPoint(effect: ActiveEffect, width: number, height: number, mirrored: boolean) {
  const rule = effect.rule
  const pose = effect.poseLandmarks?.length === 33
    ? effect.poseLandmarks
    : effect.landmarks.length === 33 ? effect.landmarks : []
  const handLandmarks = effect.landmarks.length === 21 ? effect.landmarks : []
  const toCanvas = (point: Point3D | undefined, fallbackX: number, fallbackY: number) => point
    ? { x: (mirrored ? 1 - point.x : point.x) * width, y: point.y * height }
    : { x: fallbackX * width, y: fallbackY * height }
  const activeHand = toCanvas(handLandmarks[9] ?? handLandmarks[0], 0.5, 0.56)
  const face = toCanvas(pose[0], 0.5, 0.3)
  switch (rule.anchor) {
    case 'gesture-hand':
      return activeHand
    case 'left-hand':
      return toCanvas(pose[15], effect.handedness === 'Left' ? activeHand.x / width : 0.35, effect.handedness === 'Left' ? activeHand.y / height : 0.58)
    case 'right-hand':
      return toCanvas(pose[16], effect.handedness === 'Right' ? activeHand.x / width : 0.65, effect.handedness === 'Right' ? activeHand.y / height : 0.58)
    case 'above-head':
      return { x: face.x, y: Math.max(height * 0.06, face.y - height * 0.18) }
    case 'face':
      return face
    case 'screen-top':
      return { x: width / 2, y: height * 0.16 }
    case 'screen-bottom':
      return { x: width / 2, y: height * 0.84 }
    case 'screen-top-left':
      return { x: width * 0.16, y: height * 0.16 }
    case 'screen-top-right':
      return { x: width * 0.84, y: height * 0.16 }
    case 'screen-bottom-left':
      return { x: width * 0.16, y: height * 0.84 }
    case 'screen-bottom-right':
      return { x: width * 0.84, y: height * 0.84 }
    default:
      return { x: width / 2, y: height / 2 }
  }
}

function animationTransform(effect: ActiveEffect, now: number) {
  const elapsed = now - effect.startedAt
  const total = Math.max(1, effect.endsAt - effect.startedAt)
  const progress = Math.min(1, elapsed / total)
  const enter = Math.min(1, elapsed / 220)
  const exit = Math.min(1, (effect.endsAt - now) / 180)
  const visibility = Math.max(0, Math.min(enter, exit))
  switch (effect.rule.animation) {
    case 'pop':
      return { scale: 0.72 + 0.28 * (1 - Math.pow(1 - enter, 4)), rotation: 0, y: 0, opacity: visibility }
    case 'fade':
      return { scale: 1, rotation: 0, y: 0, opacity: visibility }
    case 'slide-up':
      return { scale: 1, rotation: 0, y: (1 - enter) * 42, opacity: visibility }
    case 'spin':
      return { scale: 0.8 + 0.2 * enter, rotation: (1 - enter) * -18, y: 0, opacity: visibility }
    default:
      return { scale: 1, rotation: 0, y: 0, opacity: progress < 1 ? 1 : 0 }
  }
}

export function drawScene(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  config: SlayCamConfig,
  effects: ActiveEffect[],
  mediaBank: MediaBank,
  now: number,
) {
  const { width, height } = context.canvas
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#120b10'
  context.fillRect(0, 0, width, height)
  if (video.readyState >= 2) {
    context.save()
    if (config.settings.mirrorCamera) {
      context.translate(width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0, width, height)
    context.restore()
  }

  const mediaMap = new Map(config.media.map((asset) => [asset.id, asset]))
  for (const effect of [...effects].sort((a, b) => a.rule.layer - b.rule.layer)) {
    const asset = mediaMap.get(effect.mediaId)
    if (!asset) continue
    const drawable = mediaBank.get(asset)
    const ready = drawable instanceof HTMLImageElement ? drawable.complete : drawable.readyState >= 2
    if (!ready) continue
    const naturalWidth = drawable instanceof HTMLImageElement ? drawable.naturalWidth : drawable.videoWidth
    const naturalHeight = drawable instanceof HTMLImageElement ? drawable.naturalHeight : drawable.videoHeight
    if (!naturalWidth || !naturalHeight) continue

    const point = anchorPoint(effect, width, height, config.settings.mirrorCamera)
    const transform = animationTransform(effect, now)
    const targetWidth = width * effect.rule.scale * transform.scale
    const targetHeight = targetWidth * naturalHeight / naturalWidth
    context.save()
    context.globalAlpha = effect.rule.opacity * transform.opacity
    context.translate(point.x + effect.rule.offsetX, point.y + effect.rule.offsetY + transform.y)
    context.rotate((effect.rule.rotation + transform.rotation) * Math.PI / 180)
    context.scale(effect.rule.mirror ? -1 : 1, 1)
    context.drawImage(drawable, -targetWidth / 2, -targetHeight / 2, targetWidth, targetHeight)
    context.restore()
  }
}

export function drawLandmarks(
  context: CanvasRenderingContext2D,
  landmarkSets: Point3D[][],
  mirrored: boolean,
) {
  const { width, height } = context.canvas
  context.save()
  context.fillStyle = 'oklch(0.78 0.18 350)'
  for (const landmarks of landmarkSets) {
    for (const point of landmarks) {
      context.beginPath()
      context.arc((mirrored ? 1 - point.x : point.x) * width, point.y * height, 4, 0, Math.PI * 2)
      context.fill()
    }
  }
  context.restore()
}
