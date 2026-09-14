import { Activity, Aperture, Image, Library, Settings2, Sparkles } from 'lucide-react'
import { Brand } from './Brand'

export type PageId = 'studio' | 'rules' | 'gestures' | 'media' | 'settings'

const items = [
  { id: 'studio', label: 'Студия', icon: Aperture },
  { id: 'rules', label: 'Эффекты', icon: Sparkles },
  { id: 'gestures', label: 'Движения', icon: Activity },
  { id: 'media', label: 'Медиатека', icon: Image },
  { id: 'settings', label: 'Настройки', icon: Settings2 },
] satisfies { id: PageId; label: string; icon: typeof Library }[]

export function Sidebar({ page, onChange }: { page: PageId; onChange: (page: PageId) => void }) {
  return (
    <aside className="sidebar">
      <Brand />
      <nav className="primary-nav" aria-label="Разделы SlayCam">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="nav-item"
            data-active={page === id}
            onClick={() => onChange(id)}
            aria-label={label}
            aria-current={page === id ? 'page' : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-tip">
        <span className="tip-star" aria-hidden="true">✦</span>
        <p>SlayCam для слейных</p>
      </div>
      <div className="sidebar-signature">by grossmeister</div>
    </aside>
  )
}
