import { Activity, Check, Hand, HeartHandshake, PersonStanding, Plus, ScanFace, ScanLine, Smile, Trash2, Video, X } from 'lucide-react'
import { useEffect, useRef, useState, type RefObject } from 'react'
import { motionEnergy, normalizeLandmarks, normalizePoseLandmarks, normalizeTwoHandLandmarks } from '../lib/gestures'
import type { CameraStatus, CustomGesture, CustomGestureTracking, GestureReading, Point3D } from '../types'

const HAND_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [5, 6], [6, 7], [7, 8], [5, 9], [9, 10], [10, 11], [11, 12], [9, 13], [13, 14], [14, 15], [15, 16], [13, 17], [17, 18], [18, 19], [19, 20], [0, 17]]
const POSE_CONNECTIONS = [[0, 1], [1, 2], [2, 3], [3, 7], [0, 4], [4, 5], [5, 6], [6, 8], [9, 10], [11, 12], [11, 13], [13, 15], [15, 17], [15, 19], [15, 21], [17, 19], [12, 14], [14, 16], [16, 18], [16, 20], [16, 22], [18, 20], [11, 23], [12, 24], [23, 24], [23, 25], [24, 26], [25, 27], [26, 28], [27, 29], [28, 30], [29, 31], [30, 32], [27, 31], [28, 32]]
const FACE_LOOPS = [
  [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109],
  [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246],
  [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466],
  [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95, 78],
]
const FACE_CONNECTIONS = FACE_LOOPS.flatMap((loop) => loop.map((point, index) => [point, loop[(index + 1) % loop.length]]))

const modeInfo: Record<CustomGestureTracking, { title: string; hint: string; icon: typeof Hand }> = {
  hand: { title: 'Знак руками', hint: 'Одна или две кисти', icon: Hand },
  'two-hands': { title: 'Две руки', hint: 'Записано две кисти', icon: HeartHandshake },
  pose: { title: 'Поза тела', hint: 'Статичная поза', icon: PersonStanding },
  motion: { title: 'Движение', hint: 'Связка до 3 секунд', icon: Activity },
  emotion: { title: 'Своя эмоция', hint: 'Мимика и выражение лица', icon: Smile },
}

const recordingModes: CustomGestureTracking[] = ['hand', 'emotion', 'pose', 'motion']

// A take waits here until it is named, so nothing has to be typed before recording.
type PendingGesture = Pick<CustomGesture, 'samples' | 'threshold' | 'tracking' | 'durationMs' | 'motionEnergy' | 'preview'>
type PendingTake = { gesture: PendingGesture, frames: string[], intervalMs: number }

// The take plays back in a loop so a bad recording can be spotted before it is saved.
function TakeReplay({ frames, intervalMs }: { frames: string[], intervalMs: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (!frames.length) return
    const images = frames.map((source) => {
      const image = new Image()
      image.src = source
      return image
    })
    let index = 0
    const paint = () => {
      const canvas = canvasRef.current
      const context = canvas?.getContext('2d')
      const image = images[index % images.length]
      index += 1
      if (!canvas || !context || !image.complete || !image.naturalWidth) return
      if (canvas.width !== image.naturalWidth || canvas.height !== image.naturalHeight) {
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
      }
      context.drawImage(image, 0, 0)
    }
    paint()
    const timer = window.setInterval(paint, intervalMs)
    return () => window.clearInterval(timer)
  }, [frames, intervalMs])

  return <canvas ref={canvasRef} className="take-replay" aria-label="Повтор записи" />
}

function suggestedName(mode: CustomGestureTracking, index: number) {
  const base = mode === 'motion' ? 'Движение' : mode === 'emotion' ? 'Эмоция' : mode === 'pose' ? 'Поза' : 'Жест'
  return `${base} ${index}`
}

function drawTrackedSet(context: CanvasRenderingContext2D, landmarks: Point3D[], connections: number[][], mirrored: boolean, color: string, pointRadius = 3.5) {
  const { width, height } = context.canvas
  const pointAt = (index: number) => ({ x: (mirrored ? 1 - landmarks[index].x : landmarks[index].x) * width, y: landmarks[index].y * height })
  context.save()
  context.strokeStyle = color
  context.lineWidth = 2.2
  context.shadowColor = color
  context.shadowBlur = 7
  for (const [from, to] of connections) {
    if (!landmarks[from] || !landmarks[to]) continue
    const a = pointAt(from)
    const b = pointAt(to)
    context.beginPath()
    context.moveTo(a.x, a.y)
    context.lineTo(b.x, b.y)
    context.stroke()
  }
  context.fillStyle = '#fff'
  for (const point of landmarks) {
    context.beginPath()
    context.arc((mirrored ? 1 - point.x : point.x) * width, point.y * height, pointRadius, 0, Math.PI * 2)
    context.fill()
    context.stroke()
  }
  context.restore()
}

function drawRecorderFrame(context: CanvasRenderingContext2D, video: HTMLVideoElement | null, hands: Point3D[][], poses: Point3D[][], faces: Point3D[][], mirrored: boolean, mode: CustomGestureTracking) {
  const { width, height } = context.canvas
  context.fillStyle = '#160d16'
  context.fillRect(0, 0, width, height)
  if (video && video.readyState >= 2) {
    context.save()
    if (mirrored) {
      context.translate(width, 0)
      context.scale(-1, 1)
    }
    context.drawImage(video, 0, 0, width, height)
    context.restore()
  }
  context.save()
  context.strokeStyle = 'rgba(255,255,255,.09)'
  context.lineWidth = 1
  for (let x = 0; x <= width; x += width / 12) {
    context.beginPath(); context.moveTo(x, 0); context.lineTo(x, height); context.stroke()
  }
  for (let y = 0; y <= height; y += height / 7) {
    context.beginPath(); context.moveTo(0, y); context.lineTo(width, y); context.stroke()
  }
  context.restore()
  if (mode === 'emotion') {
    faces.forEach((face) => drawTrackedSet(context, face, FACE_CONNECTIONS, mirrored, '#7ee8ff', 1.25))
  } else {
    poses.forEach((pose) => drawTrackedSet(context, pose, POSE_CONNECTIONS, mirrored, '#ff80c8'))
    hands.forEach((hand) => drawTrackedSet(context, hand, HAND_CONNECTIONS, mirrored, '#ffd26f'))
  }
}

export function GesturesPage({
  gestures,
  videoRef,
  hands,
  poses,
  faces,
  faceBlendshapes,
  mirrorCamera,
  cameraReady,
  cameraStatus,
  onStartCamera,
  onAdd,
  onChange,
  onRemove,
}: {
  gestures: CustomGesture[]
  videoRef: RefObject<HTMLVideoElement>
  hands: { landmarks: Point3D[]; handedness: GestureReading['handedness'] }[]
  poses: Point3D[][]
  faces: Point3D[][]
  faceBlendshapes: number[]
  mirrorCamera: boolean
  cameraReady: boolean
  cameraStatus: CameraStatus
  onStartCamera: () => void
  onAdd: (gesture: CustomGesture) => void
  onChange: (gesture: CustomGesture) => void
  onRemove: (gesture: CustomGesture) => void
}) {
  const [name, setName] = useState('')
  const [mode, setMode] = useState<CustomGestureTracking>('hand')
  const [phase, setPhase] = useState<'idle' | 'countdown' | 'recording' | 'naming' | 'saved'>('idle')
  const [pending, setPending] = useState<PendingTake | null>(null)
  const [countdown, setCountdown] = useState(0)
  const [progress, setProgress] = useState(0)
  const [recordError, setRecordError] = useState('')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const latestHands = useRef(hands)
  const latestPoses = useRef(poses)
  const latestFaceBlendshapes = useRef(faceBlendshapes)
  const cancelToken = useRef(0)
  const replayCanvasRef = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => { latestHands.current = hands }, [hands])
  useEffect(() => { latestPoses.current = poses }, [poses])
  useEffect(() => { latestFaceBlendshapes.current = faceBlendshapes }, [faceBlendshapes])

  useEffect(() => {
    let frame = 0
    const draw = () => {
      const canvas = canvasRef.current
      if (canvas) {
        const context = canvas.getContext('2d')
        if (context) drawRecorderFrame(context, videoRef.current, hands.map((item) => item.landmarks), poses, faces, mirrorCamera, mode)
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [faces, hands, mirrorCamera, mode, poses, videoRef])

  const targetVisible = mode === 'hand' ? hands.length > 0 : mode === 'emotion' ? faces.length > 0 && faceBlendshapes.length > 0 : poses.length > 0
  const targetLabel = mode === 'hand'
    ? `${hands.length ? `${hands.length} ${hands.length === 1 ? 'кисть' : 'кисти'}` : 'Кисть не найдена'}`
    : mode === 'emotion'
      ? `${faces.length ? 'Лицо найдено' : 'Лицо не найдено'}`
      : `${poses.length ? 'Тело найдено' : 'Тело не найдено'}`

  // Frames are grabbed small: the replay only has to show what the camera saw.
  const captureTakeFrame = () => {
    const source = canvasRef.current
    if (!source) return ''
    const target = replayCanvasRef.current ?? document.createElement('canvas')
    replayCanvasRef.current = target
    if (target.width !== 256) {
      target.width = 256
      target.height = 144
    }
    const context = target.getContext('2d')
    if (!context) return ''
    context.drawImage(source, 0, 0, target.width, target.height)
    return target.toDataURL('image/webp', 0.6)
  }

  const cancelRecord = () => {
    cancelToken.current += 1
    setPending(null)
    setPhase('idle')
    setCountdown(0)
    setProgress(0)
  }

  const savePending = () => {
    if (!pending || !name.trim()) return
    onAdd({ id: crypto.randomUUID(), name: name.trim(), createdAt: new Date().toISOString(), ...pending.gesture })
    setPending(null)
    setName('')
    setPhase('saved')
    window.setTimeout(() => setPhase('idle'), 1200)
  }

  const record = async () => {
    if (!cameraReady || !targetVisible) return
    const recordedHandCount = mode === 'hand' ? Math.min(latestHands.current.length, 2) : 0
    const token = ++cancelToken.current
    setRecordError('')
    setProgress(0)
    setPhase('countdown')
    for (let count = 3; count >= 1; count -= 1) {
      setCountdown(count)
      await new Promise((resolve) => setTimeout(resolve, 700))
      if (cancelToken.current !== token) return
    }
    setCountdown(0)
    setPhase('recording')
    const sampleCount = mode === 'motion' ? 42 : 24
    const interval = mode === 'motion' ? 75 : 70
    const samples: number[][] = []
    const frames: string[] = []
    for (let index = 0; index < sampleCount; index += 1) {
      await new Promise((resolve) => setTimeout(resolve, interval))
      if (cancelToken.current !== token) return
      const current = mode === 'hand' ? latestHands.current[0]?.landmarks : latestPoses.current[0]
      const normalized = mode === 'emotion'
        ? [...latestFaceBlendshapes.current]
        : recordedHandCount === 2
        ? normalizeTwoHandLandmarks(latestHands.current.map((hand) => hand.landmarks))
        : current ? (mode === 'hand' ? normalizeLandmarks(current) : normalizePoseLandmarks(current)) : []
      if (normalized.length) samples.push(normalized)
      if (mode === 'motion' || index % 3 === 0) {
        const frame = captureTakeFrame()
        if (frame) frames.push(frame)
      }
      setProgress((index + 1) / sampleCount)
    }
    const minimum = mode === 'motion' ? 24 : 10
    if (samples.length < minimum) {
      setPhase('idle')
      setRecordError(mode === 'hand'
        ? recordedHandCount === 2
          ? 'Одна из кистей пропала. Держи обе руки целиком в кадре и повтори.'
          : 'Кисть пропала из кадра. Покажи её целиком и повтори.'
          : mode === 'emotion'
            ? 'Лицо пропало из кадра. Смотри в камеру и повтори запись.'
            : 'Точки тела потерялись. Отойди от камеры, чтобы плечи и корпус помещались в кадр.')
      return
    }
    const durationMs = Math.round(samples.length * interval)
    setPending({
      gesture: {
        samples,
        threshold: mode === 'motion' ? 0.16 : mode === 'emotion' ? 0.1 : 0.22,
        tracking: mode === 'hand' && recordedHandCount === 2 ? 'two-hands' : mode,
        durationMs,
        motionEnergy: mode === 'motion' ? motionEnergy(samples) : undefined,
        preview: frames[Math.floor(frames.length / 2)] ?? '',
      },
      frames,
      intervalMs: mode === 'motion' ? interval : interval * 3,
    })
    setName(suggestedName(mode, gestures.length + 1))
    setPhase('naming')
  }

  return (
    <div className="page gestures-page">
      <header className="page-header"><div><h1>Лаборатория движений</h1><p>Запиши руки, свою эмоцию, позу или целую связку. Точки покажут, что SlayCam видит.</p></div></header>
      <div className="gesture-mode-picker" aria-label="Что записываем">
        {recordingModes.map((value) => {
          const info = modeInfo[value]
          const Icon = info.icon
          return <button key={value} data-active={mode === value} onClick={() => { setMode(value); setRecordError('') }} disabled={phase !== 'idle'}><Icon /><span><strong>{info.title}</strong><small>{info.hint}</small></span></button>
        })}
      </div>
      <div className="gesture-layout">
        <section className="recorder-panel">
          <div className="motion-preview" data-recording={phase === 'recording'}>
            <canvas ref={canvasRef} width={960} height={540} aria-label="Камера с точками рук, лица и тела" />
            <div className="tracking-hud">
              <span className="live-chip"><i /> LIVE</span>
              <span>{mode === 'emotion' ? <ScanFace /> : <ScanLine />} {targetLabel}</span>
              <span>{mode === 'emotion' ? faces.reduce((sum, face) => sum + face.length, 0) : hands.length * 21 + poses.length * 33} точек</span>
            </div>
            {!cameraReady && <div className="preview-shade"><Video /><strong>Включи камеру</strong><small>Видео появится прямо здесь</small></div>}
            {phase === 'countdown' && <div className="record-countdown"><span>{countdown}</span><strong>Приготовься</strong></div>}
            {phase === 'recording' && <div className="record-status"><span className="record-dot" /><strong>{mode === 'motion' ? 'Двигайся' : mode === 'emotion' ? 'Покажи эмоцию' : 'Держи позу'}</strong><em>{Math.round(progress * 100)}%</em></div>}
            {phase === 'saved' && <div className="saved-flash"><Check /><strong>Запомнила!</strong></div>}
            <div className="record-progress"><span style={{ transform: `scaleX(${progress})` }} /></div>
          </div>
          {!cameraReady ? (
            <div className="camera-start-block">
              <button className="button primary" onClick={onStartCamera} disabled={cameraStatus.phase === 'requesting'}>
                {cameraStatus.phase === 'requesting' ? <span className="button-spinner" /> : <Video />}
                {cameraStatus.phase === 'requesting' ? 'Подключаем…' : 'Запустить камеру'}
              </button>
              {['denied', 'missing', 'error'].includes(cameraStatus.phase) && <p className="field-error" role="alert">{cameraStatus.message}</p>}
            </div>
          ) : (
            <div className="recorder-form">
              {phase === 'naming' && pending ? (
                <>
                  <div className="recorder-take">
                    {pending.frames.length
                      ? <TakeReplay frames={pending.frames} intervalMs={pending.intervalMs} />
                      : pending.gesture.preview ? <img src={pending.gesture.preview} alt="" /> : <Check />}
                    <div>
                      <strong>Повтор записи</strong>
                      <small>{pending.gesture.tracking === 'motion' ? `${((pending.gesture.durationMs ?? 0) / 1000).toFixed(1)} сек · ${pending.gesture.samples.length} кадров` : `${pending.gesture.samples.length} образца`}</small>
                      <small>Не то, что хотел — нажми «Записать заново».</small>
                    </div>
                  </div>
                  <label htmlFor="gesture-name">Теперь назови это</label>
                  <input
                    id="gesture-name"
                    autoFocus
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onKeyDown={(event) => { if (event.key === 'Enter') savePending() }}
                    placeholder={mode === 'motion' ? 'Например, драматичный взмах' : mode === 'emotion' ? 'Например, мой шок' : 'Например, сердечко'}
                    maxLength={40}
                  />
                  <div className="recorder-actions">
                    <button className="button primary" onClick={savePending} disabled={!name.trim()}><Check /> Сохранить</button>
                    <button className="button secondary" onClick={cancelRecord}><X /> Записать заново</button>
                  </div>
                  <p className="field-hint">Название можно оставить как есть — оно уже подставлено.</p>
                </>
              ) : (
                <>
                  <div className="recorder-actions">
                    <button className="button primary" onClick={record} disabled={!targetVisible || phase !== 'idle'}>
                      <Plus /> {mode === 'motion' ? 'Записать движение' : mode === 'emotion' ? 'Записать эмоцию' : 'Записать образец'}
                    </button>
                    {(phase === 'countdown' || phase === 'recording') && <button className="button secondary" onClick={cancelRecord}><X /> Отменить</button>}
                  </div>
                  <p className="field-hint">{mode === 'motion' ? 'После отсчёта будет 3 секунды. Начни и закончи движение в спокойной позе. Название спросим после записи.' : mode === 'emotion' ? 'Смотри в камеру и удерживай нужное выражение лица до конца записи. Название спросим после.' : mode === 'hand' ? `Сейчас в кадре: ${hands.length >= 2 ? 'две кисти, запишем общий знак' : 'одна кисть, запишем её знак'}. После отсчёта слегка меняй угол, название спросим после записи.` : 'После отсчёта слегка меняй угол, не выходя из кадра. Название спросим после записи.'}</p>
                  {!targetVisible && <p className="tracking-warning">{mode === 'hand' ? 'Покажи одну или две кисти целиком' : mode === 'emotion' ? 'Расположи лицо целиком в кадре и посмотри в камеру' : 'Отойди так, чтобы камера видела плечи, руки и корпус'}</p>}
                </>
              )}
              {recordError && <p className="field-error" role="alert">{recordError}</p>}
            </div>
          )}
        </section>
        <section className="saved-gestures">
          <div className="section-heading"><div><h2>Записанные</h2><p>Выбирай их в эффектах как обычный триггер.</p></div><span className="rule-count">{gestures.length}</span></div>
          {gestures.length === 0 ? (
            <div className="list-empty"><Activity /><strong>Пока пусто</strong><span>Запиши первый образец слева.</span></div>
          ) : gestures.map((gesture) => {
            const info = modeInfo[gesture.tracking ?? 'hand']
            const Icon = info.icon
            return (
              <article className="gesture-row" key={gesture.id}>
                <span className="gesture-icon">{gesture.preview ? <img src={gesture.preview} alt="" /> : <Icon />}</span>
                <div className="gesture-row-copy"><div className="gesture-title"><strong>{gesture.name}</strong><span>{info.title}</span></div><small>{gesture.tracking === 'motion' ? `${((gesture.durationMs ?? 0) / 1000).toFixed(1)} сек · ${gesture.samples.length} кадров` : `${gesture.samples.length} образца`}</small><label className="gesture-sensitivity">Допуск <input aria-label={`Допуск жеста ${gesture.name}`} type="range" min="0.10" max="0.38" step="0.01" value={gesture.threshold} onChange={(event) => onChange({ ...gesture, threshold: Number(event.target.value) })} /><output>{Math.round(gesture.threshold * 100)}</output></label></div>
                <button className="icon-button danger" aria-label={`Удалить жест ${gesture.name}`} onClick={() => onRemove(gesture)}><Trash2 /></button>
              </article>
            )
          })}
        </section>
      </div>
    </div>
  )
}
