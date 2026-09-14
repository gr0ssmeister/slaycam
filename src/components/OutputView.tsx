import { useEffect, useState } from 'react'

export function OutputView() {
  const [frame, setFrame] = useState('')
  useEffect(() => window.slaycam.onOutputFrame(setFrame), [])
  return (
    <main className="output-view">
      {frame ? <img src={frame} alt="Выходной кадр SlayCam" /> : <div>Откройте камеру в SlayCam</div>}
    </main>
  )
}
