import { Check, Copy, PencilLine, Plus, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { AppProfile, EffectRule } from '../types'

const EMOJIS = ['🎮', '💬', '🎬', '🌸', '✨', '😈', '🎉', '🫶']
const PROFILE_SUGGESTIONS = ['Discord', 'Созвон', 'Стрим', 'Игровой вечер']

export function ProfilesPage({ profiles, activeId, rules, onSelect, onCreate, onChange, onDuplicate, onDelete }: {
  profiles: AppProfile[]
  activeId: string
  rules: EffectRule[]
  onSelect: (id: string) => void
  onCreate: (name: string, emoji: string) => void
  onChange: (profile: AppProfile) => void
  onDuplicate: (profile: AppProfile) => void
  onDelete: (profile: AppProfile) => void
}) {
  const active = profiles.find((profile) => profile.id === activeId) ?? profiles[0]
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('✨')
  const [draftName, setDraftName] = useState(active?.name ?? '')
  const [draftEmoji, setDraftEmoji] = useState(active?.emoji ?? '✨')
  const activeRuleCount = rules.filter((rule) => rule.profileId === active?.id).length
  const backgroundLabel = active?.background.mode === 'blur' ? 'Размытие' : active?.background.mode === 'remove' ? 'Цвет' : active?.background.mode === 'media' ? 'Фото / видео' : 'Обычный'

  useEffect(() => {
    setDraftName(active?.name ?? '')
    setDraftEmoji(active?.emoji ?? '✨')
  }, [active?.id, active?.name, active?.emoji])

  const saveActive = () => {
    if (!active || !draftName.trim()) return
    onChange({ ...active, name: draftName.trim(), emoji: draftEmoji })
  }

  const create = () => {
    if (!name.trim()) return
    onCreate(name.trim(), emoji)
    setName('')
    setEmoji('✨')
    setCreating(false)
  }

  const renderProfileButtons = () => profiles.map((profile) => {
    const count = rules.filter((rule) => rule.profileId === profile.id).length
    return <button type="button" key={profile.id} data-active={!creating && profile.id === activeId} onClick={() => { setCreating(false); onSelect(profile.id) }}><span>{profile.emoji}</span><span><strong>{profile.name}</strong><small>{count ? `${count} эффектов` : 'Пока без эффектов'}</small></span>{!creating && profile.id === activeId && <Check />}</button>
  })

  return (
    <div className="page profiles-page">
      <header className="page-header"><div><h1>Профили</h1><p>Отдельные эффекты и фон для каждого случая.</p></div><button className="button primary" onClick={() => setCreating(true)} disabled={creating}><Plus />Создать профиль</button></header>
      {creating ? (
        <div className="profiles-create-flow">
          <section className="profile-creator" aria-label="Создание профиля">
            <div className="profile-creator-top">
              <div className="profile-creator-preview"><span>{emoji}</span><div><small>Новый профиль</small><strong>{name.trim() || 'Без названия'}</strong></div></div>
              <button type="button" className="icon-button" aria-label="Закрыть создание профиля" onClick={() => setCreating(false)}><X /></button>
            </div>
            <div className="profile-creator-body">
              <label className="profile-name-field"><span>Название профиля</span><span className="profile-name-control"><PencilLine /><input autoFocus value={name} maxLength={28} placeholder="Например, Игровой вечер" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') create() }} /><output>{name.length}/28</output></span></label>
              <div className="profile-suggestions" aria-label="Быстрые названия">
                {PROFILE_SUGGESTIONS.map((suggestion) => <button type="button" key={suggestion} onClick={() => setName(suggestion)}>{suggestion}</button>)}
              </div>
              <div className="profile-symbol-field"><span>Значок</span><div className="profile-emoji-picker creator-emojis">{EMOJIS.map((item) => <button type="button" key={item} data-active={emoji === item} aria-label={`Значок ${item}`} onClick={() => setEmoji(item)}>{item}</button>)}</div></div>
              <div className="profile-creator-note"><Sparkles /><span>Новый профиль начнётся без эффектов. Медиатека и записанные движения останутся общими.</span></div>
            </div>
            <div className="profile-creator-actions"><button type="button" className="button ghost" onClick={() => setCreating(false)}>Отменить</button><button type="button" className="button primary" onClick={create} disabled={!name.trim()}><Plus />Создать профиль</button></div>
          </section>
          <section className="created-profiles" aria-label="Созданные профили">
            <div className="created-profiles-heading"><div><h2>Созданные профили</h2><p>Нажми профиль, чтобы закрыть черновик и открыть его.</p></div><span>{profiles.length}</span></div>
            <div className="created-profile-grid">{renderProfileButtons()}</div>
          </section>
        </div>
      ) : (
        <div className="profiles-layout">
          <section className="profile-list" aria-label="Профили">{renderProfileButtons()}</section>
          {active && (
          <section className="profile-editor">
            <div className="profile-editor-hero">
              <div className="profile-editor-preview"><span>{draftEmoji}</span><div><small>Сейчас включён</small><strong>{draftName || active.name}</strong></div></div>
              <div className="profile-editor-stats"><span><strong>{activeRuleCount}</strong><small>{activeRuleCount === 1 ? 'эффект' : 'эффектов'}</small></span><span><strong>{backgroundLabel}</strong><small>фон</small></span></div>
            </div>
            <div className="profile-editor-body">
              <label className="profile-name-field"><span>Название профиля</span><span className="profile-name-control"><PencilLine /><input value={draftName} maxLength={28} onChange={(event) => setDraftName(event.target.value)} /><output>{draftName.length}/28</output></span></label>
              <div className="profile-symbol-field"><span>Значок</span><div className="profile-emoji-picker creator-emojis">{EMOJIS.map((item) => <button type="button" key={item} data-active={draftEmoji === item} aria-label={`Значок ${item}`} onClick={() => setDraftEmoji(item)}>{item}</button>)}</div></div>
              <p className="profile-delete-hint">При удалении профиля удаляются только его эффекты. Медиафайлы и записанные движения остаются.</p>
            </div>
            <div className="profile-editor-actions"><div><button type="button" className="button ghost" onClick={() => onDuplicate(active)}><Copy />Создать копию</button><button type="button" className="button danger-button" onClick={() => onDelete(active)} disabled={profiles.length === 1}><Trash2 />Удалить</button></div><button type="button" className="button primary" onClick={saveActive} disabled={!draftName.trim()}><Check />Сохранить изменения</button></div>
          </section>
          )}
        </div>
      )}
    </div>
  )
}
