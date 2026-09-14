import { Camera, CheckCircle2, ExternalLink, MonitorUp, RefreshCw, ShieldCheck } from 'lucide-react'
import type { AppSettings } from '../types'

export function SettingsPage({ settings, devices, onChange, onRefreshDevices, onOpenOutput }: {
  settings: AppSettings
  devices: MediaDeviceInfo[]
  onChange: (settings: AppSettings) => void
  onRefreshDevices: () => void
  onOpenOutput: () => void
}) {
  const patch = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => onChange({ ...settings, [key]: value })
  return (
    <div className="page settings-page">
      <header className="page-header"><div><h1>Настройки</h1><p>Камера, качество, распознавание и вывод.</p></div><span className="autosave-state"><CheckCircle2 />Сохраняется автоматически</span></header>
      <div className="settings-layout">
        <section className="settings-section">
          <div className="settings-title"><span><Camera /></span><div><h2>Камера</h2><p>Источник и качество кадра</p></div></div>
          <div className="settings-fields">
            <label className="field"><span>Камера</span><div className="input-action"><select value={settings.cameraId} onChange={(event) => patch('cameraId', event.target.value)}><option value="">Камера по умолчанию</option>{devices.map((device, index) => <option value={device.deviceId} key={device.deviceId}>{device.label || `Камера ${index + 1}`}</option>)}</select><button className="icon-button" onClick={onRefreshDevices} aria-label="Обновить список камер"><RefreshCw /></button></div></label>
            <div className="two-fields">
              <label className="field"><span>Разрешение</span><select value={`${settings.width}x${settings.height}`} onChange={(event) => { const [width, height] = event.target.value.split('x').map(Number); onChange({ ...settings, width, height }) }}><option value="1280x720">HD · 1280 × 720</option><option value="1920x1080">Full HD · 1920 × 1080</option><option value="640x360">Экономно · 640 × 360</option></select></label>
              <label className="field"><span>Частота кадров</span><select value={settings.fps} onChange={(event) => patch('fps', Number(event.target.value))}><option value={24}>24 FPS</option><option value={30}>30 FPS</option><option value={60}>60 FPS</option></select></label>
            </div>
            <Toggle checked={settings.mirrorCamera} onChange={(value) => patch('mirrorCamera', value)} label="Зеркальное отражение" hint="Двигаться в предпросмотре будет привычнее" />
          </div>
        </section>

        <section className="settings-section output-settings">
          <div className="settings-title"><span><MonitorUp /></span><div><h2>Вывод в Discord и Meet</h2><p>Через виртуальную камеру OBS</p></div></div>
          <div className="output-steps">
            <div><span>1</span><p><strong>Открой окно SlayCam Output</strong><small>В нём будет только готовый кадр.</small></p></div>
            <div><span>2</span><p><strong>Добавь его в OBS</strong><small>Источник «Захват окна», затем SlayCam Output.</small></p></div>
            <div><span>3</span><p><strong>Запусти Virtual Camera</strong><small>Выбери OBS Virtual Camera в Discord или Meet.</small></p></div>
          </div>
          <div className="output-buttons">
            <button className="button primary" onClick={onOpenOutput}><MonitorUp />Открыть вывод</button>
            <button className="button secondary" onClick={() => window.slaycam.openExternal('https://obsproject.com/download')}><ExternalLink />Скачать OBS</button>
          </div>
        </section>

        <section className="settings-section">
          <div className="settings-title"><span><ShieldCheck /></span><div><h2>Распознавание</h2><p>Баланс скорости и точности</p></div></div>
          <div className="settings-fields">
            <label className="range-field"><span><strong>Проверок в секунду</strong><output>{settings.inferenceFps}</output></span><input type="range" min="10" max="30" step="1" value={settings.inferenceFps} onChange={(event) => patch('inferenceFps', Number(event.target.value))} /><small>20–24 подходит большинству компьютеров.</small></label>
            <Toggle checked={settings.showLandmarks} onChange={(value) => patch('showLandmarks', value)} label="Показывать точки тела" hint="Кисти и скелет поверх камеры" />
            <Toggle checked={settings.showFps} onChange={(value) => patch('showFps', value)} label="Показывать FPS" hint="Помогает заметить нагрузку" />
          </div>
        </section>
      </div>
    </div>
  )
}

function Toggle({ checked, onChange, label, hint }: { checked: boolean; onChange: (value: boolean) => void; label: string; hint: string }) {
  return (
    <label className="toggle-row">
      <span><strong>{label}</strong><small>{hint}</small></span>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span className="switch" />
    </label>
  )
}
