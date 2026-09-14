export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="SlayCam">
      <span className="brand-mark" aria-hidden="true">
        <img src="/brand-icon.png" alt="" />
      </span>
      {!compact && <span className="brand-word">SlayCam</span>}
    </div>
  )
}
