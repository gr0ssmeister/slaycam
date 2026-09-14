import { Camera, CircleStop, Play, Sparkles } from 'lucide-react'
import type { ActiveEffect, CameraStatus, GestureReading, MediaAsset } from '../types'
import { LiveEffects } from './LiveEffects'

interface PreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  status: CameraStatus
  readings: GestureReading[]
  effects: ActiveEffect[]
  media: MediaAsset[]
  frameWidth: number
  frameHeight: number
  mirrorCamera: boolean
  cameraOn: boolean
  showFps: boolean
  fps: number
  onStart: () => void
  onStop: () => void
}

const gestureLabels: Record<string, string> = {
  Open_Palm: 'Открытая ладонь',
  Closed_Fist: 'Кулак',
  Pointing_Up: 'Палец вверх',
  Thumb_Up: 'Большой палец вверх',
  Thumb_Down: 'Большой палец вниз',
  Victory: 'Знак победы',
  'emotion:smile': 'Улыбка',
  'emotion:mouth-open': 'Удивление',
  'emotion:eyes-closed': 'Закрытые глаза',
  'emotion:wink-left': 'Подмигивание слева',
  'emotion:wink-right': 'Подмигивание справа',
  'emotion:brows-up': 'Брови вверх',
  'emotion:cheek-puff': 'Надутые щёки',
}

export function PreviewStage(props: PreviewStageProps) {
  const detected = props.readings[0]
  return (
    <section className="preview-shell" aria-label="Камера и эффекты">
      <div className="preview-toolbar">
        <div className="camera-state" data-state={props.status.phase}>
          <span className="state-dot" />
          <span>{props.status.message}</span>
        </div>
      </div>
      <div className="preview-frame">
        <canvas ref={props.canvasRef} width={1280} height={720} />
        <LiveEffects
          effects={props.effects}
          media={props.media}
          frameWidth={props.frameWidth}
          frameHeight={props.frameHeight}
          mirrorCamera={props.mirrorCamera}
        />
        {!props.cameraOn && (
          <div className="camera-empty">
            <span className="empty-orbit" aria-hidden="true"><Camera /></span>
            <h2>Камера пока отдыхает</h2>
            <button className="button primary" onClick={props.onStart}>
              <Play aria-hidden="true" />
              Запустить камеру
            </button>
          </div>
        )}
        {detected && (
          <div className="gesture-toast" aria-live="polite">
            <Sparkles aria-hidden="true" />
            <span>{gestureLabels[detected.name] ?? (detected.name.startsWith('custom:') ? 'Свой триггер' : detected.name)}</span>
            <strong>{Math.round(detected.score * 100)}%</strong>
          </div>
        )}
        {props.effects.length > 0 && <div className="effect-counter">Эффектов в кадре: {props.effects.length}</div>}
        {props.showFps && props.cameraOn && <div className="fps-badge">{props.fps} FPS</div>}
      </div>
      <div className="preview-actions" data-camera-on={props.cameraOn}>
        {props.cameraOn && (
          <button className="button secondary camera-stop-button" onClick={props.onStop}>
            <CircleStop aria-hidden="true" />
            Остановить камеру
          </button>
        )}
      </div>
    </section>
  )
}
