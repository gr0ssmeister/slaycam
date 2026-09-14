export type MediaType = 'image' | 'video'
export type TriggerType = 'built-in' | 'custom'
export type CustomGestureTracking = 'hand' | 'pose' | 'motion'
export type Anchor = 'screen-center' | 'screen-top' | 'screen-bottom' | 'screen-top-left' | 'screen-top-right' | 'screen-bottom-left' | 'screen-bottom-right' | 'above-head' | 'face' | 'gesture-hand' | 'left-hand' | 'right-hand'
export type EffectAnimation = 'pop' | 'fade' | 'slide-up' | 'spin' | 'none'
export type EffectMode = 'once' | 'while-held'

export interface Point3D {
  x: number
  y: number
  z: number
}

export interface MediaAsset {
  id: string
  name: string
  type: MediaType
  extension: string
  src: string
  storedName: string
  pack?: string
  createdAt: string
}

export interface CustomGesture {
  id: string
  name: string
  samples: number[][]
  threshold: number
  tracking: CustomGestureTracking
  durationMs?: number
  motionEnergy?: number
  preview?: string
  createdAt: string
}

export interface EffectRule {
  id: string
  name: string
  enabled: boolean
  triggerType: TriggerType
  gesture: string
  customGestureId?: string
  mediaId: string
  confidence: number
  holdMs: number
  cooldownMs: number
  durationMs: number
  mode: EffectMode
  anchor: Anchor
  offsetX: number
  offsetY: number
  scale: number
  rotation: number
  opacity: number
  mirror: boolean
  layer: number
  animation: EffectAnimation
}

export interface AppSettings {
  cameraId: string
  width: number
  height: number
  fps: number
  mirrorCamera: boolean
  showLandmarks: boolean
  showFps: boolean
  inferenceFps: number
  onboardingComplete: boolean
  outputWindowOpen: boolean
}

export interface SlayCamConfig {
  version: 1
  media: MediaAsset[]
  gestures: CustomGesture[]
  rules: EffectRule[]
  installedPacks: string[]
  settings: AppSettings
}

export interface GestureReading {
  name: string
  score: number
  landmarks: Point3D[]
  handedness: 'Left' | 'Right' | 'Unknown'
}

export interface ActiveEffect {
  id: string
  ruleId: string
  mediaId: string
  startedAt: number
  endsAt: number
  rule: EffectRule
  landmarks: Point3D[]
  poseLandmarks?: Point3D[]
  handedness: 'Left' | 'Right' | 'Unknown'
}

export interface CameraStatus {
  phase: 'idle' | 'requesting' | 'ready' | 'denied' | 'missing' | 'error'
  message: string
}

export const BUILT_IN_GESTURES = [
  { value: 'Open_Palm', label: 'Открытая ладонь', emoji: '🖐️', hint: 'Покажи ладонь в камеру' },
  { value: 'Closed_Fist', label: 'Кулак', emoji: '✊', hint: 'Сожми пальцы в кулак' },
  { value: 'Pointing_Up', label: 'Палец вверх', emoji: '☝️', hint: 'Подними указательный палец' },
  { value: 'Thumb_Up', label: 'Большой палец вверх', emoji: '👍', hint: 'Покажи лайк' },
  { value: 'Thumb_Down', label: 'Большой палец вниз', emoji: '👎', hint: 'Поверни большой палец вниз' },
  { value: 'Victory', label: 'Знак победы', emoji: '✌️', hint: 'Подними два пальца' },
  { value: 'ILoveYou', label: 'I love you', emoji: '🤟', hint: 'Большой, указательный и мизинец' },
] as const

export const ANCHORS: { value: Anchor; label: string; hint: string; icon: string }[] = [
  { value: 'gesture-hand', label: 'На активной руке', hint: 'Следует за рукой, которая запустила эффект', icon: '✋' },
  { value: 'left-hand', label: 'На левой руке', hint: 'Следует за левой кистью, если видно тело', icon: '🤚' },
  { value: 'right-hand', label: 'На правой руке', hint: 'Следует за правой кистью, если видно тело', icon: '✋' },
  { value: 'face', label: 'На лице', hint: 'Следует за центром лица', icon: '🙂' },
  { value: 'above-head', label: 'Над головой', hint: 'Держится чуть выше головы', icon: '👑' },
  { value: 'screen-center', label: 'По центру', hint: 'Фиксированное место в центре кадра', icon: '⊙' },
  { value: 'screen-top', label: 'Сверху по центру', hint: 'Фиксируется у верхнего края', icon: '↑' },
  { value: 'screen-bottom', label: 'Снизу по центру', hint: 'Фиксируется у нижнего края', icon: '↓' },
  { value: 'screen-top-left', label: 'Сверху слева', hint: 'Фиксируется в левом верхнем углу', icon: '↖' },
  { value: 'screen-top-right', label: 'Сверху справа', hint: 'Фиксируется в правом верхнем углу', icon: '↗' },
  { value: 'screen-bottom-left', label: 'Снизу слева', hint: 'Фиксируется в левом нижнем углу', icon: '↙' },
  { value: 'screen-bottom-right', label: 'Снизу справа', hint: 'Фиксируется в правом нижнем углу', icon: '↘' },
]
