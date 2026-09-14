export function createUpdateDemo(sendState) {
  let timer

  const availableState = () => ({
    phase: 'available',
    currentVersion: '0.1.0',
    version: '0.1.1',
    releaseName: 'SlayCam 0.1.1',
    notes: 'GIF больше не зацикливаются от одного жеста, а движения ловятся точнее.',
    automatic: false,
    percent: 0,
    message: '',
    demo: true,
  })

  return {
    setup() {
      setTimeout(() => sendState(availableState()), 700)
    },
    check() {
      sendState({ ...availableState(), phase: 'checking' })
      setTimeout(() => sendState(availableState()), 900)
    },
    download(currentState) {
      if (timer) clearInterval(timer)
      const steps = [6, 14, 25, 39, 52, 68, 81, 92, 100]
      let step = 0
      sendState({ ...currentState, phase: 'downloading', percent: 0, automatic: false, demo: true })
      timer = setInterval(() => {
        const percent = steps[step++]
        if (percent < 100) {
          sendState({ ...currentState, phase: 'downloading', percent, automatic: false, demo: true })
          return
        }
        clearInterval(timer)
        timer = undefined
        sendState({ ...currentState, phase: 'downloaded', percent: 100, automatic: false, demo: true })
      }, 650)
    },
    install(currentState) {
      sendState({ phase: 'not-available', currentVersion: currentState.version ?? '0.1.1', demo: true })
    },
    dispose() {
      if (timer) clearInterval(timer)
    },
  }
}
