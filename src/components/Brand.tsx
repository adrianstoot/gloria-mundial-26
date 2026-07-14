import { Crown, Sparkles } from 'lucide-react'

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? 'brand--compact' : ''}`} aria-label="Gloria Mundial 26">
      <span className="brand__mark" aria-hidden="true">
        <span className="brand__orbit" />
        <Crown size={compact ? 17 : 25} strokeWidth={1.6} />
        {!compact && <Sparkles className="brand__spark" size={10} />}
      </span>
      <span className="brand__wordmark">
        <b>GLORIA</b>
        <small>MUNDIAL <em>26</em></small>
      </span>
    </div>
  )
}

