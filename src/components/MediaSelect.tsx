import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import type { MediaAsset } from '../types'
import { MediaPreview } from './MediaPreview'

export function MediaSelect({ media, value, onChange }: {
  media: MediaAsset[]
  value: string
  onChange: (id: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = media.find((asset) => asset.id === value)

  return (
    <div className="media-select">
      <button type="button" className="media-select-current" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="media-select-thumb"><MediaPreview asset={selected} alt="" /></span>
        <span className="media-select-copy">
          <strong>{selected?.name ?? 'Выбери медиафайл'}</strong>
          <small>{selected ? mediaKind(selected) : 'Картинка, GIF или видео'}</small>
        </span>
        <ChevronDown data-open={open} />
      </button>
      {open && (
        <div className="media-select-list" role="listbox" aria-label="Медиафайлы">
          {media.map((asset) => (
            <button
              type="button"
              role="option"
              aria-selected={asset.id === value}
              data-selected={asset.id === value}
              key={asset.id}
              onClick={() => { onChange(asset.id); setOpen(false) }}
            >
              <span className="media-select-option-thumb"><MediaPreview asset={asset} alt="" /></span>
              <span><strong>{asset.name}</strong><small>{mediaKind(asset)}</small></span>
              {asset.id === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function mediaKind(asset: MediaAsset) {
  const format = asset.extension.replace('.', '').toUpperCase()
  if (asset.extension === '.gif') return `Анимированный GIF · ${format}`
  return `${asset.type === 'video' ? 'Видео' : 'Изображение'} · ${format}`
}
