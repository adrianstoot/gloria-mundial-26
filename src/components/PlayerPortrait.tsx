import type { CSSProperties } from 'react'
import { nations } from '../data'

type PortraitSize = 'sm' | 'md' | 'lg' | 'hero'

interface PlayerPortraitProps {
  playerId: string
  nationId: string
  label: string
  number?: number | string
  size?: PortraitSize
  className?: string
}

export function PlayerPortrait({ playerId, nationId, label, number, size = 'md', className = '' }: PlayerPortraitProps) {
  const nation = nations.find((item) => item.id === nationId)
  const initials = label.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  const style = {
    '--kit-primary': nation?.primaryColor ?? '#18579b',
    '--kit-secondary': nation?.secondaryColor ?? '#f4f7fb',
  } as CSSProperties

  return (
    <span
      className={`player-portrait player-portrait--${size} player-portrait--anonymous ${className}`.trim()}
      style={style}
      role="img"
      aria-label={`Identificador de plantilla de ${label}`}
      title={`${label} · identidad visual sin fotografía`}
      data-player-id={playerId}
    >
      <i className="player-portrait__photo" aria-hidden="true"><span>{initials}</span></i>
      <i className="player-portrait__kit" />
      {number !== undefined && <b className="player-portrait__number">{number}</b>}
    </span>
  )
}

interface TeamShirtProps {
  nationId: string
  number: number | string
  label?: string
  className?: string
}

export function TeamShirt({ nationId, number, label, className = '' }: TeamShirtProps) {
  const nation = nations.find((item) => item.id === nationId)
  const style = {
    '--kit-primary': nation?.primaryColor ?? '#18579b',
    '--kit-secondary': nation?.secondaryColor ?? '#f4f7fb',
  } as CSSProperties
  return <span className={`team-shirt ${className}`.trim()} style={style} title={label}><i /><b>{number}</b></span>
}
