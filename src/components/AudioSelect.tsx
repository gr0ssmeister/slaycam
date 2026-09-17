import { Check, ChevronDown, Music2, Play, Volume2 } from 'lucide-react'
import { useRef, useState } from 'react'
import type { MediaAsset } from '../types'

export function AudioSelect({ audio, value, onChange, onImport }: {
  audio: MediaAsset[]
  value: string
  onChange: (id: string) => void
  onImport: () => void
}) {
  const [open, setOpen] = useState(false)
  const previewRef = useRef<HTMLAudioElement>(null)
  const selected = audio.find((asset) => asset.id === value)

  const preview = () => {
    const player = previewRef.current
    if (!player) return
    player.currentTime = 0
    void player.play().catch(() => undefined)
  }

  return (
    <div className="audio-select">
      <audio ref={previewRef} src={selected?.src} preload="metadata" />
      <div className="audio-select-current">
        <button type="button" className="audio-select-main" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          <span className="audio-file-icon"><Music2 /></span>
          <span><strong>{selected?.name ?? 'Звук не выбран'}</strong><small>{selected ? `${selected.extension.replace('.', '').toUpperCase()} · можно прослушать` : 'MP3 или WAV'}</small></span>
          <ChevronDown data-open={open} />
        </button>
        {selected && <button type="button" className="icon-button audio-play" onClick={preview} aria-label={`Прослушать ${selected.name}`}><Play /></button>}
      </div>
      {open && (
        <div className="audio-select-list" role="listbox" aria-label="Звуковые файлы">
          {audio.map((asset) => (
            <button type="button" role="option" aria-selected={asset.id === value} data-selected={asset.id === value} key={asset.id} onClick={() => { onChange(asset.id); setOpen(false) }}>
              <span className="audio-file-icon"><Volume2 /></span>
              <span><strong>{asset.name}</strong><small>{asset.extension.replace('.', '').toUpperCase()}</small></span>
              {asset.id === value && <Check />}
            </button>
          ))}
          <button type="button" className="audio-import-row" onClick={() => { setOpen(false); onImport() }}><Music2 /><span><strong>Добавить звук</strong><small>MP3 или WAV</small></span></button>
        </div>
      )}
      {!audio.length && <button type="button" className="button secondary audio-empty-button" onClick={onImport}><Music2 />Добавить MP3 или WAV</button>}
    </div>
  )
}
