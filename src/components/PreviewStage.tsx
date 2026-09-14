import { Camera, CircleStop, Maximize2, MonitorUp, Play, Sparkles } from 'lucide-react'
import type { CameraStatus, GestureReading } from '../types'

interface PreviewStageProps {
  canvasRef: React.RefObject<HTMLCanvasElement>
  status: CameraStatus
  readings: GestureReading[]
  activeCount: number
  cameraOn: boolean
  outputOpen: boolean
  showFps: boolean
  fps: number
  onStart: () => void
  onStop: () => void
  onOpenOutput: () => void
}

const gestureLabels: Record<string, string> = {
  Open_Palm: 'Открытая ладонь',
  Closed_Fist: 'Кулак',
  Pointing_Up: 'Палец вверх',
  Thumb_Up: 'Большой палец вверх',
  Thumb_Down: 'Большой палец вниз',
  Victory: 'Знак победы',
  ILoveYou: 'I love you',
}

export function PreviewStage(props: PreviewStageProps) {
  const detected = props.readings[0]
  return (
    <section className="preview-shell" aria-label="Предпросмотр камеры">
      <div className="preview-toolbar">
        <div className="camera-state" data-state={props.status.phase}>
          <span className="state-dot" />
          <span>{props.status.message}</span>
        </div>
        <button className="icon-button" aria-label="Открыть отдельное окно вывода" onClick={props.onOpenOutput}>
          <Maximize2 aria-hidden="true" />
        </button>
      </div>
      <div className="preview-frame">
        <canvas ref={props.canvasRef} width={1280} height={720} />
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
        {props.activeCount > 0 && <div className="effect-counter">Эффектов в кадре: {props.activeCount}</div>}
        {props.showFps && props.cameraOn && <div className="fps-badge">{props.fps} FPS</div>}
      </div>
      <div className="preview-actions">
        <div className="button-group">
          {props.cameraOn ? (
            <button className="button secondary" onClick={props.onStop}>
              <CircleStop aria-hidden="true" />
              Остановить
            </button>
          ) : (
            <button className="button primary" onClick={props.onStart}>
              <Play aria-hidden="true" />
              Запустить камеру
            </button>
          )}
          <button className="button secondary" onClick={props.onOpenOutput}>
            <MonitorUp aria-hidden="true" />
            {props.outputOpen ? 'Показать вывод' : 'Открыть вывод'}
          </button>
        </div>
        <span className="privacy-note">Предпросмотр камеры</span>
      </div>
    </section>
  )
}
