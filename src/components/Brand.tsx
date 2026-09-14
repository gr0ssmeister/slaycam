const brandIconSrc = `${import.meta.env.BASE_URL}brand-icon.png`

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className="brand" aria-label="SlayCam">
      <span className="brand-mark" aria-hidden="true">
        <img src={brandIconSrc} alt="" />
      </span>
      {!compact && <span className="brand-word">SlayCam</span>}
    </div>
  )
}
