import { Check, ChevronDown } from 'lucide-react'
import { useState } from 'react'
import { BUILT_IN_EMOTIONS } from '../types'

export function EmotionSelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const selected = BUILT_IN_EMOTIONS.find((emotion) => emotion.value === value) ?? BUILT_IN_EMOTIONS[0]

  return (
    <div className="gesture-select">
      <button type="button" className="gesture-select-current" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
        <span className="gesture-emoji" aria-hidden="true">{selected.emoji}</span>
        <span className="gesture-select-copy"><strong>{selected.label}</strong><small>{selected.hint}</small></span>
        <ChevronDown data-open={open} />
      </button>
      {open && (
        <div className="gesture-select-list" role="listbox" aria-label="Эмоции и мимика">
          {BUILT_IN_EMOTIONS.map((emotion) => (
            <button type="button" role="option" aria-selected={emotion.value === value} data-selected={emotion.value === value} key={emotion.value} onClick={() => { onChange(emotion.value); setOpen(false) }}>
              <span className="gesture-option-emoji" aria-hidden="true">{emotion.emoji}</span>
              <span><strong>{emotion.label}</strong><small>{emotion.hint}</small></span>
              {emotion.value === value && <Check />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
