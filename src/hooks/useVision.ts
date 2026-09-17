import { useCallback, useEffect, useRef, useState } from 'react'
import { FaceLandmarker, FilesetResolver, GestureRecognizer, PoseLandmarker } from '@mediapipe/tasks-vision'
import type { AppSettings, CameraStatus, CustomGesture, GestureReading, Point3D, SegmentationFrame } from '../types'
import { blendshapeVector, emotionReadings } from '../lib/emotions'
import { matchCustomEmotion, matchCustomGesture, matchCustomPose, matchCustomTwoHandGesture, matchMotionGesture, normalizePoseLandmarks } from '../lib/gestures'

export function useVision(settings: AppSettings, customGestures: CustomGesture[]) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recognizerRef = useRef<GestureRecognizer | null>(null)
  const poseRef = useRef<PoseLandmarker | null>(null)
  const faceRef = useRef<FaceLandmarker | null>(null)
  const frameRef = useRef<number>(0)
  const lastHandInferenceRef = useRef(0)
  const lastPoseInferenceRef = useRef(0)
  const lastFaceInferenceRef = useRef(0)
  const poseHistoryRef = useRef<number[][]>([])
  const customGesturesRef = useRef(customGestures)
  const segmentationRef = useRef<SegmentationFrame | null>(null)
  const [status, setStatus] = useState<CameraStatus>({
    phase: "idle",
    message: "Камера выключена",
  });
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const [readings, setReadings] = useState<GestureReading[]>([])
  const [hands, setHands] = useState<{ landmarks: Point3D[]; handedness: GestureReading['handedness'] }[]>([])
  const [poses, setPoses] = useState<Point3D[][]>([])
  const [faces, setFaces] = useState<Point3D[][]>([])
  const [faceBlendshapes, setFaceBlendshapes] = useState<number[]>([])
  const [modelReady, setModelReady] = useState(false)

  useEffect(() => { customGesturesRef.current = customGestures }, [customGestures])

  const refreshDevices = useCallback(async () => {
    const mediaDevices = navigator.mediaDevices
    if (!mediaDevices?.enumerateDevices) return
    try {
      const available = await mediaDevices.enumerateDevices()
      setDevices(available.filter((device) => device.kind === 'videoinput'))
    } catch {
      setDevices([])
    }
  }, [])

  const initializeModels = useCallback(async () => {
    if (recognizerRef.current && poseRef.current && faceRef.current) return { recognizer: recognizerRef.current, pose: poseRef.current, face: faceRef.current }
    const wasmRoot = new URL('./wasm/', document.baseURI).toString()
    const gestureModelPath = new URL('./models/gesture_recognizer.task', document.baseURI).toString()
    const poseModelPath = new URL('./models/pose_landmarker_lite.task', document.baseURI).toString()
    const faceModelPath = new URL('./models/face_landmarker.task', document.baseURI).toString()
    const vision = await FilesetResolver.forVisionTasks(wasmRoot)

    const createRecognizer = (delegate: 'GPU' | 'CPU') => GestureRecognizer.createFromOptions(vision, {
      baseOptions: { modelAssetPath: gestureModelPath, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    const createPose = (delegate: 'GPU' | 'CPU') => PoseLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: poseModelPath, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      minPoseDetectionConfidence: 0.45,
      minPosePresenceConfidence: 0.45,
      minTrackingConfidence: 0.45,
      outputSegmentationMasks: true,
    })
    const createFace = (delegate: 'GPU' | 'CPU') => FaceLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: faceModelPath, delegate },
      runningMode: 'VIDEO',
      numFaces: 1,
      minFaceDetectionConfidence: 0.5,
      minFacePresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: false,
    })

    try {
      recognizerRef.current = await createRecognizer('GPU')
    } catch {
      recognizerRef.current = await createRecognizer('CPU')
    }
    try {
      poseRef.current = await createPose('GPU')
    } catch {
      poseRef.current = await createPose('CPU')
    }
    try {
      faceRef.current = await createFace('GPU')
    } catch {
      faceRef.current = await createFace('CPU')
    }
    setModelReady(true)
    return { recognizer: recognizerRef.current, pose: poseRef.current, face: faceRef.current }
  }, [])

  const stopCamera = useCallback(() => {
    cancelAnimationFrame(frameRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    poseHistoryRef.current = []
    if (videoRef.current) videoRef.current.srcObject = null
    setReadings([])
    setHands([])
    setPoses([])
    setFaces([])
    setFaceBlendshapes([])
    segmentationRef.current = null
    setStatus({ phase: "idle", message: "Камера выключена" });
  }, [])

  const startCamera = useCallback(async () => {
    setStatus({ phase: 'requesting', message: 'Подключаем камеру…' })
    try {
      stopCamera()
      setStatus({ phase: 'requesting', message: 'Загружаем точки тела…' })
      const { recognizer, pose, face } = await initializeModels()
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          deviceId: settings.cameraId ? { exact: settings.cameraId } : undefined,
          width: { ideal: settings.width },
          height: { ideal: settings.height },
          frameRate: { ideal: settings.fps },
        },
      })
      streamRef.current = stream
      if (!videoRef.current) throw new Error('Камера ещё не готова')
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      await refreshDevices()
      setStatus({ phase: 'ready', message: 'Камера работает' })

      let latestHands: { landmarks: Point3D[]; handedness: GestureReading['handedness'] }[] = []
      let latestPoses: Point3D[][] = []
      let latestBuiltIn: GestureReading[] = []
      let latestEmotions: GestureReading[] = []
      let latestFaceLandmarks: Point3D[] = []
      let latestFaceBlendshapes: number[] = []

      const publishReadings = () => {
        const nextReadings = [...latestBuiltIn, ...latestEmotions]
        for (const hand of latestHands) {
          const custom = matchCustomGesture(hand.landmarks, customGesturesRef.current)
          if (custom) nextReadings.push({ name: `custom:${custom.id}`, score: custom.score, landmarks: hand.landmarks, handedness: hand.handedness })
        }
        const twoHands = matchCustomTwoHandGesture(latestHands.map((hand) => hand.landmarks), customGesturesRef.current)
        if (twoHands) nextReadings.push({ name: `custom:${twoHands.id}`, score: twoHands.score, landmarks: latestHands.slice(0, 2).flatMap((hand) => hand.landmarks), handedness: 'Unknown' })
        const customEmotion = matchCustomEmotion(latestFaceBlendshapes, customGesturesRef.current)
        if (customEmotion) nextReadings.push({ name: `custom:${customEmotion.id}`, score: customEmotion.score, landmarks: latestFaceLandmarks, handedness: 'Unknown' })
        const primaryPose = latestPoses[0]
        if (primaryPose) {
          const customPose = matchCustomPose(primaryPose, customGesturesRef.current)
          if (customPose) nextReadings.push({ name: `custom:${customPose.id}`, score: customPose.score, landmarks: primaryPose, handedness: 'Unknown' })
          const motion = matchMotionGesture(poseHistoryRef.current, customGesturesRef.current)
          if (motion) nextReadings.push({ name: `custom:${motion.id}`, score: motion.score, landmarks: primaryPose, handedness: 'Unknown' })
        }
        setReadings(nextReadings)
      }

      const processFrame = () => {
        const video = videoRef.current
        if (!video || !streamRef.current) return
        const now = performance.now()
        let inferenceUpdated = false
        if (video.readyState >= 2 && now - lastHandInferenceRef.current >= 1000 / settings.inferenceFps) {
          lastHandInferenceRef.current = now
          try {
            const result = recognizer.recognizeForVideo(video, now)
            latestHands = result.landmarks.map((rawLandmarks, index) => {
              const landmarks = rawLandmarks.map(({ x, y, z }) => ({ x, y, z })) as Point3D[]
              const handednessName = result.handedness[index]?.[0]?.categoryName
              const handedness: GestureReading['handedness'] = handednessName === 'Left' || handednessName === 'Right' ? handednessName : 'Unknown'
              return { landmarks, handedness }
            })
            latestBuiltIn = result.landmarks.flatMap((rawLandmarks, index) => {
              const category = result.gestures[index]?.[0]
              if (!category || category.categoryName === 'None') return []
              const handednessName = result.handedness[index]?.[0]?.categoryName
              const handedness: GestureReading['handedness'] = handednessName === 'Left' || handednessName === 'Right' ? handednessName : 'Unknown'
              return [{
                name: category.categoryName,
                score: category.score,
                landmarks: rawLandmarks.map(({ x, y, z }) => ({ x, y, z })) as Point3D[],
                handedness,
              }]
            })
            setHands(latestHands)
            inferenceUpdated = true
          } catch (error) {
            console.warn('Hand frame skipped', error)
          }
        }
        if (video.readyState >= 2 && now - lastPoseInferenceRef.current >= 1000 / Math.min(15, settings.inferenceFps)) {
          lastPoseInferenceRef.current = now
          try {
            const result = pose.detectForVideo(video, now)
            latestPoses = result.landmarks.map((rawLandmarks) => rawLandmarks.map(({ x, y, z }) => ({ x, y, z })) as Point3D[])
            const mask = result.segmentationMasks?.[0]
            if (mask) {
              segmentationRef.current = {
                width: mask.width,
                height: mask.height,
                data: new Float32Array(mask.getAsFloat32Array()),
              }
            } else {
              segmentationRef.current = null
            }
            const normalized = latestPoses[0] ? normalizePoseLandmarks(latestPoses[0]) : []
            if (normalized.length) poseHistoryRef.current = [...poseHistoryRef.current.slice(-89), normalized]
            setPoses(latestPoses)
            result.close()
            inferenceUpdated = true
          } catch (error) {
            console.warn('Pose frame skipped', error)
          }
        }
        if (video.readyState >= 2 && now - lastFaceInferenceRef.current >= 1000 / Math.min(10, settings.inferenceFps)) {
          lastFaceInferenceRef.current = now
          try {
            const result = face.detectForVideo(video, now)
            const landmarks = result.faceLandmarks[0]?.map(({ x, y, z }) => ({ x, y, z })) as Point3D[] | undefined
            latestFaceLandmarks = landmarks ?? []
            latestFaceBlendshapes = result.faceBlendshapes[0] ? blendshapeVector(result.faceBlendshapes[0].categories) : []
            latestEmotions = landmarks && result.faceBlendshapes[0]
              ? emotionReadings(result.faceBlendshapes[0].categories, landmarks)
              : []
            setFaces(latestFaceLandmarks.length ? [latestFaceLandmarks] : [])
            setFaceBlendshapes(latestFaceBlendshapes)
            inferenceUpdated = true
          } catch (error) {
            console.warn('Face frame skipped', error)
          }
        }
        if (inferenceUpdated) publishReadings()
        frameRef.current = requestAnimationFrame(processFrame)
      }
      frameRef.current = requestAnimationFrame(processFrame)
    } catch (error) {
      const name = error instanceof DOMException ? error.name : ''
      if (name === 'NotAllowedError') {
        setStatus({ phase: 'denied', message: 'Доступ к камере запрещён. Разрешите его в настройках системы.' })
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setStatus({ phase: 'missing', message: 'Камера не найдена. Проверьте подключение или выберите другую.' })
      } else {
        setStatus({ phase: 'error', message: error instanceof Error ? error.message : 'Не удалось запустить камеру' })
      }
    }
  }, [initializeModels, refreshDevices, settings.cameraId, settings.fps, settings.height, settings.inferenceFps, settings.width, stopCamera])

  useEffect(() => {
    return () => {
      cancelAnimationFrame(frameRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
      recognizerRef.current?.close()
      poseRef.current?.close()
      faceRef.current?.close()
    }
  }, [refreshDevices])

  return { videoRef, segmentationRef, status, devices, readings, hands, poses, faces, faceBlendshapes, modelReady, startCamera, stopCamera, refreshDevices }
}
