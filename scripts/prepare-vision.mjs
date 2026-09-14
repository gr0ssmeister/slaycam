import { access, copyFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const wasmSource = resolve(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const wasmTarget = resolve(root, 'public/wasm')
const gestureModelTarget = resolve(root, 'public/models/gesture_recognizer.task')
const poseModelTarget = resolve(root, 'public/models/pose_landmarker_lite.task')
const faceModelTarget = resolve(root, 'public/models/face_landmarker.task')

await mkdir(wasmTarget, { recursive: true })
await mkdir(dirname(gestureModelTarget), { recursive: true })

for (const file of [
  'vision_wasm_internal.js',
  'vision_wasm_internal.wasm',
  'vision_wasm_nosimd_internal.js',
  'vision_wasm_nosimd_internal.wasm',
]) {
  await copyFile(resolve(wasmSource, file), resolve(wasmTarget, file))
}

await ensureModel(
  gestureModelTarget,
  'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
)
await ensureModel(
  poseModelTarget,
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task',
)
await ensureModel(
  faceModelTarget,
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
)

async function ensureModel(target, url) {
  try {
    await access(target)
  } catch {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Could not download MediaPipe model: ${response.status}`)
    await BunWriteCompat(target, new Uint8Array(await response.arrayBuffer()))
  }
}

async function BunWriteCompat(path, bytes) {
  const { writeFile } = await import('node:fs/promises')
  await writeFile(path, bytes)
}
