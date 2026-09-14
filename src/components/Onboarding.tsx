import { Camera, ChevronRight, Hand, ImagePlus, Sparkles, X } from 'lucide-react'
import { Brand } from './Brand'

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="onboarding-backdrop" role="presentation">
      <section className="onboarding" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <button className="onboarding-close" onClick={onFinish} aria-label="Закрыть знакомство">
          <X aria-hidden="true" />
        </button>
        <Brand />
        <div className="welcome-art" aria-hidden="true">
          <span className="blob blob-one"><Hand /></span>
          <span className="blob blob-two"><Sparkles /></span>
          <span className="blob blob-three"><Camera /></span>
        </div>
        <h1 id="welcome-title">Включай камеру. Slay.</h1>
        <p className="welcome-copy">Мемы появляются по жесту, позе или движению. Всё настраивается прямо здесь.</p>
        <ol className="welcome-steps">
          <li><span><Camera /></span><div><strong>Подключи камеру</strong><small>SlayCam попросит обычное разрешение Windows.</small></div></li>
          <li><span><ImagePlus /></span><div><strong>Добавь мем</strong><small>Подойдут PNG, JPG, GIF, WebP, WebM и MP4.</small></div></li>
          <li><span><Hand /></span><div><strong>Запиши свой триггер</strong><small>Рука, поза или связка движений.</small></div></li>
        </ol>
        <button className="button primary welcome-button" onClick={onFinish} autoFocus>
          Сиять
          <ChevronRight aria-hidden="true" />
        </button>
      </section>
    </div>
  )
}
