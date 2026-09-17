import { Check, ChevronDown, Hand, HeartHandshake, PersonStanding, Smile, Waves } from 'lucide-react'
import { useState } from 'react'
import type { CustomGesture } from '../types'

export function CustomGestureSelect({ gestures, value, onChange }: {
  gestures: CustomGesture[]
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = gestures.find((gesture) => gesture.id === value)

  return (
    <div className="custom-trigger-select">
      <button type="button" className="custom-trigger-current" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="custom-trigger-thumb"><CustomGesturePreview gesture={selected} /></span>
        <span className="custom-trigger-copy"><strong>{selected?.name ?? 'Выбери запись'}</strong><small>{selected ? gestureKind(selected) : 'Руки, эмоция, поза или движение'}</small></span>
        <ChevronDown data-open={open} />
      </button>
      {open && (
        <div className="custom-trigger-list" role="listbox" aria-label="Мои триггеры">
          {gestures.map((gesture) => (
            <button
              type="button"
              role="option"
              aria-selected={gesture.id === value}
              data-selected={gesture.id === value}
              key={gesture.id}
              onClick={() => { onChange(gesture.id); setOpen(false) }}
            >
              <span className="custom-trigger-option-thumb"><CustomGesturePreview gesture={gesture} /></span>
              <span><strong>{gesture.name}</strong><small>{gestureKind(gesture)}</small></span>
              {gesture.id === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function CustomGesturePreview({ gesture }: { gesture?: CustomGesture }) {
  if (gesture?.preview) return <img src={gesture.preview} alt="" />
  if (gesture?.tracking === 'pose') return <PersonStanding aria-hidden="true" />
  if (gesture?.tracking === 'motion') return <Waves aria-hidden="true" />
  if (gesture?.tracking === 'two-hands') return <HeartHandshake aria-hidden="true" />
  if (gesture?.tracking === 'emotion') return <Smile aria-hidden="true" />
  return <Hand aria-hidden="true" />
}

function gestureKind(gesture: CustomGesture) {
  if (gesture.tracking === 'motion') return `Движение · ${(gesture.durationMs ?? 3000) / 1000} сек`
  if (gesture.tracking === 'pose') return 'Поза тела'
  if (gesture.tracking === 'emotion') return 'Своя эмоция'
  return gesture.tracking === 'two-hands' ? 'Жест двумя руками' : 'Жест одной рукой'
}
