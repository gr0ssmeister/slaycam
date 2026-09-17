import type { CustomGesture, GestureReading, Point3D } from '../types'

export function normalizeLandmarks(landmarks: Point3D[]): number[] {
  if (landmarks.length < 21) return []
  const wrist = landmarks[0]
  const translated = landmarks.map((point) => ({
    x: point.x - wrist.x,
    y: point.y - wrist.y,
    z: point.z - wrist.z,
  }))
  const scale = Math.max(
    ...translated.map((point) => Math.hypot(point.x, point.y, point.z)),
    0.0001,
  )
  return translated.flatMap((point) => [point.x / scale, point.y / scale, point.z / scale])
}

export function normalizeTwoHandLandmarks(hands: Point3D[][]): number[] {
  if (hands.length < 2 || hands.some((hand) => hand.length < 21)) return []
  const ordered = hands.slice(0, 2).sort((a, b) => a[0].x - b[0].x)
  const center = {
    x: (ordered[0][0].x + ordered[1][0].x) / 2,
    y: (ordered[0][0].y + ordered[1][0].y) / 2,
    z: (ordered[0][0].z + ordered[1][0].z) / 2,
  }
  const translated = ordered.flat().map((point) => ({
    x: point.x - center.x,
    y: point.y - center.y,
    z: point.z - center.z,
  }))
  const scale = Math.max(...translated.map((point) => Math.hypot(point.x, point.y, point.z)), 0.0001)
  return translated.flatMap((point) => [point.x / scale, point.y / scale, point.z / scale])
}

export function normalizePoseLandmarks(landmarks: Point3D[]): number[] {
  if (landmarks.length < 33) return []
  const leftHip = landmarks[23]
  const rightHip = landmarks[24]
  const center = {
    x: (leftHip.x + rightHip.x) / 2,
    y: (leftHip.y + rightHip.y) / 2,
    z: (leftHip.z + rightHip.z) / 2,
  }
  const translated = landmarks.map((point) => ({
    x: point.x - center.x,
    y: point.y - center.y,
    z: point.z - center.z,
  }))
  const shoulderWidth = Math.hypot(
    landmarks[11].x - landmarks[12].x,
    landmarks[11].y - landmarks[12].y,
    landmarks[11].z - landmarks[12].z,
  )
  const scale = Math.max(shoulderWidth, ...translated.map((point) => Math.hypot(point.x, point.y, point.z)), 0.0001)
  return translated.flatMap((point) => [point.x / scale, point.y / scale, point.z / scale])
}

export function gestureDistance(a: number[], b: number[]): number {
  if (a.length === 0 || a.length !== b.length) return Number.POSITIVE_INFINITY
  let sum = 0
  for (let index = 0; index < a.length; index += 1) {
    const delta = a[index] - b[index]
    sum += delta * delta
  }
  return Math.sqrt(sum / a.length)
}

export function matchCustomGesture(
  landmarks: Point3D[],
  gestures: CustomGesture[],
): { id: string; name: string; score: number } | null {
  const normalized = normalizeLandmarks(landmarks)
  let best: { id: string; name: string; score: number } | null = null
  for (const gesture of gestures.filter((item) => (item.tracking ?? 'hand') === 'hand')) {
    const distance = Math.min(...gesture.samples.map((sample) => gestureDistance(normalized, sample)))
    const score = Math.max(0, 1 - distance)
    if (distance <= gesture.threshold && (!best || score > best.score)) {
      best = { id: gesture.id, name: gesture.name, score }
    }
  }
  return best
}

export function matchCustomTwoHandGesture(
  hands: Point3D[][],
  gestures: CustomGesture[],
): { id: string; name: string; score: number } | null {
  const normalized = normalizeTwoHandLandmarks(hands)
  if (!normalized.length) return null
  let best: { id: string; name: string; score: number } | null = null
  for (const gesture of gestures.filter((item) => item.tracking === 'two-hands')) {
    const distance = Math.min(...gesture.samples.map((sample) => gestureDistance(normalized, sample)))
    const score = Math.max(0, 1 - distance)
    if (distance <= gesture.threshold && (!best || score > best.score)) best = { id: gesture.id, name: gesture.name, score }
  }
  return best
}

export function matchCustomEmotion(
  blendshapes: number[],
  gestures: CustomGesture[],
): { id: string; name: string; score: number } | null {
  if (!blendshapes.length) return null
  let best: { id: string; name: string; score: number } | null = null
  for (const gesture of gestures.filter((item) => item.tracking === 'emotion')) {
    const distance = Math.min(...gesture.samples.map((sample) => gestureDistance(blendshapes, sample)))
    const score = Math.max(0, 1 - distance)
    if (distance <= gesture.threshold && (!best || score > best.score)) best = { id: gesture.id, name: gesture.name, score }
  }
  return best
}

export function matchCustomPose(
  landmarks: Point3D[],
  gestures: CustomGesture[],
): { id: string; name: string; score: number } | null {
  const normalized = normalizePoseLandmarks(landmarks)
  let best: { id: string; name: string; score: number } | null = null
  for (const gesture of gestures.filter((item) => item.tracking === 'pose')) {
    const distance = Math.min(...gesture.samples.map((sample) => gestureDistance(normalized, sample)))
    const score = Math.max(0, 1 - distance)
    if (distance <= gesture.threshold && (!best || score > best.score)) best = { id: gesture.id, name: gesture.name, score }
  }
  return best
}

export function motionEnergy(sequence: number[][]): number {
  if (sequence.length < 2) return 0
  let total = 0
  for (let index = 1; index < sequence.length; index += 1) {
    total += gestureDistance(sequence[index - 1], sequence[index])
  }
  return total / (sequence.length - 1)
}

function resampleSequence(sequence: number[][], length: number): number[][] {
  if (!sequence.length || length <= 0) return []
  if (sequence.length === length) return sequence
  return Array.from({ length }, (_, index) => {
    const source = index * (sequence.length - 1) / Math.max(1, length - 1)
    return sequence[Math.round(source)]
  })
}

export function sequenceDistance(a: number[][], b: number[][]): number {
  if (!a.length || !b.length) return Number.POSITIVE_INFINITY
  const sampled = resampleSequence(a, b.length)
  return sampled.reduce((sum, frame, index) => sum + gestureDistance(frame, b[index]), 0) / b.length
}

// Live poses arrive at their own rate, and nobody repeats a movement at exactly the speed
// they recorded it. Comparing only a window as long as the recording therefore missed most
// takes, so the same movement is looked for across a range of tempos.
const MOTION_TEMPOS = [0.6, 0.75, 0.9, 1, 1.15, 1.35, 1.6]

export function matchMotionGesture(
  poseHistory: number[][],
  gestures: CustomGesture[],
): { id: string; name: string; score: number } | null {
  let best: { id: string; name: string; score: number } | null = null
  for (const gesture of gestures.filter((item) => item.tracking === 'motion' && item.samples.length >= 8)) {
    const expectedEnergy = gesture.motionEnergy ?? motionEnergy(gesture.samples)
    let closest = Number.POSITIVE_INFINITY
    let lastLength = 0
    for (const tempo of MOTION_TEMPOS) {
      const length = Math.round(gesture.samples.length * tempo)
      if (length < 8 || length > poseHistory.length || length === lastLength) continue
      lastLength = length
      const window = poseHistory.slice(-length)
      const energy = motionEnergy(window)
      if (expectedEnergy > 0.004 && energy < expectedEnergy * 0.35) continue
      closest = Math.min(closest, sequenceDistance(window, gesture.samples))
    }
    const score = Math.max(0, 1 - closest)
    if (closest <= gesture.threshold && (!best || score > best.score)) best = { id: gesture.id, name: gesture.name, score }
  }
  return best
}

interface RuntimeState {
  enteredAt: number
  lastFiredAt: number
  wasMatching: boolean
  firedDuringMatch: boolean
  lostAt: number | null
}

const RELEASE_GRACE_MS = 250

export class RuleEngine {
  private states = new Map<string, RuntimeState>()

  evaluate(
    ruleId: string,
    matches: boolean,
    confidence: number,
    requiredConfidence: number,
    holdMs: number,
    cooldownMs: number,
    now: number,
    repeatWhileHeld = false,
  ): boolean {
    const state = this.states.get(ruleId) ?? { enteredAt: now, lastFiredAt: -Infinity, wasMatching: false, firedDuringMatch: false, lostAt: null }
    if (!matches || confidence < requiredConfidence) {
      if (state.wasMatching) {
        state.lostAt ??= now
        if (now - state.lostAt >= RELEASE_GRACE_MS) {
          state.wasMatching = false
          state.firedDuringMatch = false
          state.enteredAt = now
          state.lostAt = null
        }
      }
      this.states.set(ruleId, state)
      return false
    }
    state.lostAt = null
    if (!state.wasMatching) {
      state.enteredAt = now
      state.wasMatching = true
      state.firedDuringMatch = false
    }
    const heldLongEnough = now - state.enteredAt >= holdMs
    const cooledDown = now - state.lastFiredAt >= cooldownMs
    if (heldLongEnough && cooledDown && (repeatWhileHeld || !state.firedDuringMatch)) {
      state.lastFiredAt = now
      state.firedDuringMatch = true
      this.states.set(ruleId, state)
      return true
    }
    this.states.set(ruleId, state)
    return false
  }

  reset() {
    this.states.clear()
  }
}

export function readingMatchesRule(
  reading: GestureReading,
  triggerType: 'built-in' | 'custom' | 'emotion',
  gesture: string,
  customGestureId?: string,
): boolean {
  if (triggerType === 'custom') return reading.name === `custom:${customGestureId}`
  if (triggerType === 'emotion') return reading.name === `emotion:${gesture}`
  return reading.name === gesture
}
