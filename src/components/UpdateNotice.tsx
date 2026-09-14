import { AlertCircle, Download, RefreshCw, Sparkles, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import type { UpdateState } from '../update'

export function UpdateNotice({ state, onDownload, onInstall }: {
  state: UpdateState
  onDownload: () => void
  onInstall: () => void
}) {
  const stateKey = `${state.phase}:${state.version ?? ''}:${state.message ?? ''}`
  const [dismissedKey, setDismissedKey] = useState('')

  useEffect(() => {
    if (state.phase === 'downloaded') setDismissedKey('')
  }, [state.phase])

  const content = useMemo(() => {
    if (state.phase === 'available') return {
      icon: <Sparkles />,
      title: 'Свежий SlayCam',
      body: state.notes || `Версия ${state.version} готова.`,
      action: <button className="button primary" onClick={onDownload}><Download />Скачать обновление</button>,
    }
    if (state.phase === 'downloading') return {
      icon: <Download />,
      title: `Качаем ${state.version ?? 'обновление'}`,
      body: `${Math.round(state.percent ?? 0)}%`,
      action: null,
    }
    if (state.phase === 'downloaded') return {
      icon: <Sparkles />,
      title: 'Обновление готово',
      body: 'Перезапусти SlayCam, установка займёт несколько секунд.',
      action: <button className="button primary" onClick={onInstall}><RefreshCw />Перезапустить</button>,
    }
    if (state.phase === 'error' && !state.automatic) return {
      icon: <AlertCircle />,
      title: 'Не получилось обновиться',
      body: 'Проверь интернет и попробуй ещё раз в настройках.',
      action: null,
    }
    return null
  }, [onDownload, onInstall, state])

  if (!content || dismissedKey === stateKey) return null

  return (
    <aside className="update-notice" data-phase={state.phase} aria-live="polite" aria-label="Обновление SlayCam">
      <span className="update-notice-icon">{content.icon}</span>
      <div className="update-notice-copy">
        <strong>{content.title}</strong>
        <p>{content.body}</p>
        {state.phase === 'downloading' && (
          <div className="update-progress" role="progressbar" aria-label="Загрузка обновления" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(state.percent ?? 0)}>
            <span style={{ transform: `scaleX(${(state.percent ?? 0) / 100})` }} />
          </div>
        )}
        {content.action && <div className="update-notice-actions">{content.action}</div>}
      </div>
      <button className="update-notice-close" onClick={() => setDismissedKey(stateKey)} aria-label="Скрыть уведомление"><X /></button>
    </aside>
  )
}
