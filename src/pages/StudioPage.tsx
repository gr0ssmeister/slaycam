import { ArrowRight, Hand, ImagePlus, Sparkles } from 'lucide-react'
import type { ActiveEffect, CameraStatus, GestureReading, SlayCamConfig } from '../types'
import { PreviewStage } from '../components/PreviewStage'
import { MediaPreview } from '../components/MediaPreview'

interface StudioPageProps {
  config: SlayCamConfig
  canvasRef: React.RefObject<HTMLCanvasElement>
  status: CameraStatus
  readings: GestureReading[]
  effects: ActiveEffect[]
  fps: number
  onStart: () => void
  onStop: () => void
  onOpenOutput: () => void
  onNavigate: (page: 'rules' | 'gestures' | 'media') => void
}

export function StudioPage(props: StudioPageProps) {
  const readyRules = props.config.rules.filter((rule) => rule.enabled && rule.mediaId).length
  return (
    <div className="page studio-page">
      <header className="page-header studio-header">
        <div>
          <h1>Студия</h1>
          <p>Проверь жесты, движения и эффекты до звонка.</p>
        </div>
        {/* <span className="playful-label">Сияй</span> */}
      </header>
      <div className="studio-grid">
        <PreviewStage
          canvasRef={props.canvasRef}
          status={props.status}
          readings={props.readings}
          activeCount={props.effects.length}
          cameraOn={props.status.phase === "ready"}
          outputOpen={props.config.settings.outputWindowOpen}
          showFps={props.config.settings.showFps}
          fps={props.fps}
          onStart={props.onStart}
          onStop={props.onStop}
          onOpenOutput={props.onOpenOutput}
        />
        <aside className="studio-rail">
          <section className="rail-section">
            <div className="section-heading">
              <div>
                <h2>Готово к сцене</h2>
                <p>
                  {readyRules
                    ? `${readyRules} эффектов включено`
                    : "Пока нет настроенных эффектов"}
                </p>
              </div>
              <span className="rule-count">{readyRules}</span>
            </div>
            {readyRules ? (
              <div className="mini-rule-list">
                {props.config.rules
                  .filter((rule) => rule.enabled && rule.mediaId)
                  .slice(0, 4)
                  .map((rule) => {
                    const media = props.config.media.find(
                      (item) => item.id === rule.mediaId,
                    );
                    return (
                      <button
                        key={rule.id}
                        onClick={() => props.onNavigate("rules")}
                        className="mini-rule"
                      >
                        <span className="mini-thumb">
                          {media ? (
                            <MediaPreview asset={media} alt="" />
                          ) : (
                            <Sparkles />
                          )}
                        </span>
                        <span>
                          <strong>{rule.name}</strong>
                          <small>{media?.name}</small>
                        </span>
                        <ArrowRight aria-hidden="true" />
                      </button>
                    );
                  })}
              </div>
            ) : (
              <div className="rail-empty">
                <span>
                  <Sparkles />
                </span>
                <p>Пока тихо. Добавим мем?</p>
                <button
                  className="text-button"
                  onClick={() => props.onNavigate("rules")}
                >
                  Создать эффект <ArrowRight />
                </button>
              </div>
            )}
          </section>
          <section className="quick-start">
            <h2>Что дальше?</h2>
            <button onClick={() => props.onNavigate("media")}>
              <span>
                <ImagePlus />
              </span>
              <div>
                <strong>Добавить мем</strong>
                <small>Картинка, GIF или видео</small>
              </div>
            </button>
            <button onClick={() => props.onNavigate("gestures")}>
              <span>
                <Hand />
              </span>
              <div>
                <strong>Записать движение</strong>
                <small>Рука, поза или связка</small>
              </div>
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
