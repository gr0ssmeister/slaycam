import { Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function TitleBar() {
  const [maximized, setMaximized] = useState(false)
  const nativeControls = window.slaycam.getPlatform() === 'win32'

  useEffect(() => {
    void window.slaycam.isWindowMaximized().then(setMaximized)
    return window.slaycam.onWindowMaximized(setMaximized)
  }, [])

  return (
    <header className="titlebar" data-native-controls={nativeControls} aria-label="Панель окна SlayCam">
      <div className="titlebar-brand">
        <img src={`${import.meta.env.BASE_URL}brand-icon.png`} alt="" />
        <strong>SlayCam</strong>
        {/* <span>by grossmeister</span> */}
      </div>
      {!nativeControls && <div className="window-controls">
        <button type="button" aria-label="Свернуть окно" title="Свернуть" onClick={() => void window.slaycam.minimizeWindow()}><Minus /></button>
        <button type="button" aria-label={maximized ? 'Восстановить окно' : 'Развернуть окно'} title={maximized ? 'Восстановить' : 'Развернуть'} onClick={() => void window.slaycam.toggleMaximizeWindow()}><Square data-maximized={maximized} /></button>
        <button type="button" className="window-close" aria-label="Закрыть окно" title="Закрыть" onClick={() => void window.slaycam.closeWindow()}><X /></button>
      </div>}
    </header>
  )
}
