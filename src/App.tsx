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
import { ProfilesPage } from './pages/ProfilesPage'
import { DEFAULT_BACKGROUND, DEFAULT_CONFIG, mergeConfig } from './config'
import { installDefaultMemePack } from './defaultMemes'
import { useVision } from './hooks/useVision'
import { drawLandmarks, drawScene, MediaBank } from './lib/compositor'
import { readingMatchesRule, RuleEngine } from './lib/gestures'
import type { ActiveEffect, AppProfile, BackgroundSettings, CustomGesture, EffectRule, MediaAsset, MediaImportKind, SlayCamConfig, VirtualCameraState } from './types'
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
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([])
  const [virtualCamera, setVirtualCamera] = useState<VirtualCameraState>({ phase: 'unsupported', installed: false, streaming: false, message: 'Доступно в Windows-версии' })
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const virtualOutputCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const virtualLogoRef = useRef<HTMLImageElement | null>(null)
  const engineRef = useRef(new RuleEngine())
  const mediaBankRef = useRef(new MediaBank())
  const audioPlayersRef = useRef(new Map<string, HTMLAudioElement>())
  const effectsRef = useRef<ActiveEffect[]>([])
  const fpsCounterRef = useRef({ frames: 0, startedAt: performance.now() })
  const perfRef = useRef({ frames: 0, draw: 0, output: 0, startedAt: performance.now() })
  const frameErrorRef = useRef({ count: 0, reportedAt: 0 })
  const virtualFrameRef = useRef(0)
  const autoLaunchAttemptedRef = useRef(false)
  const vision = useVision(config.settings, config.gestures)
  const activeProfile = useMemo(() => config.profiles.find((profile) => profile.id === config.activeProfileId) ?? config.profiles[0], [config.activeProfileId, config.profiles])
  const activeRules = useMemo(() => config.rules.filter((rule) => rule.profileId === activeProfile?.id), [activeProfile?.id, config.rules])
  const virtualOutputSize = useMemo(() => fitVirtualCameraSize(config.settings.width, config.settings.height), [config.settings.height, config.settings.width])
  const renderStateRef = useRef({ config, background: activeProfile?.background ?? DEFAULT_BACKGROUND, virtualCamera, virtualOutputSize, hands: vision.hands, poses: vision.poses })

  useEffect(() => {
    const restore = async () => {
      let next = DEFAULT_CONFIG
      try {
        next = installDefaultMemePack(mergeConfig(await window.slaycam.loadConfig()))
      } catch (error) {
        window.slaycam.reportRendererError(`config-restore: ${error instanceof Error ? error.stack || error.message : String(error)}`)
      }
      setConfig(next)
      setSelectedRuleId(next.rules[0]?.id ?? '')
      setLoaded(true)
    }
    void restore()
  }, [])

  useEffect(() => {
    if (!loaded) return
    const timer = window.setTimeout(() => void window.slaycam.saveConfig(config), 350)
    return () => window.clearTimeout(timer)
  }, [config, loaded])

  useEffect(() => { effectsRef.current = activeEffects }, [activeEffects])

  useEffect(() => {
    renderStateRef.current = { config, background: activeProfile?.background ?? DEFAULT_BACKGROUND, virtualCamera, virtualOutputSize, hands: vision.hands, poses: vision.poses }
  }, [activeProfile?.background, config, virtualCamera, virtualOutputSize, vision.hands, vision.poses])

  useEffect(() => { mediaBankRef.current.removeMissing(config.media) }, [config.media])

  useEffect(() => {
    const logo = new Image()
    logo.src = `${import.meta.env.BASE_URL}brand-icon.png`
    virtualLogoRef.current = logo
    return () => { virtualLogoRef.current = null }
  }, [])

  useEffect(() => {
    if (!loaded || page !== 'rules') return
    const refreshAudioOutputs = async () => {
      const mediaDevices = navigator.mediaDevices
      if (!mediaDevices?.enumerateDevices) return
      try {
        const devices = await mediaDevices.enumerateDevices()
        setAudioOutputs(devices.filter((device) => device.kind === 'audiooutput'))
      } catch {
        setAudioOutputs([])
      }
    }
    void refreshAudioOutputs()
    navigator.mediaDevices?.addEventListener?.('devicechange', refreshAudioOutputs)
    return () => navigator.mediaDevices?.removeEventListener?.('devicechange', refreshAudioOutputs)
  }, [loaded, page])

  useEffect(() => {
    if (!loaded || page !== 'settings') return
    void vision.refreshDevices()
  }, [loaded, page, vision.refreshDevices])

  useEffect(() => {
    void window.slaycam.getUpdateState().then(setUpdateState)
    return window.slaycam.onUpdateState(setUpdateState)
  }, [])

  useEffect(() => {
    void window.slaycam.getVirtualCameraState().then(setVirtualCamera)
    return window.slaycam.onVirtualCameraState(setVirtualCamera)
  }, [])

  useEffect(() => {
    setActiveEffects([])
    engineRef.current = new RuleEngine()
    for (const player of audioPlayersRef.current.values()) player.pause()
    audioPlayersRef.current.clear()
  }, [config.activeProfileId])

  const playRuleSound = (rule: EffectRule) => {
    if (rule.soundSource === 'none') return
    const asset = rule.soundSource === 'media'
      ? config.media.find((item) => item.id === rule.mediaId && item.type === 'video')
      : config.media.find((item) => item.id === rule.soundMediaId && item.type === 'audio')
    if (!asset) return
    const previous = audioPlayersRef.current.get(rule.id)
    previous?.pause()
    const player = new Audio(asset.src)
    player.volume = Math.max(0, Math.min(1, rule.soundVolume))
    audioPlayersRef.current.set(rule.id, player)
    const sinkPlayer = player as HTMLAudioElement & { setSinkId?: (deviceId: string) => Promise<void> }
    const start = async () => {
      if (rule.soundOutputDeviceId && sinkPlayer.setSinkId) {
        try { await sinkPlayer.setSinkId(rule.soundOutputDeviceId) } catch { /* Windows will use the default output. */ }
      }
      await player.play()
    }
    void start().catch(() => undefined)
    player.addEventListener('ended', () => audioPlayersRef.current.delete(rule.id), { once: true })
  }

  const addEffect = (rule: EffectRule, landmarks = vision.hands[0]?.landmarks ?? vision.poses[0] ?? [], handedness = vision.hands[0]?.handedness ?? 'Unknown') => {
    if (!rule.mediaId) return
    const now = performance.now()
    const alreadyActive = effectsRef.current.some((effect) => effect.ruleId === rule.id)
    if (!alreadyActive) playRuleSound(rule)
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
    for (const rule of activeRules.filter((item) => item.enabled && item.mediaId)) {
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
  }, [activeRules, vision.readings])

  useEffect(() => {
    if (vision.status.phase !== 'ready') {
      setRenderFps(0)
      return
    }
    let frame = 0
    // When the virtual camera runs at the capture size there is nothing to rescale,
    // so the frame is read straight from the preview instead of copying it first.
    const captureVirtualFrame = (sourceCanvas: HTMLCanvasElement, sourceContext: CanvasRenderingContext2D, size: { width: number, height: number }) => {
      if (sourceCanvas.width === size.width && sourceCanvas.height === size.height) {
        return sourceContext.getImageData(0, 0, size.width, size.height)
      }
      const outputCanvas = virtualOutputCanvasRef.current ?? document.createElement('canvas')
      virtualOutputCanvasRef.current = outputCanvas
      if (outputCanvas.width !== size.width || outputCanvas.height !== size.height) {
        outputCanvas.width = size.width
        outputCanvas.height = size.height
      }
      const outputContext = outputCanvas.getContext('2d', { willReadFrequently: true })
      if (!outputContext) return undefined
      outputContext.drawImage(sourceCanvas, 0, 0, size.width, size.height)
      return outputContext.getImageData(0, 0, size.width, size.height)
    }
    // One bad frame must never end the camera: it is reported and the next frame is drawn.
    const reportFrameFailure = (error: unknown) => {
      const failures = frameErrorRef.current
      failures.count += 1
      const at = performance.now()
      if (failures.count > 1 && at - failures.reportedAt < 10000) return
      failures.reportedAt = at
      window.slaycam.reportRendererError(`frame-failure #${failures.count}: ${error instanceof Error ? error.stack || error.message : String(error)}`)
    }
    const drawFrame = (now: number) => {
      const canvas = canvasRef.current
      const video = vision.videoRef.current
      if (canvas && video) {
        const state = renderStateRef.current
        if (canvas.width !== state.config.settings.width || canvas.height !== state.config.settings.height) {
          canvas.width = state.config.settings.width
          canvas.height = state.config.settings.height
        }
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (context) {
          const drawStartedAt = performance.now()
          drawScene(context, video, state.config, effectsRef.current, mediaBankRef.current, now, state.background, vision.segmentationRef.current)
          if (state.config.settings.showLandmarks) drawLandmarks(context, [...state.poses, ...state.hands.map((hand) => hand.landmarks)], state.config.settings.mirrorCamera)
          const drawnAt = performance.now()
          if (state.virtualCamera.streaming && now - virtualFrameRef.current >= 1000 / Math.min(30, state.config.settings.fps)) {
            virtualFrameRef.current = now
            const outputFrame = captureVirtualFrame(canvas, context, state.virtualOutputSize)
            if (outputFrame) window.slaycam.sendVirtualCameraFrame(outputFrame.data.buffer)
          }
          const meter = perfRef.current
          meter.frames += 1
          meter.draw += drawnAt - drawStartedAt
          meter.output += performance.now() - drawnAt
          if (now - meter.startedAt >= 5000) {
            const fps = meter.frames * 1000 / (now - meter.startedAt)
            // Only a struggling camera is worth a log line; a healthy one stays silent.
            if (fps < 24) {
              window.slaycam.reportPerformance([
                `fps=${fps.toFixed(1)}`,
                `draw=${(meter.draw / meter.frames).toFixed(1)}ms`,
                `output=${(meter.output / meter.frames).toFixed(1)}ms`,
                `effects=${effectsRef.current.length}`,
                `camera=${canvas.width}x${canvas.height}`,
                `virtual=${state.virtualCamera.streaming ? `${state.virtualOutputSize.width}x${state.virtualOutputSize.height}` : 'off'}`,
                `background=${state.background.mode}`,
              ].join(' '))
            }
            perfRef.current = { frames: 0, draw: 0, output: 0, startedAt: now }
          }
        }
        fpsCounterRef.current.frames += 1
        if (now - fpsCounterRef.current.startedAt >= 1000) {
          setRenderFps(Math.round(fpsCounterRef.current.frames * 1000 / (now - fpsCounterRef.current.startedAt)))
          fpsCounterRef.current = { frames: 0, startedAt: now }
        }
      }
    }
    const render = (now: number) => {
      try {
        drawFrame(now)
      } catch (error) {
        reportFrameFailure(error)
      }
      frame = requestAnimationFrame(render)
    }
    frame = requestAnimationFrame(render)
    return () => cancelAnimationFrame(frame)
  }, [vision.segmentationRef, vision.status.phase, vision.videoRef])

  useEffect(() => {
    if (!virtualCamera.streaming || vision.status.phase === 'ready') return
    const sendIdleFrame = () => {
      const outputCanvas = virtualOutputCanvasRef.current ?? document.createElement('canvas')
      virtualOutputCanvasRef.current = outputCanvas
      if (outputCanvas.width !== virtualOutputSize.width || outputCanvas.height !== virtualOutputSize.height) {
        outputCanvas.width = virtualOutputSize.width
        outputCanvas.height = virtualOutputSize.height
      }
      const context = outputCanvas.getContext('2d', { willReadFrequently: true })
      if (!context) return
      drawVirtualCameraIdleFrame(context, outputCanvas.width, outputCanvas.height, virtualLogoRef.current)
      const outputFrame = context.getImageData(0, 0, outputCanvas.width, outputCanvas.height)
      window.slaycam.sendVirtualCameraFrame(outputFrame.data.buffer)
    }
    sendIdleFrame()
    const timer = window.setInterval(sendIdleFrame, 1000)
    return () => window.clearInterval(timer)
  }, [virtualCamera.streaming, virtualOutputSize.height, virtualOutputSize.width, vision.status.phase])

  useEffect(() => {
    const timer = window.setInterval(() => {
      const now = performance.now()
      setActiveEffects((current) => {
        const alive = current.filter((effect) => effect.endsAt > now)
        return alive.length === current.length ? current : alive
      })
    }, 120)
    return () => window.clearInterval(timer)
  }, [])

  const importMedia = async (kind: MediaImportKind = 'all') => {
    const imported = await window.slaycam.importMedia(kind)
    if (!imported.length) return
    setConfig((current) => ({ ...current, media: [...current.media, ...imported] }))
  }

  const removeMedia = async (asset: MediaAsset) => {
    if (!window.confirm(`Удалить «${asset.name}» из SlayCam?`)) return
    if (!asset.pack) await window.slaycam.removeMedia(asset.storedName)
    setConfig((current) => ({
      ...current,
      media: current.media.filter((item) => item.id !== asset.id),
      rules: current.rules.map((rule) => rule.soundMediaId === asset.id
        ? { ...rule, mediaId: rule.mediaId === asset.id ? '' : rule.mediaId, soundMediaId: '', soundSource: 'none', soundEnabled: false }
        : { ...rule, mediaId: rule.mediaId === asset.id ? '' : rule.mediaId }),
      profiles: current.profiles.map((profile) => profile.background.mediaId === asset.id ? { ...profile, background: { ...profile.background, mediaId: '', mode: 'none' } } : profile),
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
  const selectProfile = (id: string) => {
    const firstRule = config.rules.find((rule) => rule.profileId === id)
    setConfig((current) => ({ ...current, activeProfileId: id }))
    setSelectedRuleId(firstRule?.id ?? '')
  }
  const createProfile = (name: string, emoji: string) => {
    const profile: AppProfile = { id: crypto.randomUUID(), name, emoji, background: structuredClone(DEFAULT_BACKGROUND), createdAt: new Date().toISOString() }
    setConfig((current) => ({ ...current, profiles: [...current.profiles, profile], activeProfileId: profile.id }))
    setSelectedRuleId('')
  }
  const updateProfile = (profile: AppProfile) => setConfig((current) => ({ ...current, profiles: current.profiles.map((item) => item.id === profile.id ? profile : item) }))
  const updateActiveBackground = (background: BackgroundSettings) => {
    if (!activeProfile) return
    updateProfile({ ...activeProfile, background })
  }
  const duplicateProfile = (profile: AppProfile) => {
    const id = crypto.randomUUID()
    const copy: AppProfile = { ...structuredClone(profile), id, name: `${profile.name} · копия`, createdAt: new Date().toISOString() }
    const copiedRules = config.rules.filter((rule) => rule.profileId === profile.id).map((rule) => ({ ...structuredClone(rule), id: crypto.randomUUID(), profileId: id }))
    setConfig((current) => ({ ...current, profiles: [...current.profiles, copy], rules: [...current.rules, ...copiedRules], activeProfileId: id }))
    setSelectedRuleId(copiedRules[0]?.id ?? '')
  }
  const deleteProfile = (profile: AppProfile) => {
    if (config.profiles.length === 1 || !window.confirm(`Удалить профиль «${profile.name}» и его эффекты?`)) return
    const next = config.profiles.find((item) => item.id !== profile.id)
    if (!next) return
    setConfig((current) => ({ ...current, profiles: current.profiles.filter((item) => item.id !== profile.id), rules: current.rules.filter((rule) => rule.profileId !== profile.id), activeProfileId: current.activeProfileId === profile.id ? next.id : current.activeProfileId }))
    setSelectedRuleId(config.rules.find((rule) => rule.profileId === next.id)?.id ?? '')
  }

  const startSlayCam = async () => {
    if (virtualCamera.phase === 'not-installed') await window.slaycam.installVirtualCamera()
    await vision.startCamera()
  }

  const stopSlayCam = () => {
    vision.stopCamera()
  }

  useEffect(() => {
    if (!virtualCamera.installed || virtualCamera.phase !== 'ready') return
    void window.slaycam.startVirtualCamera(virtualOutputSize.width, virtualOutputSize.height, Math.min(30, config.settings.fps))
  }, [config.settings.fps, virtualCamera.installed, virtualCamera.phase, virtualOutputSize.height, virtualOutputSize.width])

  useEffect(() => {
    if (!loaded || !config.settings.startCameraOnLaunch || autoLaunchAttemptedRef.current) return
    autoLaunchAttemptedRef.current = true
    void startSlayCam()
  }, [config.settings.startCameraOnLaunch, loaded])

  const pageContent = useMemo(() => {
    if (page === 'studio' && activeProfile) return <StudioPage config={{ ...config, rules: activeRules }} profile={activeProfile} canvasRef={canvasRef} status={vision.status} readings={vision.readings} effects={activeEffects} fps={renderFps} virtualCamera={virtualCamera} onStart={() => void startSlayCam()} onStop={stopSlayCam} onNavigate={setPage} onBackgroundChange={updateActiveBackground} onImportBackground={() => void importMedia('background')} />
    if (page === 'media') return <MediaPage media={config.media} onImport={() => void importMedia('all')} onRemove={removeMedia} />
    if (page === 'gestures') return <GesturesPage gestures={config.gestures} videoRef={vision.videoRef} hands={vision.hands} poses={vision.poses} faces={vision.faces} faceBlendshapes={vision.faceBlendshapes} mirrorCamera={config.settings.mirrorCamera} cameraReady={vision.status.phase === 'ready'} cameraStatus={vision.status} onStartCamera={vision.startCamera} onAdd={addGesture} onChange={updateGesture} onRemove={removeGesture} />
    if (page === 'rules' && activeProfile) return <RulesPage rules={activeRules} media={config.media} gestures={config.gestures} profileId={activeProfile.id} audioDevices={audioOutputs} selectedId={selectedRuleId} onSelect={setSelectedRuleId} onCreate={createEffect} onImport={(kind) => void importMedia(kind)} onRecordGesture={() => setPage('gestures')} onChange={updateRule} onDuplicate={duplicateRule} onDelete={deleteRule} onTest={(rule) => { addEffect(rule); setPage('studio') }} />
    if (page === 'profiles') return <ProfilesPage profiles={config.profiles} activeId={config.activeProfileId} rules={config.rules} onSelect={selectProfile} onCreate={createProfile} onChange={updateProfile} onDuplicate={duplicateProfile} onDelete={deleteProfile} />
    return <SettingsPage settings={config.settings} devices={vision.devices} updateState={updateState} onChange={(settings) => setConfig((current) => ({ ...current, settings }))} onRefreshDevices={vision.refreshDevices} onCheckUpdates={() => void window.slaycam.checkForUpdates()} onDownloadUpdate={() => void window.slaycam.downloadUpdate()} onInstallUpdate={() => void window.slaycam.installUpdate()} />
  }, [activeEffects, activeProfile, activeRules, audioOutputs, config, page, selectedRuleId, updateState, virtualCamera, vision])

  if (!loaded) return <div className="app-window"><TitleBar /><div className="app-loading"><span className="loading-flower" />Загружаем SlayCam</div></div>
  return (
    <div className="app-window">
      <TitleBar />
      <div className="app-shell">
        <video ref={vision.videoRef} className="source-video" playsInline muted aria-hidden="true" />
        <Sidebar page={page} profiles={config.profiles} activeProfileId={config.activeProfileId} onChange={setPage} onProfileChange={selectProfile} />
        <main className="app-main" tabIndex={-1}>{pageContent}</main>
        <UpdateNotice state={updateState} onDownload={() => void window.slaycam.downloadUpdate()} onInstall={() => void window.slaycam.installUpdate()} />
        {!config.settings.onboardingComplete && <Onboarding onFinish={() => setConfig((current) => ({ ...current, settings: { ...current.settings, onboardingComplete: true } }))} />}
        <div className="sr-live" aria-live="polite" />
      </div>
    </div>
  )
}

function fitVirtualCameraSize(width: number, height: number) {
  const safeWidth = Math.max(320, Number.isFinite(width) ? width : 1280)
  const safeHeight = Math.max(180, Number.isFinite(height) ? height : 720)
  const scale = Math.min(1, 1280 / safeWidth, 720 / safeHeight)
  return {
    width: Math.max(320, Math.round(safeWidth * scale / 4) * 4),
    height: Math.max(180, Math.round(safeHeight * scale / 4) * 4),
  }
}

function drawVirtualCameraIdleFrame(context: CanvasRenderingContext2D, width: number, height: number, logo: HTMLImageElement | null) {
  context.save()
  context.clearRect(0, 0, width, height)
  context.fillStyle = '#24121f'
  context.fillRect(0, 0, width, height)

  const glow = context.createRadialGradient(width * 0.5, height * 0.4, 0, width * 0.5, height * 0.4, width * 0.48)
  glow.addColorStop(0, 'rgba(197, 45, 126, 0.34)')
  glow.addColorStop(1, 'rgba(36, 18, 31, 0)')
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)

  const logoSize = Math.round(Math.min(width, height) * 0.24)
  const logoX = Math.round((width - logoSize) / 2)
  const logoY = Math.round(height * 0.25)
  if (logo?.complete && logo.naturalWidth) context.drawImage(logo, logoX, logoY, logoSize, logoSize)

  context.textAlign = 'center'
  context.fillStyle = '#fff7fb'
  context.font = `800 ${Math.round(Math.min(width, height) * 0.074)}px "Segoe UI", sans-serif`
  context.fillText('SlayCam', width / 2, height * 0.64)
  context.restore()
}
