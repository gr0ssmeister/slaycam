import { ImagePlus, Layers3, ScanLine, Sparkles } from 'lucide-react'
import { MediaSelect } from './MediaSelect'
import type { BackgroundSettings, MediaAsset } from '../types'

const MODES: { value: BackgroundSettings['mode']; label: string; icon: string }[] = [
  { value: 'none', label: 'Обычный', icon: '◯' },
  { value: 'blur', label: 'Размытие', icon: '◌' },
  { value: 'remove', label: 'Цвет', icon: '●' },
  { value: 'media', label: 'Фото / видео', icon: '▣' },
]

export function BackgroundPanel({ value, media, onChange, onImport }: {
  value: BackgroundSettings
  media: MediaAsset[]
  onChange: (value: BackgroundSettings) => void
  onImport: () => void
}) {
  const visualMedia = media.filter((asset) => asset.type !== 'audio')
  const patch = <K extends keyof BackgroundSettings>(key: K, next: BackgroundSettings[K]) => onChange({ ...value, [key]: next })
  return (
    <section className="background-panel">
      <div className="section-heading">
        <div><h2>Фон</h2><p>Сохраняется в текущем профиле</p></div>
        <span className="background-mark"><Layers3 /></span>
      </div>
      <div className="background-modes" aria-label="Режим фона">
        {MODES.map((mode) => <button type="button" key={mode.value} data-active={value.mode === mode.value} onClick={() => patch('mode', mode.value)}><i>{mode.icon}</i>{mode.label}</button>)}
      </div>
      {value.mode === 'blur' && (
        <label className="range-field compact-range"><span><strong>Сила размытия</strong><output>{value.blur}px</output></span><input type="range" min="4" max="36" step="1" value={value.blur} onChange={(event) => patch('blur', Number(event.target.value))} /></label>
      )}
      {value.mode === 'remove' && (
        <label className="background-color-field"><span><ScanLine />Цвет за тобой</span><input type="color" value={value.color} onChange={(event) => patch('color', event.target.value)} /></label>
      )}
      {value.mode === 'media' && (
        <div className="background-media-field">
          {visualMedia.length ? <MediaSelect media={visualMedia} value={value.mediaId} onChange={(mediaId) => patch('mediaId', mediaId)} /> : <div className="background-empty"><Sparkles /><span>Добавь картинку или видео</span></div>}
          <button type="button" className="button secondary" onClick={onImport}><ImagePlus />Добавить фон</button>
        </div>
      )}
    </section>
  )
}
