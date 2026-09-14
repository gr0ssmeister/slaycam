import { Camera, ChevronRight, Hand, ImagePlus, Sparkles, X } from 'lucide-react'
import { Brand } from './Brand'

export function Onboarding({ onFinish }: { onFinish: () => void }) {
  return (
    <div className="onboarding-backdrop" role="presentation">
      <section
        className="onboarding"
        role="dialog"
        aria-modal="true"
        aria-labelledby="welcome-title"
      >
        <button
          className="onboarding-close"
          onClick={onFinish}
          aria-label="Закрыть знакомство"
        >
          <X aria-hidden="true" />
        </button>
        <Brand />
        <div className="welcome-art" aria-hidden="true">
          <span className="blob blob-one">
            <Hand />
          </span>
          <span className="blob blob-two">
            <Sparkles />
          </span>
          <span className="blob blob-three">
            <Camera />
          </span>
        </div>
        <h1 id="welcome-title">SlayCam</h1>
        <p className="welcome-copy">
          Добавляй видео и картинки, а затем запускай эффекты по жестам и
          движениям.
        </p>
        <ol className="welcome-steps">
          <li>
            <span>
              <Camera />
            </span>
            <div>
              <strong>Включи камеру</strong>
              <small>SlayCam попросит доступ к видео.</small>
            </div>
          </li>
          <li>
            <span>
              <ImagePlus />
            </span>
            <div>
              <strong>Добавь медиа</strong>
              <small>Подходят фото, GIF и видеофайлы.</small>
            </div>
          </li>
          <li>
            <span>
              <Hand />
            </span>
            <div>
              <strong>Задай жест</strong>
              <small>Выбери движение, которое будет запускать эффект.</small>
            </div>
          </li>
        </ol>
        <button
          className="button primary welcome-button"
          onClick={onFinish}
          autoFocus
        >
          Сиять ✨
          <ChevronRight aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
