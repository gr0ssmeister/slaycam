import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { BUILT_IN_GESTURES } from '../types'

export function GestureSelect({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  const [open, setOpen] = useState(false)
  const selected = BUILT_IN_GESTURES.find((gesture) => gesture.value === value) ?? BUILT_IN_GESTURES[0]

  return (
    <div className="gesture-select">
      <button type="button" className="gesture-select-current" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="gesture-emoji" aria-hidden="true">{selected.emoji}</span>
        <span className="gesture-select-copy"><strong>{selected.label}</strong><small>{selected.hint}</small></span>
        <ChevronDown data-open={open} />
      </button>
      {open && (
        <div className="gesture-select-list" role="listbox" aria-label="Готовые жесты">
          {BUILT_IN_GESTURES.map((gesture) => (
            <button
              type="button"
              role="option"
              aria-selected={gesture.value === value}
              data-selected={gesture.value === value}
              key={gesture.value}
              onClick={() => { onChange(gesture.value); setOpen(false) }}
            >
              <span className="gesture-option-emoji" aria-hidden="true">{gesture.emoji}</span>
              <span><strong>{gesture.label}</strong><small>{gesture.hint}</small></span>
              {gesture.value === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
