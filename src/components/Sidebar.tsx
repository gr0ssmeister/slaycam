import { Activity, Aperture, Check, ChevronUp, Image, Layers3, Library, Settings2, Sparkles } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { AppProfile } from '../types'
import { Brand } from './Brand'

export type PageId = 'studio' | 'rules' | 'gestures' | 'media' | 'profiles' | 'settings'

const items = [
  { id: 'studio', label: 'Студия', icon: Aperture },
  { id: 'rules', label: 'Эффекты', icon: Sparkles },
  { id: 'gestures', label: 'Движения', icon: Activity },
  { id: 'media', label: 'Медиатека', icon: Image },
  { id: 'profiles', label: 'Профили', icon: Layers3 },
  { id: 'settings', label: 'Настройки', icon: Settings2 },
] satisfies { id: PageId; label: string; icon: typeof Library }[]

export function Sidebar({ page, profiles, activeProfileId, onChange, onProfileChange }: {
  page: PageId
  profiles: AppProfile[]
  activeProfileId: string
  onChange: (page: PageId) => void
  onProfileChange: (id: string) => void
}) {
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const profileSwitcherRef = useRef<HTMLDivElement>(null)
  const activeProfile = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0]

  useEffect(() => {
    if (!profileMenuOpen) return
    const closeOutside = (event: PointerEvent) => {
      if (!profileSwitcherRef.current?.contains(event.target as Node)) setProfileMenuOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProfileMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOutside)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [profileMenuOpen])

  return (
    <aside className="sidebar">
      <Brand />
      <div className="profile-switcher" ref={profileSwitcherRef}>
        <button type="button" className="profile-switcher-button" aria-haspopup="listbox" aria-expanded={profileMenuOpen} onClick={() => setProfileMenuOpen((open) => !open)} title={`Профиль: ${activeProfile?.name ?? ''}`}>
          <i>{activeProfile?.emoji ?? '✨'}</i>
          <span className="profile-switcher-copy"><small>Профиль</small><strong>{activeProfile?.name ?? 'Без названия'}</strong></span>
          <ChevronUp data-open={profileMenuOpen} />
        </button>
        {profileMenuOpen && <div className="profile-menu" role="listbox" aria-label="Выбрать профиль">
          <div className="profile-menu-heading"><strong>Профили</strong><small>{profiles.length}</small></div>
          {profiles.map((profile) => (
            <button type="button" role="option" aria-selected={profile.id === activeProfileId} key={profile.id} data-active={profile.id === activeProfileId} onClick={() => { onProfileChange(profile.id); setProfileMenuOpen(false) }}>
              <i>{profile.emoji}</i><span><strong>{profile.name}</strong><small>{profile.id === activeProfileId ? 'Сейчас включён' : 'Переключить'}</small></span>{profile.id === activeProfileId && <Check />}
            </button>
          ))}
          <button type="button" className="profile-menu-manage" onClick={() => { onChange('profiles'); setProfileMenuOpen(false) }}><Layers3 /><span><strong>Управление профилями</strong><small>Создать, изменить или удалить</small></span></button>
        </div>}
      </div>
      <nav className="primary-nav" aria-label="Разделы SlayCam">
        {items.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className="nav-item"
            data-active={page === id}
            onClick={() => onChange(id)}
            aria-label={label}
            aria-current={page === id ? "page" : undefined}
          >
            <Icon aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="sidebar-tip">
        <span className="tip-star" aria-hidden="true">
          ✦
        </span>
        <p>SlayCam для слейных</p>
      </div>
      <a
        href="https://t.me/sovsemdebil"
        className="sidebar-signature"
        target="_blank"
        rel="noopener noreferrer"
      >
        by grossmeister
      </a>
    </aside>
  );
}
