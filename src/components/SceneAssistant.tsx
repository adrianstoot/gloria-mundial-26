import { BrainCircuit, CheckCircle2, ChevronRight, ShieldAlert, Sparkles } from 'lucide-react'
import type { AssistantAdvice } from '../features/experienceDirector'

export function SceneAssistant({ advice, step, total = 6, totalSteps, title, onAction }: { advice: AssistantAdvice; step: number; total?: number; totalSteps?: number; title?: string; onAction?: () => void }) {
  const stageTotal = totalSteps ?? total
  return (
    <section className={`scene-assistant scene-assistant--${advice.priority}`}>
      <div className="scene-assistant__identity"><span><BrainCircuit /></span><small>ASISTENTE TÉCNICO VIRTUAL</small><b>Álex Vega</b><em>Confianza del informe · {advice.confidence}%</em></div>
      <div className="scene-assistant__brief">
        <span>{advice.priority === 'critical' ? <ShieldAlert /> : <Sparkles />} {advice.context} · PASO {step}/{stageTotal}</span>
        <h3>{title ?? advice.recommendation}</h3><p>{title ? `${advice.recommendation} ${advice.diagnosis}` : advice.diagnosis}</p>
        <div><small><CheckCircle2 /> BENEFICIO</small><b>{advice.benefit}</b><small><ShieldAlert /> RIESGO</small><b>{advice.risk}</b></div>
      </div>
      {onAction && <button onClick={onAction}>{advice.actions[0]?.label ?? 'Continuar'} <ChevronRight /></button>}
    </section>
  )
}
