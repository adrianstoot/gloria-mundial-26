import type { CSSProperties } from 'react'

export function Flag({ code, label, size = 'md' }: { code: string; label: string; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <span
      className={`flag-medallion flag-medallion--${size}`}
      style={{ '--flag-shadow': `var(--cyan-glow)` } as CSSProperties}
      title={label}
      aria-label={`Bandera de ${label}`}
    >
      <span className={`fi fi-${code.toLowerCase()}`} aria-hidden="true" />
    </span>
  )
}

