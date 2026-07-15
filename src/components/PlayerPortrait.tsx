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
  const primary = nation?.primaryColor ?? '#18579b'
  const secondary = nation?.secondaryColor ?? '#f4f7fb'

  return (
    <span
      className={`player-portrait-premium player-portrait-premium--${size} ${className}`.trim()}
      role="img"
      aria-label={`Identificador de plantilla de ${label}`}
      title={`${label}`}
      data-player-id={playerId}
    >
      <svg viewBox="0 0 100 110" width="100%" height="100%" className="premium-jersey-svg">
        <defs>
          <linearGradient id="jersey-3d-shading" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.32" />
            <stop offset="25%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="50%" stopColor="#000000" stopOpacity="0" />
            <stop offset="75%" stopColor="#ffffff" stopOpacity="0.15" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.32" />
          </linearGradient>
          <linearGradient id="sleeve-left-shade" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="sleeve-right-shade" x1="100%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.1" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0.45" />
          </linearGradient>
        </defs>

        {/* Left Sleeve */}
        <path d="M 12 32 L 28 16 L 36 32 L 22 50 Z" fill={primary} />
        <path d="M 12 32 L 28 16 L 36 32 L 22 50 Z" fill="url(#sleeve-left-shade)" />
        <path d="M 12 32 L 15 36 L 22 50 M 12 32" stroke={secondary} strokeWidth="3.5" strokeLinecap="round" />

        {/* Right Sleeve */}
        <path d="M 88 32 L 72 16 L 64 32 L 78 50 Z" fill={primary} />
        <path d="M 88 32 L 72 16 L 64 32 L 78 50 Z" fill="url(#sleeve-right-shade)" />
        <path d="M 88 32 L 85 36 L 78 50" stroke={secondary} strokeWidth="3.5" strokeLinecap="round" />

        {/* Main Jersey Torso */}
        <path d="M 28 16 L 72 16 L 75 98 L 25 98 Z" fill={primary} />

        {/* Collar in secondary color */}
        <path d="M 42 16 L 50 30 L 58 16 Z" fill={secondary} />
        <path d="M 38 16 L 50 33 L 62 16" fill="none" stroke={secondary} strokeWidth="2.5" />

        {/* 3D shading overlay on Torso */}
        <path d="M 28 16 L 72 16 L 75 98 L 25 98 Z" fill="url(#jersey-3d-shading)" style={{ mixBlendMode: 'multiply' }} />

        {/* Side athletic stripes */}
        <path d="M 26 50 L 25.5 80" stroke={secondary} strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />
        <path d="M 74 50 L 74.5 80" stroke={secondary} strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />

        {/* Jersey Number */}
        {number !== undefined && (
          <text
            x="50"
            y="66"
            fontFamily="'Barlow Condensed', 'Archivo Black', Impact, sans-serif"
            fontSize="26"
            fontWeight="900"
            fill="#ffffff"
            textAnchor="middle"
            opacity="0.95"
            style={{ textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}
          >
            {number}
          </text>
        )}

        {/* Initials Badge at chest */}
        <g transform="translate(37, 26)">
          <circle cx="0" cy="0" r="7.5" fill="rgba(255, 255, 255, 0.15)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" />
          <text x="0" y="2.5" fontFamily="'Barlow Condensed', sans-serif" fontSize="7.5" fontWeight="900" fill="#ffffff" textAnchor="middle">
            {initials}
          </text>
        </g>

        {/* Gold star above collar for Morocco */}
        {nationId === 'marruecos' && (
          <polygon points="50,6 52,9 56,9 53,11 54,14 50,12 46,14 47,11 44,9 48,9" fill="#f3c95d" />
        )}
      </svg>
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
