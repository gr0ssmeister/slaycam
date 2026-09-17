import type { ActiveEffect, BackgroundSettings, MediaAsset, Point3D, SegmentationFrame, SlayCamConfig } from '../types'

type Drawable = HTMLImageElement | HTMLVideoElement
type DrawSource = Drawable | HTMLCanvasElement | ImageBitmap
type Animation = { frames: ImageBitmap[], durations: number[], total: number }

// A meme imported at 4000 px wide would be resampled from scratch on every single frame,
// so anything wider than a camera frame is shrunk once and drawn from that copy instead.
const MAX_SOURCE_WIDTH = 1280
// Drawing an <img> on a canvas always yields the first frame of a GIF, so animated files
// are decoded frame by frame instead. Frames are kept as bitmaps under a memory budget.
const MAX_ANIMATION_WIDTH = 640
const ANIMATION_BUDGET_BYTES = 24 * 1024 * 1024
const ANIMATED_EXTENSIONS = new Set(['.gif', '.webp'])

let personCanvas: HTMLCanvasElement | undefined
let maskCanvas: HTMLCanvasElement | undefined
let cachedSegmentation: SegmentationFrame | undefined

export class MediaBank {
  private items = new Map<string, Drawable>()
  private scaled = new Map<string, HTMLCanvasElement>()
  private animations = new Map<string, Animation>()
  private decoding = new Set<string>()

  get(asset: MediaAsset): Drawable {
    const cached = this.items.get(asset.id)
    if (cached) return cached
    if (asset.type === 'video') {
      const video = document.createElement('video')
      video.crossOrigin = 'anonymous'
      video.src = asset.src
      video.muted = true
      video.loop = true
      video.playsInline = true
      void video.play().catch(() => undefined)
      this.items.set(asset.id, video)
      return video
    }
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = asset.src
    image.decoding = 'async'
    this.items.set(asset.id, image)
    return image
  }

  // The drawable ready to be painted this frame: the current frame of an animation when the
  // file moves, otherwise the picture itself, downscaled once when the file is oversized.
  source(asset: MediaAsset, now = 0): DrawSource | undefined {
    const animation = this.animations.get(asset.id)
    if (animation) return frameAt(animation, now)
    this.startDecoding(asset)
    const original = this.get(asset)
    if (!drawableReady(original)) return undefined
    if (!(original instanceof HTMLImageElement) || original.naturalWidth <= MAX_SOURCE_WIDTH) return original
    const cached = this.scaled.get(asset.id)
    if (cached) return cached
    const canvas = document.createElement('canvas')
    canvas.width = MAX_SOURCE_WIDTH
    canvas.height = Math.max(1, Math.round(original.naturalHeight * MAX_SOURCE_WIDTH / original.naturalWidth))
    const context = canvas.getContext('2d')
    if (!context) return original
    context.drawImage(original, 0, 0, canvas.width, canvas.height)
    this.scaled.set(asset.id, canvas)
    return canvas
  }

  private startDecoding(asset: MediaAsset) {
    if (asset.type !== 'image' || this.decoding.has(asset.id)) return
    if (!ANIMATED_EXTENSIONS.has(asset.extension.toLowerCase())) return
    this.decoding.add(asset.id)
    void decodeAnimation(asset).then((animation) => {
      if (animation) this.animations.set(asset.id, animation)
    })
  }

  removeMissing(media: MediaAsset[]) {
    const ids = new Set(media.map((asset) => asset.id))
    for (const [id, item] of this.items) {
      if (!ids.has(id)) {
        if (item instanceof HTMLVideoElement) item.pause()
        this.items.delete(id)
        this.scaled.delete(id)
        this.animations.get(id)?.frames.forEach((frame) => frame.close())
        this.animations.delete(id)
      }
    }
  }
}

function frameAt(animation: Animation, now: number) {
  let position = animation.total > 0 ? now % animation.total : 0
  for (let index = 0; index < animation.frames.length; index += 1) {
    position -= animation.durations[index]
    if (position < 0) return animation.frames[index]
  }
  return animation.frames[animation.frames.length - 1]
}

async function decodeAnimation(asset: MediaAsset): Promise<Animation | undefined> {
  if (typeof ImageDecoder === 'undefined') return undefined
  try {
    const response = await fetch(asset.src)
    const data = await response.arrayBuffer()
    const decoder = new ImageDecoder({ data, type: asset.extension.toLowerCase() === '.webp' ? 'image/webp' : 'image/gif' })
    await decoder.tracks.ready
    const track = decoder.tracks.selectedTrack
    if (!track?.animated || track.frameCount < 2) {
      decoder.close()
      return undefined
    }
    const frames: ImageBitmap[] = []
    const durations: number[] = []
    let budget = ANIMATION_BUDGET_BYTES
    for (let index = 0; index < track.frameCount; index += 1) {
      const { image } = await decoder.decode({ frameIndex: index })
      let exhausted = false
      try {
        const scale = Math.min(1, MAX_ANIMATION_WIDTH / image.displayWidth)
        const width = Math.max(1, Math.round(image.displayWidth * scale))
        const height = Math.max(1, Math.round(image.displayHeight * scale))
        budget -= width * height * 4
        exhausted = budget < 0 && frames.length > 0
        if (!exhausted) {
          frames.push(await createImageBitmap(image, { resizeWidth: width, resizeHeight: height }))
          // A frame without a stated delay follows the browser default for GIFs.
          durations.push(Math.max(20, (image.duration ?? 100000) / 1000))
        }
      } finally {
        // A decoded frame holds native memory until it is closed, even when we drop it.
        image.close()
      }
      if (exhausted) break
    }
    decoder.close()
    if (frames.length < 2) {
      frames.forEach((frame) => frame.close())
      return undefined
    }
    return { frames, durations, total: durations.reduce((sum, value) => sum + value, 0) }
  } catch {
    // A file we cannot decode simply keeps being drawn as a still picture.
    return undefined
  }
}

function sourceSize(source: DrawSource) {
  if (source instanceof HTMLVideoElement) return { width: source.videoWidth, height: source.videoHeight }
  if (source instanceof HTMLImageElement) return { width: source.naturalWidth, height: source.naturalHeight }
  return { width: source.width, height: source.height }
}

export function anchorPoint(effect: ActiveEffect, width: number, height: number, mirrored: boolean) {
  const rule = effect.rule
  const pose = effect.poseLandmarks?.length === 33
    ? effect.poseLandmarks
    : effect.landmarks.length === 33 ? effect.landmarks : []
  const handLandmarks = effect.landmarks.length === 21 ? effect.landmarks : []
  const twoHands = effect.landmarks.length === 42 ? [effect.landmarks.slice(0, 21), effect.landmarks.slice(21, 42)] : []
  const toCanvas = (point: Point3D | undefined, fallbackX: number, fallbackY: number) => point
    ? { x: (mirrored ? 1 - point.x : point.x) * width, y: point.y * height }
    : { x: fallbackX * width, y: fallbackY * height }
  const activeHand = twoHands.length === 2
    ? (() => {
        const first = toCanvas(twoHands[0][9] ?? twoHands[0][0], 0.4, 0.56)
        const second = toCanvas(twoHands[1][9] ?? twoHands[1][0], 0.6, 0.56)
        return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 }
      })()
    : toCanvas(handLandmarks[9] ?? handLandmarks[0], 0.5, 0.56)
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

export function animationTransform(effect: ActiveEffect, now: number) {
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
  background?: BackgroundSettings,
  segmentation?: SegmentationFrame | null,
) {
  const backgroundAsset = config.media.find((asset) => asset.id === background?.mediaId)
  drawCameraFrame(context, video, config, background, backgroundAsset, mediaBank, segmentation, now)

  const { width, height } = context.canvas
  const mediaMap = new Map(config.media.map((asset) => [asset.id, asset]))
  for (const effect of [...effects].sort((a, b) => a.rule.layer - b.rule.layer)) {
    const asset = mediaMap.get(effect.mediaId)
    if (!asset) continue
    const drawable = mediaBank.source(asset, now)
    if (!drawable) continue
    const { width: naturalWidth, height: naturalHeight } = sourceSize(drawable)
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

export function drawCameraFrame(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  config: SlayCamConfig,
  background?: BackgroundSettings,
  backgroundAsset?: MediaAsset,
  mediaBank?: MediaBank,
  segmentation?: SegmentationFrame | null,
  now = 0,
) {
  const { width, height } = context.canvas
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#120b10'
  context.fillRect(0, 0, width, height)
  if (video.readyState < 2) return

  if (!background || background.mode === 'none' || !segmentation) {
    drawVideo(context, video, width, height, config.settings.mirrorCamera)
    return
  }

  if (background.mode === 'blur') {
    context.save()
    context.filter = `blur(${Math.max(2, background.blur)}px)`
    const overscan = Math.max(8, background.blur * 1.8)
    drawVideo(context, video, width, height, config.settings.mirrorCamera, overscan)
    context.restore()
  } else if (background.mode === 'media' && backgroundAsset && mediaBank) {
    const drawable = mediaBank.source(backgroundAsset, now)
    if (drawable) drawCover(context, drawable, width, height)
    else fillBackground(context, background.color, width, height)
  } else {
    fillBackground(context, background.color, width, height)
  }

  drawSegmentedPerson(context, video, width, height, config.settings.mirrorCamera, segmentation)

}

function fillBackground(context: CanvasRenderingContext2D, color: string, width: number, height: number) {
  context.save()
  context.fillStyle = color || '#e45791'
  context.fillRect(0, 0, width, height)
  context.restore()
}

function drawableReady(drawable: Drawable) {
  return drawable instanceof HTMLImageElement ? drawable.complete && drawable.naturalWidth > 0 : drawable.readyState >= 2 && drawable.videoWidth > 0
}

function drawCover(context: CanvasRenderingContext2D, drawable: DrawSource, width: number, height: number) {
  const { width: sourceWidth, height: sourceHeight } = sourceSize(drawable)
  if (!sourceWidth || !sourceHeight) return
  const scale = Math.max(width / sourceWidth, height / sourceHeight)
  const drawWidth = sourceWidth * scale
  const drawHeight = sourceHeight * scale
  context.drawImage(drawable, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

function drawVideo(context: CanvasRenderingContext2D, video: HTMLVideoElement, width: number, height: number, mirrored: boolean, overscan = 0) {
  context.save()
  if (mirrored) {
    context.translate(width, 0)
    context.scale(-1, 1)
  }
  context.drawImage(video, -overscan, -overscan, width + overscan * 2, height + overscan * 2)
  context.restore()
}

function drawSegmentedPerson(
  context: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  width: number,
  height: number,
  mirrored: boolean,
  segmentation: SegmentationFrame,
) {
  personCanvas ??= document.createElement('canvas')
  maskCanvas ??= document.createElement('canvas')
  if (personCanvas.width !== width || personCanvas.height !== height) {
    personCanvas.width = width
    personCanvas.height = height
  }
  if (maskCanvas.width !== segmentation.width || maskCanvas.height !== segmentation.height) {
    maskCanvas.width = segmentation.width
    maskCanvas.height = segmentation.height
  }

  const maskContext = maskCanvas.getContext('2d')
  const personContext = personCanvas.getContext('2d')
  if (!maskContext || !personContext) return

  if (cachedSegmentation !== segmentation) {
    const pixels = maskContext.createImageData(segmentation.width, segmentation.height)
    for (let index = 0; index < segmentation.data.length; index += 1) {
      const offset = index * 4
      const confidence = Math.max(0, Math.min(1, (segmentation.data[index] - 0.08) / 0.84))
      pixels.data[offset] = 255
      pixels.data[offset + 1] = 255
      pixels.data[offset + 2] = 255
      pixels.data[offset + 3] = Math.round(confidence * 255)
    }
    maskContext.putImageData(pixels, 0, 0)
    cachedSegmentation = segmentation
  }

  personContext.clearRect(0, 0, width, height)
  drawVideo(personContext, video, width, height, mirrored)
  personContext.save()
  personContext.globalCompositeOperation = 'destination-in'
  personContext.imageSmoothingEnabled = true
  if (mirrored) {
    personContext.translate(width, 0)
    personContext.scale(-1, 1)
  }
  personContext.drawImage(maskCanvas, 0, 0, width, height)
  personContext.restore()
  personContext.globalCompositeOperation = 'source-over'
  context.drawImage(personCanvas, 0, 0)
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
