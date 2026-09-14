import { Check, Sparkles } from 'lucide-react'
import type { EffectAnimation, MediaAsset } from '../types'
import { MediaPreview } from './MediaPreview'

export const ANIMATION_OPTIONS: { value: EffectAnimation; label: string }[] = [
  { value: 'pop', label: 'Мягкий хлопок' },
  { value: 'fade', label: 'Проявление' },
  { value: 'slide-up', label: 'Вылет снизу' },
  { value: 'spin', label: 'Поворот' },
  { value: 'none', label: 'Без анимации' },
]

export function AnimationPicker({ value, onChange, asset }: {
  value: EffectAnimation
  onChange: (value: EffectAnimation) => void
  asset?: MediaAsset
}) {
  return (
    <div className="animation-picker" role="radiogroup" aria-label="Анимация появления">
      {ANIMATION_OPTIONS.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={option.value === value}
          data-selected={option.value === value}
          key={option.value}
          onClick={() => onChange(option.value)}
        >
          <span className={`animation-sample sample-${option.value}`}>
            <i className="animation-preview-object">
              {asset?.type === 'image' ? <MediaPreview asset={asset} alt="" /> : <Sparkles />}
            </i>
          </span>
          <strong>{option.label}</strong>
          {option.value === value && <Check className="animation-check" />}
        </button>
      ))}
    </div>
  )
}
