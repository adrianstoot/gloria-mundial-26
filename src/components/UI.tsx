import type { ReactNode } from 'react'
import { ChevronRight, Info } from 'lucide-react'

export function Metric({ label, value, detail, tone = 'cyan' }: { label: string; value: string | number; detail?: string; tone?: 'cyan' | 'gold' | 'green' | 'red' }) {
  return (
    <div className={`metric metric--${tone}`}>
      <span className="metric__label">{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </div>
  )
}

export function Progress({ value, tone = 'cyan', label }: { value: number; tone?: 'cyan' | 'gold' | 'green' | 'red'; label?: string }) {
  return (
    <span className="progress" aria-label={label} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value}>
      <span className={`progress__fill progress__fill--${tone}`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </span>
  )
}

export function Panel({ title, eyebrow, action, children, className = '' }: { title?: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      {(title || eyebrow || action) && (
        <header className="panel__header">
          <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}{title && <h2>{title}</h2>}</div>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function TaskRow({ icon, title, meta, status, onClick }: { icon?: ReactNode; title: string; meta: string; status?: string; onClick?: () => void }) {
  const content = (
    <>
      <span className="task-row__icon">{icon ?? <Info size={18} />}</span>
      <span className="task-row__copy"><b>{title}</b><small>{meta}</small></span>
      {status && <span className="task-row__status">{status}</span>}
      {onClick && <ChevronRight size={17} />}
    </>
  )
  return onClick ? <button className="task-row task-row--button" onClick={onClick}>{content}</button> : <div className="task-row">{content}</div>
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: readonly T[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => <button key={option} className={value === option ? 'is-active' : ''} onClick={() => onChange(option)}>{option}</button>)}
    </div>
  )
}

export function EmptyState({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
  return <div className="empty-state"><Info size={28} /><h3>{title}</h3><p>{text}</p>{action}</div>
}

