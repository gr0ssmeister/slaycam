import { ArrowRight, Check, ChevronDown, Copy, Eye, ImagePlus, Plus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { createRule } from '../config'
import { MediaPreview } from '../components/MediaPreview'
import { MediaSelect } from '../components/MediaSelect'
import { GestureSelect } from '../components/GestureSelect'
import { CustomGesturePreview, CustomGestureSelect } from '../components/CustomGestureSelect'
import { ANIMATION_OPTIONS, AnimationPicker } from '../components/AnimationPicker'
import { findDuplicateRule } from '../lib/rules'
import type { EffectRule, MediaAsset, CustomGesture, TriggerType } from '../types'
import { ANCHORS, BUILT_IN_GESTURES } from '../types'

export function RulesPage({
  rules,
  media,
  gestures,
  selectedId,
  onSelect,
  onCreate,
  onImport,
  onRecordGesture,
  onChange,
  onDuplicate,
  onDelete,
  onTest,
}: {
  rules: EffectRule[]
  media: MediaAsset[]
  gestures: CustomGesture[]
  selectedId: string
  onSelect: (id: string) => void
  onCreate: (rule: EffectRule) => void
  onImport: () => void
  onRecordGesture: () => void
  onChange: (rule: EffectRule) => void
  onDuplicate: (rule: EffectRule) => void
  onDelete: (rule: EffectRule) => void
  onTest: (rule: EffectRule) => void
}) {
  const [creating, setCreating] = useState(false)
  const selected = rules.find((rule) => rule.id === selectedId) ?? rules[0]

  useEffect(() => {
    if (media.length && rules.length === 0) setCreating(true)
  }, [media.length, rules.length])

  const selectRule = (id: string) => {
    setCreating(false)
    onSelect(id)
  }

  const createEffect = (rule: EffectRule) => {
    onCreate(rule)
    setCreating(false)
  }

  return (
    <div className="page rules-page">
      <header className="page-header">
        <div><h1>Эффекты</h1><p>Собери связку: действие в кадре, мем и его поведение.</p></div>
        {creating ? <span className="draft-state"><i />Черновик не сохранён</span> : <button className="button primary" onClick={() => setCreating(true)}><Plus />Создать эффект</button>}
      </header>
      {!media.length && !creating ? (
        <section className="full-empty compact-empty">
          <span className="empty-spark"><Sparkles /></span>
          <h2>Сначала добавим мем</h2>
          <p>Картинка, GIF или видео появятся в списке, затем выберешь для них триггер.</p>
          <div className="empty-actions"><button className="button primary" onClick={onImport}><ImagePlus />Добавить мем</button><button className="button secondary" onClick={() => setCreating(true)}><Plus />Открыть черновик</button></div>
        </section>
      ) : (
        <div className="rule-workspace">
          <aside className="rule-list" aria-label="Список эффектов">
            {creating && <div className="rule-draft-item"><span><Sparkles /></span><div><strong>Черновик</strong><small>Заполни три шага справа</small></div></div>}
            {rules.map((rule) => {
              const asset = media.find((item) => item.id === rule.mediaId)
              const trigger = getRuleTriggerLabel(rule, gestures)
              return (
                <button key={rule.id} className="rule-list-item" data-active={!creating && rule.id === selected?.id} onClick={() => selectRule(rule.id)}>
                  <span className="rule-media-thumb">
                    {asset ? <MediaPreview asset={asset} alt="" /> : <Sparkles />}
                  </span>
                  <span className="rule-list-copy"><strong>{rule.name}</strong><small>{trigger} · {asset?.name ?? 'мем не выбран'}</small></span>
                  <span className="toggle-mini" data-on={rule.enabled} aria-label={rule.enabled ? 'Включён' : 'Выключен'} />
                </button>
              )
            })}
            <button className="rule-add" onClick={() => setCreating(true)} disabled={creating}><Plus />Добавить эффект</button>
          </aside>
          {creating ? (
            <EffectComposer
              media={media}
              gestures={gestures}
              rules={rules}
              onImport={onImport}
              onRecordGesture={onRecordGesture}
              onCreate={createEffect}
              onCancel={() => setCreating(false)}
              onOpenExisting={selectRule}
            />
          ) : selected ? (
            <RuleEditor
              rule={selected}
              media={media}
              gestures={gestures}
              onChange={onChange}
              onDuplicate={() => onDuplicate(selected)}
              onDelete={() => onDelete(selected)}
              onTest={() => onTest(selected)}
            />
          ) : (
            <section className="rule-editor-placeholder"><Sparkles /><h2>Создай первый эффект</h2><p>Черновик не попадёт в список, пока ты его не подтвердишь.</p><button className="button primary" onClick={() => setCreating(true)}><Plus />Начать создание</button></section>
          )}
        </div>
      )}
    </div>
  )
}

function EffectComposer({ media, gestures, rules, onImport, onRecordGesture, onCreate, onCancel, onOpenExisting }: {
  media: MediaAsset[]
  gestures: CustomGesture[]
  rules: EffectRule[]
  onImport: () => void
  onRecordGesture: () => void
  onCreate: (rule: EffectRule) => void
  onCancel: () => void
  onOpenExisting: (id: string) => void
}) {
  const [triggerType, setTriggerType] = useState<TriggerType>('built-in')
  const [gesture, setGesture] = useState('Thumb_Up')
  const [customGestureId, setCustomGestureId] = useState(gestures[0]?.id ?? '')
  const [mediaId, setMediaId] = useState(media[0]?.id ?? '')
  const [anchor, setAnchor] = useState<EffectRule['anchor']>('gesture-hand')
  const [durationMs, setDurationMs] = useState(2200)
  const [animation, setAnimation] = useState<EffectRule['animation']>('pop')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const selectedMedia = media.find((item) => item.id === mediaId)
  const selectedBuiltInGesture = BUILT_IN_GESTURES.find((item) => item.value === gesture)
  const triggerLabel = triggerType === 'built-in'
    ? selectedBuiltInGesture ? `${selectedBuiltInGesture.emoji} ${selectedBuiltInGesture.label}` : 'Готовый жест'
    : getCustomGestureLabel(gestures.find((item) => item.id === customGestureId))
  const triggerName = triggerType === 'built-in' ? selectedBuiltInGesture?.label ?? 'Готовый жест' : triggerLabel
  const suggestedName = selectedMedia ? `${selectedMedia.name.replace(/\.[^.]+$/, '')} · ${triggerName}` : ''

  useEffect(() => {
    if (!mediaId && media[0]) setMediaId(media[0].id)
  }, [media, mediaId])

  useEffect(() => {
    if (!customGestureId && gestures[0]) setCustomGestureId(gestures[0].id)
  }, [customGestureId, gestures])

  useEffect(() => {
    if (!nameTouched) setName(suggestedName)
  }, [nameTouched, suggestedName])

  const duplicate = useMemo(() => findDuplicateRule(rules, { mediaId, triggerType, gesture, customGestureId }), [customGestureId, gesture, mediaId, rules, triggerType])

  const canCreate = Boolean(name.trim() && mediaId && (triggerType === 'built-in' ? gesture : customGestureId))
  const submit = () => {
    if (!canCreate || duplicate) return
    const rule = createRule(mediaId)
    rule.name = name.trim()
    rule.triggerType = triggerType
    rule.gesture = gesture
    rule.customGestureId = triggerType === 'custom' ? customGestureId : undefined
    rule.anchor = anchor
    rule.durationMs = durationMs
    rule.animation = animation
    onCreate(rule)
  }

  return (
    <section className="effect-composer" aria-label="Создание эффекта">
      <div className="composer-topbar"><div><span className="composer-icon"><Sparkles /></span><div><h2>Новый эффект</h2><p>Сохраним только после проверки.</p></div></div><button className="icon-button" onClick={onCancel} aria-label="Закрыть черновик"><X /></button></div>
      <div className="composer-steps" aria-label="Шаги создания"><span data-done="true"><i>1</i>Триггер</span><span data-done={Boolean(mediaId)}><i>2</i>Мем</span><span data-done={Boolean(name.trim())}><i>3</i>Готово</span></div>
      <div className="composer-layout">
        <div className="composer-fields">
          <fieldset className="composer-section">
            <legend><span>1</span><div><strong>Что запускает эффект</strong><small>Готовый жест или твоя запись</small></div></legend>
            <div className="segmented-control" aria-label="Тип триггера">
              <button type="button" data-active={triggerType === 'built-in'} onClick={() => setTriggerType('built-in')}>Готовый жест</button>
              <button type="button" data-active={triggerType === 'custom'} onClick={() => setTriggerType('custom')}>Мой триггер</button>
            </div>
            {triggerType === 'built-in' ? (
              <div className="field"><span>Выбери жест</span><GestureSelect value={gesture} onChange={setGesture} /></div>
            ) : gestures.length ? (
              <div className="field"><span>Выбери запись</span><CustomGestureSelect gestures={gestures} value={customGestureId} onChange={setCustomGestureId} /></div>
            ) : (
              <div className="composer-missing"><span>Нет записанных движений</span><button className="button secondary" type="button" onClick={onRecordGesture}>Записать триггер</button></div>
            )}
          </fieldset>

          <fieldset className="composer-section">
            <legend><span>2</span><div><strong>Какой мем показать</strong><small>Выбери файл из медиатеки</small></div></legend>
            {media.length ? (
              <div className="composer-media-grid" role="radiogroup" aria-label="Выбор медиа">
                {media.map((asset) => <button type="button" role="radio" aria-checked={asset.id === mediaId} data-selected={asset.id === mediaId} key={asset.id} onClick={() => setMediaId(asset.id)}><span><MediaPreview asset={asset} alt="" />{asset.id === mediaId && <i><Check /></i>}</span><strong>{asset.name}</strong><small>{getMediaKind(asset)}</small></button>)}
                <button type="button" className="composer-import-tile" onClick={onImport}><ImagePlus /><strong>Добавить мем</strong></button>
              </div>
            ) : (
              <div className="composer-missing"><span>В медиатеке пока пусто</span><button className="button secondary" type="button" onClick={onImport}><ImagePlus />Добавить мем</button></div>
            )}
          </fieldset>

          <fieldset className="composer-section composer-finish">
            <legend><span>3</span><div><strong>Как он появится</strong><small>Остальные параметры можно изменить потом</small></div></legend>
            <label className="field"><span>Название эффекта</span><input type="text" value={name} maxLength={60} placeholder="Например, Финальный slay" onChange={(event) => { setNameTouched(true); setName(event.target.value) }} /></label>
            <div className="two-fields">
              <label className="field"><span>Положение</span><select value={anchor} onChange={(event) => setAnchor(event.target.value as EffectRule['anchor'])}>{ANCHORS.map((item) => <option value={item.value} key={item.value}>{item.icon} {item.label}</option>)}</select><small>{ANCHORS.find((item) => item.value === anchor)?.hint}</small></label>
              <label className="field"><span>На сколько</span><select value={durationMs} onChange={(event) => setDurationMs(Number(event.target.value))}><option value={1500}>1,5 секунды</option><option value={2200}>2,2 секунды</option><option value={4000}>4 секунды</option><option value={8000}>8 секунд</option></select></label>
            </div>
            <div className="field animation-field"><span>Анимация появления</span><AnimationPicker value={animation} onChange={setAnimation} asset={selectedMedia} /></div>
          </fieldset>
        </div>

        <aside className="composer-summary">
          <h3>Получится так</h3>
          <div className="composer-equation"><span className="composer-trigger-preview">{triggerType === 'built-in' ? selectedBuiltInGesture?.emoji ?? <Sparkles /> : <CustomGesturePreview gesture={gestures.find((item) => item.id === customGestureId)} />}</span><strong>{triggerLabel}</strong><ArrowRight /><span className="composer-summary-media">{selectedMedia ? <MediaPreview asset={selectedMedia} alt="" /> : <ImagePlus />}</span><strong>{selectedMedia?.name ?? 'Выбери мем'}</strong></div>
          <dl><div><dt>Положение</dt><dd>{ANCHORS.find((item) => item.value === anchor)?.icon} {ANCHORS.find((item) => item.value === anchor)?.label}</dd></div><div><dt>Появление</dt><dd>{ANIMATION_OPTIONS.find((item) => item.value === animation)?.label}</dd></div><div><dt>Длительность</dt><dd>{(durationMs / 1000).toLocaleString('ru-RU')} сек</dd></div></dl>
          {duplicate && <div className="duplicate-notice"><strong>Такая связка уже есть</strong><span>{duplicate.name}</span></div>}
          {duplicate ? <button className="button primary" onClick={() => onOpenExisting(duplicate.id)}>Открыть этот эффект</button> : <button className="button primary" onClick={submit} disabled={!canCreate}><Check />Создать эффект</button>}
          <button className="button ghost" onClick={onCancel}>Отменить создание</button>
        </aside>
      </div>
    </section>
  )
}

function getCustomGestureLabel(gesture?: CustomGesture) {
  if (!gesture) return 'Мой триггер'
  const kind = gesture.tracking === 'motion' ? 'Движение' : gesture.tracking === 'pose' ? 'Поза' : 'Рука'
  return `${kind} · ${gesture.name}`
}

function getMediaKind(asset: MediaAsset) {
  if (asset.extension === '.gif') return 'Живой GIF'
  return asset.type === 'video' ? 'Видео' : asset.extension.replace('.', '').toUpperCase()
}

function getRuleTriggerLabel(rule: EffectRule, gestures: CustomGesture[]) {
  if (rule.triggerType === 'custom') return getCustomGestureLabel(gestures.find((item) => item.id === rule.customGestureId))
  const gesture = BUILT_IN_GESTURES.find((item) => item.value === rule.gesture)
  return gesture ? `${gesture.emoji} ${gesture.label}` : rule.gesture
}

function RuleEditor({ rule, media, gestures, onChange, onDuplicate, onDelete, onTest }: {
  rule: EffectRule
  media: MediaAsset[]
  gestures: CustomGesture[]
  onChange: (rule: EffectRule) => void
  onDuplicate: () => void
  onDelete: () => void
  onTest: () => void
}) {
  const patch = <K extends keyof EffectRule>(key: K, value: EffectRule[K]) => onChange({ ...rule, [key]: value })
  const selectCustomTrigger = () => onChange({ ...rule, triggerType: 'custom', customGestureId: rule.customGestureId ?? gestures[0]?.id })
  return (
    <section className="rule-editor">
      <div className="editor-topbar">
        <div className="name-field">
          <label htmlFor="effect-name">Название эффекта</label>
          <input id="effect-name" value={rule.name} onChange={(event) => patch('name', event.target.value)} maxLength={60} />
        </div>
        <label className="switch-field">
          <input type="checkbox" checked={rule.enabled} onChange={(event) => patch('enabled', event.target.checked)} />
          <span className="switch" />
          <span>{rule.enabled ? 'Включён' : 'Выключен'}</span>
        </label>
      </div>

      <div className="editor-sections">
        <fieldset className="editor-section">
          <legend><span>1</span>Когда включать</legend>
          <div className="segmented-control" aria-label="Тип жеста">
            <button type="button" data-active={rule.triggerType === 'built-in'} onClick={() => patch('triggerType', 'built-in')}>Готовый жест</button>
            <button type="button" data-active={rule.triggerType === 'custom'} onClick={selectCustomTrigger} disabled={!gestures.length}>Мой триггер</button>
          </div>
          {rule.triggerType === 'built-in' ? (
            <div className="field"><span>Жест</span><GestureSelect value={rule.gesture} onChange={(gesture) => patch('gesture', gesture)} /></div>
          ) : (
            <div className="field"><span>Мой триггер</span><CustomGestureSelect gestures={gestures} value={rule.customGestureId ?? ''} onChange={(gestureId) => patch('customGestureId', gestureId)} /></div>
          )}
          <label className="range-field">
            <span><strong>Уверенность распознавания</strong><output>{Math.round(rule.confidence * 100)}%</output></span>
            <input type="range" min="0.5" max="0.95" step="0.01" value={rule.confidence} onChange={(event) => patch('confidence', Number(event.target.value))} />
            <small>Выше значение, меньше случайных срабатываний.</small>
          </label>
        </fieldset>

        <fieldset className="editor-section">
          <legend><span>2</span>Что показать</legend>
          <div className="field"><span>Медиафайл</span><MediaSelect media={media} value={rule.mediaId} onChange={(id) => patch('mediaId', id)} /></div>
          <label className="field"><span>Положение в кадре</span><select value={rule.anchor} onChange={(event) => patch('anchor', event.target.value as EffectRule['anchor'])}>{ANCHORS.map((anchor) => <option value={anchor.value} key={anchor.value}>{anchor.icon} {anchor.label}</option>)}</select><small>{ANCHORS.find((anchor) => anchor.value === rule.anchor)?.hint}</small></label>
          <div className="two-fields">
            <label className="range-field"><span><strong>Размер</strong><output>{Math.round(rule.scale * 100)}%</output></span><input type="range" min="0.08" max="1.2" step="0.01" value={rule.scale} onChange={(event) => patch('scale', Number(event.target.value))} /></label>
            <label className="range-field"><span><strong>Прозрачность</strong><output>{Math.round(rule.opacity * 100)}%</output></span><input type="range" min="0.1" max="1" step="0.01" value={rule.opacity} onChange={(event) => patch('opacity', Number(event.target.value))} /></label>
          </div>
          <div className="field animation-field"><span>Появление</span><AnimationPicker value={rule.animation} onChange={(animation) => patch('animation', animation)} asset={media.find((item) => item.id === rule.mediaId)} /></div>
        </fieldset>

        <details className="advanced-settings">
          <summary><span className="advanced-summary-title"><SlidersHorizontal /><span><strong>Точная настройка</strong><small>Задержка, повторы, слой, сдвиг и поворот</small></span></span><span className="advanced-summary-action"><i className="details-open-label">Открыть</i><i className="details-close-label">Свернуть</i><ChevronDown /></span></summary>
          <div className="advanced-grid">
            <label className="field"><span>Задержка жеста, мс</span><input type="number" min="0" max="3000" step="50" value={rule.holdMs} onChange={(event) => patch('holdMs', Number(event.target.value))} /></label>
            <label className="field"><span>{rule.mode === 'while-held' ? 'Обновлять каждые, мс' : 'Защита от повтора, мс'}</span><input type="number" min="0" max="30000" step="100" value={rule.cooldownMs} onChange={(event) => patch('cooldownMs', Number(event.target.value))} /><small>{rule.mode === 'while-held' ? 'Пока триггер остаётся в кадре.' : 'Не сработает повторно, пока триггер не исчезнет.'}</small></label>
            <label className="field"><span>Длительность, мс</span><input type="number" min="100" max="30000" step="100" value={rule.durationMs} onChange={(event) => patch('durationMs', Number(event.target.value))} /></label>
            <label className="field"><span>Поведение</span><select value={rule.mode} onChange={(event) => patch('mode', event.target.value as EffectRule['mode'])}><option value="once">Запустить один раз</option><option value="while-held">Обновлять, пока жест виден</option></select></label>
            <label className="field"><span>Слой</span><input type="number" min="0" max="100" value={rule.layer} onChange={(event) => patch('layer', Number(event.target.value))} /></label>
            <label className="field"><span>Сдвиг X</span><input type="number" min="-1280" max="1280" value={rule.offsetX} onChange={(event) => patch('offsetX', Number(event.target.value))} /></label>
            <label className="field"><span>Сдвиг Y</span><input type="number" min="-720" max="720" value={rule.offsetY} onChange={(event) => patch('offsetY', Number(event.target.value))} /></label>
            <label className="field"><span>Поворот</span><input type="number" min="-180" max="180" value={rule.rotation} onChange={(event) => patch('rotation', Number(event.target.value))} /></label>
            <label className="switch-field inline-switch"><input type="checkbox" checked={rule.mirror} onChange={(event) => patch('mirror', event.target.checked)} /><span className="switch" /><span>Отразить мем</span></label>
          </div>
        </details>
      </div>
      <footer className="editor-footer">
        <div><button className="button ghost" onClick={onDuplicate}><Copy />Создать копию</button><button className="button danger-button" onClick={onDelete}><Trash2 />Удалить</button></div>
        <button className="button primary" onClick={onTest}><Eye />Проверить эффект</button>
      </footer>
    </section>
  )
}
