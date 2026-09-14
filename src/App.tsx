import { useEffect, useMemo, useRef, useState } from 'react'
import { Sidebar, type PageId } from './components/Sidebar'
import { Onboarding } from './components/Onboarding'
import { UpdateNotice } from './components/UpdateNotice'
import { TitleBar } from './components/TitleBar'
import { StudioPage } from './pages/StudioPage'
import { MediaPage } from './pages/MediaPage'
import { GesturesPage } from './pages/GesturesPage'
import { RulesPage } from './pages/RulesPage'
import { SettingsPage } from './pages/SettingsPage'
import { DEFAULT_CONFIG, mergeConfig } from './config'
import { installDefaultMemePack } from './defaultMemes'
import { useVision } from './hooks/useVision'
import { drawCameraFrame, drawLandmarks } from './lib/compositor'
import { readingMatchesRule, RuleEngine } from './lib/gestures'
import type { ActiveEffect, CustomGesture, EffectRule, MediaAsset, SlayCamConfig } from './types'
import { INITIAL_UPDATE_STATE, type UpdateState } from './update'

export default function App() {
  return <SlayCamApp />
}

function SlayCamApp() {
  const [config, setConfig] = useState<SlayCamConfig>(DEFAULT_CONFIG)
  const [loaded, setLoaded] = useState(false)
  const [page, setPage] = useState<PageId>('studio')
  const [selectedRuleId, setSelectedRuleId] = useState('')
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([])
  const [renderFps, setRenderFps] = useState(0)
  const [updateState, setUpdateState] = useState<UpdateState>(INITIAL_UPDATE_STATE)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const engineRef = useRef(new RuleEngine())
  const effectsRef = useRef<ActiveEffect[]>([])
  const fpsCounterRef = useRef({ frames: 0, startedAt: performance.now() })
  const vision = useVision(config.settings, config.gestures)

  useEffect(() => {
    window.slaycam.loadConfig().then((saved) => {
      const next = installDefaultMemePack(mergeConfig(saved))
      setConfig(next)
      setSelectedRuleId(next.rules[0]?.id ?? '')
      setLoaded(true)
    })
  }, [])

  useEffect(() => {
    if (!loaded) return
    const timer = window.setTimeout(() => void window.slaycam.saveConfig(config), 350)
    return () => window.clearTimeout(timer)
  }, [config, loaded])

  useEffect(() => { effectsRef.current = activeEffects }, [activeEffects])

  useEffect(() => {
    void window.slaycam.getUpdateState().then(setUpdateState)
    return window.slaycam.onUpdateState(setUpdateState)
  }, [])

  const addEffect = (rule: EffectRule, landmarks = vision.hands[0]?.landmarks ?? vision.poses[0] ?? [], handedness = vision.hands[0]?.handedness ?? 'Unknown') => {
    if (!rule.mediaId) return
    const now = performance.now()
    setActiveEffects((current) => {
      const active = current.find((effect) => effect.ruleId === rule.id)
      if (active && rule.mode === 'while-held') {
        return current.map((effect) => effect.ruleId === rule.id
          ? { ...effect, endsAt: now + rule.durationMs, rule, landmarks, poseLandmarks: vision.poses[0] ?? [], handedness }
          : effect)
      }
      return [
        ...current.filter((effect) => effect.ruleId !== rule.id),
        { id: crypto.randomUUID(), ruleId: rule.id, mediaId: rule.mediaId, startedAt: now, endsAt: now + rule.durationMs, rule, landmarks, poseLandmarks: vision.poses[0] ?? [], handedness },
      ]
    })
  }

  useEffect(() => {
    const now = performance.now()
    for (const rule of config.rules.filter((item) => item.enabled && item.mediaId)) {
      const reading = vision.readings.find((item) => readingMatchesRule(item, rule.triggerType, rule.gesture, rule.customGestureId))
      const shouldFire = engineRef.current.evaluate(
        rule.id,
        Boolean(reading),
        reading?.score ?? 0,
        rule.confidence,
        rule.holdMs,
        rule.cooldownMs,
        now,
        rule.mode === 'while-held',
      )
      if (shouldFire && reading) addEffect(rule, reading.landmarks, reading.handedness)
    }
  }, [config.rules, vision.readings])

  useEffect(() => {
    let frame = 0
    const render = (now: number) => {
      const canvas = canvasRef.current
      const video = vision.videoRef.current
      if (canvas && video) {
        if (canvas.width !== config.settings.width || canvas.height !== config.settings.height) {
          canvas.width = config.settings.width
          canvas.height = config.settings.height
        }
        const context = canvas.getContext('2d')
        if (context) {
          drawCameraFrame(context, video, config)
          if (config.settings.showLandmarks) drawLandmarks(context, [...vision.poses, ...vision.hands.map((hand) => hand.landmarks)], config.settings.mirrorCamera)
        }
        fpsCounterRef.current.frames += 1
        if (now - fpsCounterRef.current.startedAt >= 1000) {
          setRenderFps(Math.round(fpsCounterRef.current.frames * 1000 / (now - fpsCounterRef.current.startedAt)))
          fpsCounterRef.current = { frames: 0, startedAt: now }
        }
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [config, vision.hands, vision.poses, vision.videoRef])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now()
      setActiveEffects((current) => current.filter((effect) => effect.endsAt > now))
    }, 120)
    return () => window.clearInterval(timer)
  }, [])

  const importMedia = async () => {
    const imported = await window.slaycam.importMedia()
    if (!imported.length) return
    setConfig((current) => ({ ...current, media: [...current.media, ...imported] }))
  }

  const removeMedia = async (asset: MediaAsset) => {
    if (!window.confirm(`Удалить «${asset.name}» из SlayCam?`)) return
    if (!asset.pack) await window.slaycam.removeMedia(asset.storedName)
    setConfig((current) => ({
      ...current,
      media: current.media.filter((item) => item.id !== asset.id),
      rules: current.rules.map((rule) => rule.mediaId === asset.id ? { ...rule, mediaId: '' } : rule),
    }))
  }

  const createEffect = (rule: EffectRule) => {
    setConfig((current) => ({ ...current, rules: [...current.rules, rule] }))
    setSelectedRuleId(rule.id)
  }

  const updateRule = (rule: EffectRule) => setConfig((current) => ({ ...current, rules: current.rules.map((item) => item.id === rule.id ? rule : item) }))
  const duplicateRule = (rule: EffectRule) => {
    const copy = { ...rule, id: crypto.randomUUID(), name: `${rule.name} · копия` }
    setConfig((current) => ({ ...current, rules: [...current.rules, copy] }))
    setSelectedRuleId(copy.id)
  }
  const deleteRule = (rule: EffectRule) => {
    if (!window.confirm(`Удалить эффект «${rule.name}»?`)) return
    setConfig((current) => ({ ...current, rules: current.rules.filter((item) => item.id !== rule.id) }))
    setSelectedRuleId(config.rules.find((item) => item.id !== rule.id)?.id ?? '')
  }
  const addGesture = (gesture: CustomGesture) => setConfig((current) => ({ ...current, gestures: [...current.gestures, gesture] }))
  const updateGesture = (gesture: CustomGesture) => setConfig((current) => ({ ...current, gestures: current.gestures.map((item) => item.id === gesture.id ? gesture : item) }))
  const removeGesture = (gesture: CustomGesture) => {
    if (!window.confirm(`Удалить запись «${gesture.name}»?`)) return
    setConfig((current) => ({
      ...current,
      gestures: current.gestures.filter((item) => item.id !== gesture.id),
      rules: current.rules.map((rule) => rule.customGestureId === gesture.id ? { ...rule, enabled: false } : rule),
    }))
  }
  const pageContent = useMemo(() => {
    if (page === 'studio') return <StudioPage config={config} canvasRef={canvasRef} status={vision.status} readings={vision.readings} effects={activeEffects} fps={renderFps} onStart={vision.startCamera} onStop={vision.stopCamera} onNavigate={setPage} />
    if (page === 'media') return <MediaPage media={config.media} onImport={importMedia} onRemove={removeMedia} />
    if (page === 'gestures') return <GesturesPage gestures={config.gestures} videoRef={vision.videoRef} hands={vision.hands} poses={vision.poses} faces={vision.faces} faceBlendshapes={vision.faceBlendshapes} mirrorCamera={config.settings.mirrorCamera} cameraReady={vision.status.phase === 'ready'} cameraStatus={vision.status} onStartCamera={vision.startCamera} onAdd={addGesture} onChange={updateGesture} onRemove={removeGesture} />
    if (page === 'rules') return <RulesPage rules={config.rules} media={config.media} gestures={config.gestures} selectedId={selectedRuleId} onSelect={setSelectedRuleId} onCreate={createEffect} onImport={importMedia} onRecordGesture={() => setPage('gestures')} onChange={updateRule} onDuplicate={duplicateRule} onDelete={deleteRule} onTest={(rule) => { addEffect(rule); setPage('studio') }} />
    return <SettingsPage settings={config.settings} devices={vision.devices} updateState={updateState} onChange={(settings) => setConfig((current) => ({ ...current, settings }))} onRefreshDevices={vision.refreshDevices} onCheckUpdates={() => void window.slaycam.checkForUpdates()} onDownloadUpdate={() => void window.slaycam.downloadUpdate()} onInstallUpdate={() => void window.slaycam.installUpdate()} />
  }, [activeEffects, config, page, selectedRuleId, updateState, vision])

  if (!loaded) return <div className="app-window"><TitleBar /><div className="app-loading"><span className="loading-flower" />Загружаем SlayCam</div></div>
  return (
    <div className="app-window">
      <TitleBar />
      <div className="app-shell">
        <video ref={vision.videoRef} className="source-video" playsInline muted aria-hidden="true" />
        <Sidebar page={page} onChange={setPage} />
        <main className="app-main" tabIndex={-1}>{pageContent}</main>
        <UpdateNotice state={updateState} onDownload={() => void window.slaycam.downloadUpdate()} onInstall={() => void window.slaycam.installUpdate()} />
        {!config.settings.onboardingComplete && <Onboarding onFinish={() => setConfig((current) => ({ ...current, settings: { ...current.settings, onboardingComplete: true } }))} />}
        <div className="sr-live" aria-live="polite" />
      </div>
    </div>
  )
}
