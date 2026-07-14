import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Activity, ArrowLeft, ArrowRight, Award, BrainCircuit, BriefcaseBusiness, Check, ChevronLeft,
  ChevronRight, CircleHelp, Crown, Globe2, GraduationCap, HeartHandshake, Shield, Sparkles,
  Star, Target, UserRound,
} from 'lucide-react'
import { Brand } from '../components/Brand'
import { Flag } from '../components/Flag'
import { Progress } from '../components/UI'
import { useGame } from '../App'
import { playersFor, uiNations } from './ui-model'
import { PLAYABLE_NATION_CODES } from './concentrationData'
import { applyCoachModifiers, coachProfiles } from './coachProfiles'

const PLAYABLE_NATION_CODE_SET = new Set<string>(PLAYABLE_NATION_CODES)

function OnboardingFrame({ step, children, onBack }: { step: number; children: React.ReactNode; onBack: () => void }) {
  return (
    <main className="onboarding">
      <header className="onboarding__topbar">
        <button className="back-link" onClick={onBack}><ArrowLeft size={17} /> VOLVER</button>
        <Brand compact />
        <button className="help-link" onClick={() => window.alert('Completa los tres pasos para iniciar la campaña. Después podrás abrir el tutorial contextual de 12 capítulos en cualquier momento.')}><CircleHelp size={17} /> AYUDA</button>
      </header>
      <div className="onboarding__steps" aria-label={`Paso ${step} de 3`}>
        {[1, 2, 3].map((item) => <span key={item} className={item <= step ? 'is-active' : ''}><i>{item < step ? <Check size={12} /> : item}</i><b>{item === 1 ? 'Seleccionador' : item === 2 ? 'Tu selección' : 'Preparación'}</b></span>)}
      </div>
      {children}
    </main>
  )
}

export function ManagerSetup() {
  const navigate = useNavigate()
  const { campaign, updateCampaign } = useGame()
  const [profile, setProfile] = useState(campaign.manager)
  const coachIndex = Math.max(0, coachProfiles.findIndex((coach) => coach.id === profile.coachId))
  const coach = coachProfiles[coachIndex]
  const valid = profile.name.trim().length >= 2 && profile.surname.trim().length >= 2 && Boolean(coach)

  const moveCoach = (direction: number) => {
    const next = (coachIndex + direction + coachProfiles.length) % coachProfiles.length
    setProfile((current) => ({ ...current, coachId: coachProfiles[next].id }))
  }

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!valid || !coach) return
    const adjusted = applyCoachModifiers(campaign, coach.id, campaign.coachAppliedId)
    updateCampaign({
      manager: { ...profile, name: profile.name.trim(), surname: profile.surname.trim() },
      coachAppliedId: coach.id,
      ...adjusted,
    })
    navigate('/elegir-seleccion')
  }

  return (
    <OnboardingFrame step={1} onBack={() => navigate('/')}>
      <section className="setup-page">
        <section
          className={`coach-picker coach-picker--${coach.accent}`}
          aria-label="Elige tu perfil de entrenador"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); moveCoach(-1) }
            if (event.key === 'ArrowRight') { event.preventDefault(); moveCoach(1) }
          }}
        >
          <header className="coach-picker__heading">
            <span className="eyebrow"><Sparkles size={14} /> TU IDENTIDAD EN EL BANQUILLO</span>
            <div><h1>Elige tu <em>entrenador</em></h1><small>{coachIndex + 1} / {coachProfiles.length}</small></div>
          </header>
          <div className="coach-carousel">
            <button type="button" className="coach-carousel__arrow" onClick={() => moveCoach(-1)} aria-label="Entrenador anterior"><ChevronLeft /></button>
            <article className="coach-card" aria-live="polite">
              <img src={coach.visual} alt={`Retrato ficticio de ${coach.name}`} />
              <div className="coach-card__shade" />
              <div className="coach-card__identity"><small>{coach.origin}</small><h2>{coach.name}</h2><b>{coach.archetype}</b></div>
            </article>
            <button type="button" className="coach-carousel__arrow" onClick={() => moveCoach(1)} aria-label="Entrenador siguiente"><ChevronRight /></button>
          </div>
          <nav className="coach-picker__dots" aria-label="Perfiles disponibles">
            {coachProfiles.map((item, index) => <button type="button" key={item.id} className={item.id === coach.id ? 'is-selected' : ''} onClick={() => setProfile((current) => ({ ...current, coachId: item.id }))} aria-label={`Elegir a ${item.name}`} aria-current={item.id === coach.id}><span>{index + 1}</span></button>)}
          </nav>
          <p className="coach-picker__philosophy">{coach.philosophy}</p>
          <div className="coach-indicators">
            {coach.indicators.map((indicator) => <span key={indicator.label}><small>{indicator.label}</small><b>{indicator.value}</b><i><em style={{ width: `${indicator.value}%` }} /></i></span>)}
          </div>
          <div className="coach-tradeoffs"><span><BrainCircuit /><small>FORTALEZA</small><b>{coach.strength}</b></span><span><Activity /><small>RIESGO</small><b>{coach.risk}</b></span></div>
        </section>
        <form className="setup-form panel" onSubmit={submit}>
          <header className="setup-form__title"><span className="eyebrow"><UserRound /> PERFIL DEL SELECCIONADOR</span><h2>Firma tu <em>historia</em></h2><p>Tu nombre, experiencia y filosofía definirán cómo te recibe el vestuario.</p></header>
          <div className="form-heading"><span>01</span><div><h2>Identidad</h2><p>Así te conocerán jugadores y periodistas.</p></div></div>
          <div className="form-grid">
            <label><span>Nombre</span><input autoFocus value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Adrián" maxLength={24} /></label>
            <label><span>Apellidos</span><input value={profile.surname} onChange={(event) => setProfile({ ...profile, surname: event.target.value })} placeholder="García" maxLength={30} /></label>
            <label className="form-grid__wide"><span>Nacionalidad</span><select value={profile.nationality} onChange={(event) => setProfile({ ...profile, nationality: event.target.value })}><option>España</option><option>Argentina</option><option>México</option><option>Colombia</option><option>Estados Unidos</option><option>Francia</option><option>Brasil</option><option>Otro país</option></select></label>
          </div>
          <div className="form-heading"><span>02</span><div><h2>Tu experiencia</h2><p>Adapta los consejos y la exigencia inicial.</p></div></div>
          <div className="experience-grid">
            {([
              ['novato', GraduationCap, 'Debutante', 'Tutorial completo y avisos en cada decisión.'],
              ['profesional', BriefcaseBusiness, 'Profesional', 'Consejos clave sin interrumpir tu ritmo.'],
              ['leyenda', Crown, 'Leyenda', 'Control total desde el primer minuto.'],
            ] as const).map(([value, Icon, title, text]) => (
              <button type="button" key={value} className={profile.experience === value ? 'is-selected' : ''} onClick={() => setProfile({ ...profile, experience: value })}>
                <Icon /><b>{title}</b><small>{text}</small>{profile.experience === value && <Check className="experience-grid__check" size={15} />}
              </button>
            ))}
          </div>
          <div className="setup-form__footer"><span>{valid ? <><Check /> Perfil listo · {coach.name}</> : 'Completa nombre y apellidos'}</span><button className="button button--gold" disabled={!valid}>ELEGIR SELECCIÓN <ArrowRight /></button></div>
        </form>
      </section>
    </OnboardingFrame>
  )
}

export function NationSelect() {
  const navigate = useNavigate()
  const { campaign, updateCampaign } = useGame()
  const defaultPlayable = uiNations.find((nation) => nation.code === 'ESP') ?? uiNations.find((nation) => PLAYABLE_NATION_CODE_SET.has(nation.code))
  const [selectedId, setSelectedId] = useState(
    uiNations.some((nation) => nation.id === campaign.nationId && PLAYABLE_NATION_CODE_SET.has(nation.code))
      ? campaign.nationId
      : defaultPlayable?.id,
  )
  const [difficulty, setDifficulty] = useState(campaign.difficulty)
  const [selectionError, setSelectionError] = useState('')
  const selected = uiNations.find((nation) => nation.id === selectedId) ?? uiNations[0]
  const playableNations = uiNations.filter((nation) => PLAYABLE_NATION_CODE_SET.has(nation.code))
  const selectedIndex = Math.max(0, playableNations.findIndex((nation) => nation.id === selectedId))

  const moveNation = (direction: number) => {
    const next = (selectedIndex + direction + playableNations.length) % playableNations.length
    setSelectedId(playableNations[next]?.id)
    setSelectionError('')
  }

  const confirm = () => {
    if (!selected || !PLAYABLE_NATION_CODE_SET.has(selected.code)) {
      setSelectionError('Selecciona una de las cinco selecciones disponibles para continuar.')
      return
    }
    updateCampaign({
      nationId: selected.id,
      difficulty,
      squadIds: [],
      squadConfirmed: false,
      shirtNumbers: {},
      tutorialComplete: true,
    })
    navigate('/juego/convocatoria?guia=1')
  }

  return (
    <OnboardingFrame step={2} onBack={() => navigate('/crear-seleccionador')}>
      <section className="nation-page">
        <header className="nation-page__title"><span className="eyebrow"><Globe2 size={14} /> 48 CAMINOS HACIA LA GLORIA</span><h1>Elige la nación que <em>hará historia</em></h1><p>España, Francia, Marruecos, Inglaterra y Argentina son dirigibles; las otras 43 compiten con una IA completa.</p></header>
        <div className="nation-page__layout">
          <section className="nation-browser nation-browser--console" onKeyDown={(event) => {
            if (event.key === 'ArrowLeft') { event.preventDefault(); moveNation(-1) }
            if (event.key === 'ArrowRight') { event.preventDefault(); moveNation(1) }
          }}>
            <span className="nation-browser__label">SELECCIONES JUGABLES</span>
            <div className="nation-carousel" role="listbox" aria-label="Selecciones jugables" tabIndex={0}>
              <button className="nation-carousel__arrow" onClick={() => moveNation(-1)} aria-label="Selección anterior"><ChevronLeft /></button>
              <div className="nation-carousel__track">
                {[-1, 0, 1].map((offset) => {
                  const nation = playableNations[(selectedIndex + offset + playableNations.length) % playableNations.length]
                  const active = offset === 0
                  return (
                    <button key={`${nation.id}-${offset}`} role="option" aria-selected={active} className={`nation-choice nation-choice--${offset < 0 ? 'previous' : offset > 0 ? 'next' : 'active'} ${active ? 'is-selected' : ''}`} onClick={() => active ? undefined : setSelectedId(nation.id)} title={`Dirigir a ${nation.name}`}>
                      <span className="nation-choice__wash" style={{ background: `linear-gradient(145deg, ${nation.primaryColor}, ${nation.secondaryColor})` }} />
                      <Flag code={nation.flagCode} label={nation.name} size="lg" shape="square" />
                      <span className="nation-choice__copy"><small>GRUPO {nation.group} · #{nation.worldRanking}</small><b>{nation.name}</b>{active && <em>{nation.style}</em>}</span>
                      {active && <Check className="nation-choice__check" />}
                    </button>
                  )
                })}
              </div>
              <button className="nation-carousel__arrow" onClick={() => moveNation(1)} aria-label="Selección siguiente"><ChevronRight /></button>
            </div>
            <nav className="nation-carousel__dots" aria-label="Ir a una selección">{playableNations.map((nation, index) => <button key={nation.id} className={index === selectedIndex ? 'is-selected' : ''} onClick={() => setSelectedId(nation.id)} aria-label={`Mostrar ${nation.name}`}><span>{index + 1}</span></button>)}</nav>
            <footer><b>43 RIVALES DIRIGIDOS POR IA</b><span>El torneo completo evoluciona alrededor de tu campaña.</span></footer>
          </section>
          {selected && (
            <aside className="nation-detail" style={{ '--team-primary': selected.primaryColor, '--team-secondary': selected.secondaryColor } as React.CSSProperties}>
              <div className="nation-detail__hero"><span className={`fi fi-${selected.flagCode}`} /><div className="nation-detail__halo" /><Flag code={selected.flagCode} label={selected.name} size="lg" shape="square" /><small>GRUPO {selected.group}</small><h2>{selected.name}</h2><p>{selected.confederation}</p></div>
              <div className="nation-detail__stats"><div><span>RANKING</span><b>#{selected.worldRanking}</b></div><div><span>NIVEL</span><b>{selected.teamRating}</b></div><div><span>CANDIDATOS</span><b>{playersFor(selected.id).length}</b></div></div>
              <div className="nation-detail__body">
                <div className="nation-detail__section"><span className="detail-label">IDENTIDAD TÁCTICA</span><b className="style-pill"><Target /> {selected.style}</b><p>Una base reconocible que podrás transformar desde el primer entrenamiento.</p></div>
                <div className="nation-detail__section"><span className="detail-label">EXPECTATIVA NACIONAL</span><div className="expectation"><Award /><span><b>{selected.teamRating >= 85 ? 'Luchar por el título' : selected.teamRating >= 78 ? 'Alcanzar eliminatorias' : 'Competir sin miedo'}</b><small>La federación evaluará tu campaña</small></span></div></div>
                <div className="nation-detail__section"><span className="detail-label">DIFICULTAD</span><div className="difficulty-buttons">{(['accesible', 'realista', 'leyenda'] as const).map((value) => <button key={value} className={difficulty === value ? 'is-active' : ''} onClick={() => setDifficulty(value)}>{value === 'accesible' ? <Shield /> : value === 'realista' ? <Star /> : <Crown />}<span><b>{value}</b><small>{value === 'accesible' ? 'Más orientación' : value === 'realista' ? 'Equilibrio total' : 'Máxima presión'}</small></span></button>)}</div></div>
              </div>
              <footer className="nation-detail__footer"><span className={selectionError ? 'is-error' : ''}>{selectionError || <><HeartHandshake /> {selected.name} espera tu decisión</>}</span><button className="button button--gold button--wide" onClick={confirm}>ENTRAR AL VESTUARIO <ChevronRight /></button></footer>
            </aside>
          )}
        </div>
      </section>
    </OnboardingFrame>
  )
}

const tutorialSteps = [
  { title: 'Tu centro de mando', text: 'Aquí empieza cada jornada. La bandeja reúne decisiones, noticias y consejos del cuerpo técnico.', target: 'Bandeja', icon: BriefcaseBusiness },
  { title: 'El tiempo nunca se detiene', text: 'CONTINUAR avanza el calendario. Antes, resolveremos juntos cualquier tarea obligatoria.', target: 'Continuar', icon: ArrowRight },
  { title: 'Elige a tus 26', text: 'Analiza 50 candidatos, compara su estado y registra una lista con al menos tres porteros.', target: 'Convocatoria', icon: UserRound },
  { title: 'Una base para competir', text: 'El hotel decide clima, recuperación, privacidad, viajes y apoyo local. La elección se fija para toda la campaña.', target: 'Concentración', icon: Award },
  { title: 'Cada sesión deja huella', text: 'Escoge ejercicios técnicos, tácticos, físicos, de recuperación o balón parado. La carga modifica fatiga y ejecución real.', target: 'Preparación', icon: GraduationCap },
  { title: 'También se entrena descansando', text: 'Familias, descanso, ciudad, vídeo o convivencia alteran presión, moral, cohesión y recuperación.', target: 'Concentración', icon: Sparkles },
  { title: 'Escucha al cuerpo médico', text: 'Condición, fatiga, lesiones y riesgo deben guiar tus cargas y la disponibilidad del once.', target: 'Centro médico', icon: Shield },
  { title: 'Dale una identidad', text: 'Elige entre diez formaciones, mueve posiciones, cambia roles y ajusta ritmo, pase, presión, línea y transición.', target: 'Tácticas', icon: Target },
  { title: 'Conoce al rival', text: 'El informe explica estructura, amenazas, oportunidades y contexto antes de fijar el plan del partido.', target: 'Preparación', icon: Globe2 },
  { title: 'Tu mensaje también juega', text: 'Los medios de tu país plantean preguntas de actualidad. Cada tono afecta al vestuario y la presión exterior.', target: 'Prensa', icon: Sparkles },
  { title: 'Decide durante el partido', text: 'Pausa, acelera, cambia futbolistas y observa cómo táctica, cansancio y decisiones producen cada evento.', target: 'Partido', icon: Crown },
  { title: 'Sigue el Mundial entero', text: 'Tablas, mejores terceros, cuadro, 104 partidos, estadísticas y ceremonia siguen vivos aunque tu selección caiga.', target: 'Mundial', icon: Award },
]

export function Tutorial() {
  const navigate = useNavigate()
  const { campaign, updateCampaign } = useGame()
  const [step, setStep] = useState(0)
  const nation = uiNations.find((item) => item.id === campaign.nationId)
  const item = tutorialSteps[step]
  const Icon = item.icon
  const finish = () => { updateCampaign({ tutorialComplete: true }); navigate('/juego') }

  return (
    <main className="tutorial-page">
      <header><Brand compact /><button className="text-button" onClick={finish}>SALTAR TUTORIAL</button></header>
      <div className="tutorial-demo" aria-hidden="true">
        <aside><Brand compact />{['Bandeja', 'Convocatoria', 'Concentración', 'Tácticas', 'Preparación', 'Centro médico', 'Prensa', 'Mundial'].map((label, index) => <span className={label === item.target ? 'is-highlighted' : ''} key={label}><i>{index + 1}</i>{label}</span>)}</aside>
        <section><div className="tutorial-demo__top"><span>25 MAY 2026</span><span className={`demo-continue ${item.target === 'Continuar' ? 'is-highlighted' : ''}`}>CONTINUAR <ChevronRight /></span></div><div className="tutorial-demo__cards"><div /><div /><div /></div><div className={`tutorial-demo__pitch ${item.target === 'Partido' || item.target === 'Tácticas' ? 'is-highlighted' : ''}`}><i /><i /><i /><i /><i /><i /><i /></div></section>
      </div>
      <section className="tutorial-card">
        <div className="tutorial-card__nation">{nation && <Flag code={nation.flagCode} label={nation.name} />}<span><small>BIENVENIDO, MÍSTER</small><b>{nation?.name}</b></span></div>
        <span className="tutorial-card__icon"><Icon /></span>
        <span className="eyebrow">PASO {step + 1} DE {tutorialSteps.length}</span>
        <h1>{item.title}</h1><p>{item.text}</p>
        <Progress value={((step + 1) / tutorialSteps.length) * 100} tone="gold" label="Progreso del tutorial" />
        <div className="tutorial-card__actions"><button className="button button--glass" disabled={step === 0} onClick={() => setStep((value) => value - 1)}><ArrowLeft /> ANTERIOR</button>{step < tutorialSteps.length - 1 ? <button className="button button--gold" onClick={() => setStep((value) => value + 1)}>SIGUIENTE <ArrowRight /></button> : <button className="button button--gold" onClick={finish}>ENTRAR A LA CONCENTRACIÓN <ChevronRight /></button>}</div>
      </section>
    </main>
  )
}
