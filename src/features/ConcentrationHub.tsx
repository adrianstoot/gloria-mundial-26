import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Activity, BedDouble, Brain, Building2, Check, ChevronLeft, ChevronRight, Clock3,
  Dumbbell, Gauge, Heart, MapPin, Plane, Radio, ShieldCheck, Sparkles, Stethoscope, Sun, Users, Utensils, Zap,
} from 'lucide-react'
import { useGame } from '../App'
import { Metric, Panel, Progress } from '../components/UI'
import { uiNations } from './ui-model'
import { applyCampDecision, teamReadiness } from './decisionEngine'
import { dailyDecisionGroups, hotels, leisureActivities, trainingExercises, type DailyDecisionType, type MetricEffects } from './concentrationData'
import { SceneAssistant } from '../components/SceneAssistant'
import { buildAssistantAdvice } from './experienceDirector'

type Tab = 'hotel' | 'training' | 'leisure' | 'operations' | 'mindset'

const metricNames: Record<string, string> = {
  morale: 'Moral', federation: 'Federación', cohesion: 'Cohesión', fatigue: 'Fatiga', pressure: 'Presión',
  tacticalFamiliarity: 'Familiaridad', climateAdaptation: 'Clima', localSupport: 'Apoyo', recovery: 'Recuperación',
}

function EffectChips({ effects, limit }: { effects: MetricEffects; limit?: number }) {
  return <div className="effect-chips">{Object.entries(effects).slice(0, limit).map(([metric, value]) => (
    <span key={metric} className={Number(value) >= 0 ? 'is-positive' : 'is-negative'}>{metricNames[metric]} {Number(value) > 0 ? '+' : ''}{value}</span>
  ))}</div>
}

export function ConcentrationHub() {
  const { campaign, updateCampaign } = useGame()
  const [searchParams] = useSearchParams()
  const requestedTab = searchParams.get('seccion')
  const [tab, setTab] = useState<Tab>(requestedTab === 'training' ? 'training' : 'hotel')
  const [previewHotelId, setPreviewHotelId] = useState(campaign.hotelId || 'atlantic-performance')
  const [trainingPage, setTrainingPage] = useState(0)
  const [leisurePage, setLeisurePage] = useState(0)
  const nation = uiNations.find((item) => item.id === campaign.nationId)
  const countryHotels = useMemo(() => hotels.filter((hotel) => nation && hotel.nationCodes.includes(nation.code) && ['atlantic-performance', 'dallas-central', 'secluded-mountain'].includes(hotel.id)), [nation])
  const selectedHotel = hotels.find((hotel) => hotel.id === campaign.hotelId)
  const trainingKey = `training:${campaign.date}:primary`
  const leisureKey = `leisure:${campaign.date}`
  const todayTraining = campaign.decisionLog.find((item) => item.key === trainingKey)
  const todayLeisure = campaign.decisionLog.find((item) => item.key === leisureKey)
  const readiness = teamReadiness(campaign)
  const hotelOptions = countryHotels
  const previewHotel = hotelOptions.find((hotel) => hotel.id === previewHotelId) ?? hotelOptions[0]
  const trainingOptions = trainingExercises.slice(trainingPage * 3, trainingPage * 3 + 3)
  const leisureOptions = leisureActivities.slice(leisurePage * 3, leisurePage * 3 + 3)
  useEffect(() => {
    if (requestedTab === 'training') setTab('training')
    if (requestedTab === 'hotel') setTab('hotel')
  }, [requestedTab])
  const featureCopy = {
    hotel: { eyebrow: 'BASE DE OPERACIONES', title: 'La casa de tu Mundial', text: 'Privacidad, clima, viajes y conexión con la grada: la elección empieza a decidir partidos antes del primer saque.' },
    training: { eyebrow: 'CAMPO DE ENTRENAMIENTO', title: 'Cada repetición deja memoria', text: 'La carga, la recuperación y los automatismos se trasladan al motor de partido y al riesgo físico del grupo.' },
    leisure: { eyebrow: 'FUERA DEL CÉSPED', title: 'También se compite al desconectar', text: 'Familia, comunidad, descanso y convivencia cambian el estado emocional y físico del vestuario.' },
    operations: { eyebrow: 'LAS HORAS INVISIBLES', title: 'Veinte decisiones antes de competir', text: 'Recuperación, nutrición, medios, viaje y liderazgo forman el contexto con el que cada futbolista llega al partido.' },
    mindset: { eyebrow: 'LECTURA DEL VESTUARIO', title: 'La presión nunca es invisible', text: 'Moral, jerarquías, ruido exterior, apoyo local y confianza alteran las decisiones de cada futbolista.' },
  }[tab]

  const decide = (type: 'hotel' | 'training' | 'leisure' | DailyDecisionType, key: string, label: string, effects: MetricEffects) => {
    updateCampaign((current) => applyCampDecision(current, { key, type, label, effects, madeAt: current.date }))
  }

  return <div className="concentration-page page-enter">
    {!campaign.prologueComplete && (tab === 'hotel' || tab === 'training') && <SceneAssistant advice={buildAssistantAdvice(campaign, tab === 'hotel' ? 'hotel' : 'training')} step={tab === 'hotel' ? 2 : 3} />}
    <section className="page-heading concentration-heading">
      <div><span className="eyebrow"><Building2 /> CONCENTRACIÓN 2026</span><h2>Cada detalle <em>llega al césped</em></h2><p>El alojamiento, la carga de trabajo y el tiempo libre alteran el estado real con el que tu selección compite.</p></div>
      <div className="heading-metrics"><Metric label="PREPARACIÓN" value={`${readiness}%`} tone={readiness >= 75 ? 'green' : 'gold'} /><Metric label="FATIGA" value={`${campaign.fatigue}%`} tone={campaign.fatigue > 55 ? 'red' : 'cyan'} /><Metric label="PRESIÓN" value={`${campaign.pressure}%`} tone={campaign.pressure > 65 ? 'red' : 'gold'} /></div>
    </section>

    <nav className="page-tabs camp-tabs" aria-label="Decisiones de concentración">
      <button className={tab === 'hotel' ? 'is-active' : ''} onClick={() => setTab('hotel')}><BedDouble /> Hotel y base</button>
      <button className={tab === 'training' ? 'is-active' : ''} onClick={() => setTab('training')}><Dumbbell /> Ejercicios</button>
      <button className={tab === 'leisure' ? 'is-active' : ''} onClick={() => setTab('leisure')}><Sun /> Tiempo libre</button>
      <button className={tab === 'operations' ? 'is-active' : ''} onClick={() => setTab('operations')}><Sparkles /> Decisiones del día</button>
      <button className={tab === 'mindset' ? 'is-active' : ''} onClick={() => setTab('mindset')}><Brain /> Mentalidad</button>
    </nav>

    <section className={`camp-feature-visual camp-feature-visual--${tab}`}>
      <div><span className="eyebrow"><Sparkles /> {featureCopy.eyebrow}</span><h3>{featureCopy.title}</h3><p>{featureCopy.text}</p></div>
      <small>IMAGEN EDITORIAL ORIGINAL · GLORIA MUNDIAL 26</small>
    </section>

    {tab === 'hotel' && <div className="camp-section">
      <Panel eyebrow="DECISIÓN ESTRATÉGICA" title={selectedHotel ? `Base elegida: ${selectedHotel.name}` : '¿Dónde vivirá el equipo?'}>
        <div className="hotel-choice-intro"><span><Building2/></span><div><small>POR QUÉ IMPORTA</small><b>Esta será la casa de los 26 durante todo el Mundial.</b><p>La distancia cambia la fatiga; el clima cambia la adaptación; la privacidad y el apoyo cambian presión, moral y cohesión.</p></div></div>
        <div className="hotel-grid">{hotelOptions.map((hotel) => {
          const selected = campaign.hotelId === hotel.id
          const previewed = previewHotel?.id === hotel.id
          const visual = hotel.visual?.startsWith('/') ? `${import.meta.env.BASE_URL}${hotel.visual.slice(1)}` : hotel.visual
          return <button key={hotel.id} className={`hotel-card ${selected ? 'is-selected' : ''} ${previewed ? 'is-previewed' : ''}`} style={{ '--hotel-visual': `url(${visual})` } as React.CSSProperties} disabled={Boolean(campaign.hotelId)} onClick={() => setPreviewHotelId(hotel.id)}>
            <div className="hotel-card__visual"><span><MapPin/> {hotel.location}</span>{selected && <em><Check/> BASE ELEGIDA</em>}</div>
            <header><small>{hotel.identity}</small><h3>{hotel.name}</h3></header>
            <p>{hotel.profile}</p>
            <div className="hotel-card__tradeoff"><b>VENTAJA</b><span>{hotel.climate}</span><b>COSTE</b><span>{hotel.tradeoff}</span></div>
            <EffectChips effects={hotel.effects} limit={3} />
            <strong>{previewed ? <><Check/> SELECCIONADA</> : <>VER ESTA BASE <ChevronRight/></>}</strong>
          </button>
        })}</div>
        <div className="hotel-confirm-bar"><span><ShieldCheck/><b>{previewHotel?.name}</b><small>{previewHotel?.identity} · La decisión queda fijada para la campaña.</small></span><button disabled={Boolean(campaign.hotelId) || !previewHotel} onClick={() => previewHotel && decide('hotel', `hotel:${previewHotel.id}`, previewHotel.name, previewHotel.effects)}>{campaign.hotelId ? 'BASE CONFIRMADA' : 'CONFIRMAR ESTA BASE'} <ChevronRight/></button></div>
      </Panel>
    </div>}

    {tab === 'training' && <div className="camp-section camp-two-columns">
      <Panel eyebrow={`SESIÓN PRINCIPAL · ${campaign.date}`} title={todayTraining ? `Plan confirmado: ${todayTraining.label}` : 'Elige el ejercicio del día'}>
        <div className="cinematic-option-nav"><span>EJERCICIOS {trainingPage * 3 + 1}–{Math.min(trainingExercises.length, trainingPage * 3 + 3)} DE {trainingExercises.length}</span><div><button disabled={trainingPage === 0} onClick={() => setTrainingPage((value) => value - 1)}><ChevronLeft /></button><button disabled={(trainingPage + 1) * 3 >= trainingExercises.length} onClick={() => setTrainingPage((value) => value + 1)}><ChevronRight /></button></div></div>
        <div className="exercise-grid">{trainingOptions.map((exercise) => <button key={exercise.id} disabled={Boolean(todayTraining)} className={todayTraining?.label === exercise.name ? 'is-selected' : ''} onClick={() => decide('training', trainingKey, exercise.name, exercise.effects)}>
          <span className={`exercise-icon exercise-icon--${exercise.category}`}>{exercise.category === 'recovery' ? <Heart /> : exercise.category === 'physical' ? <Activity /> : exercise.category === 'tactical' ? <Brain /> : exercise.category === 'set-pieces' ? <Zap /> : <Dumbbell />}</span>
          <span><small>{exercise.category.toUpperCase()} · INTENSIDAD {exercise.intensity.toUpperCase()}</small><b>{exercise.name}</b><p>{exercise.description}</p><em><Clock3 /> {exercise.duration}</em><EffectChips effects={exercise.effects} /></span>
          {todayTraining?.label === exercise.name && <Check />}
        </button>)}</div>
      </Panel>
      <aside><Panel eyebrow="LECTURA DEL CUERPO TÉCNICO" title="Carga proyectada"><div className="readiness-radar"><span style={{ '--readiness': `${readiness * 3.6}deg` } as React.CSSProperties}><b>{readiness}</b><small>PREPARACIÓN</small></span></div><div className="metric-stack"><div><span>Fatiga</span><b>{campaign.fatigue}%</b><Progress value={campaign.fatigue} tone={campaign.fatigue > 55 ? 'red' : 'gold'} /></div><div><span>Familiaridad</span><b>{campaign.tacticalFamiliarity}%</b><Progress value={campaign.tacticalFamiliarity} tone="cyan" /></div><div><span>Recuperación</span><b>{campaign.recovery}%</b><Progress value={campaign.recovery} tone="green" /></div></div><p className="coach-warning"><Gauge /> Una sesión intensa mejora automatismos, pero con fatiga alta aumenta el riesgo y reduce la ejecución.</p></Panel></aside>
    </div>}

    {tab === 'leisure' && <div className="camp-section">
      <Panel eyebrow={`TARDE LIBRE · ${campaign.date}`} title={todayLeisure ? `Actividad confirmada: ${todayLeisure.label}` : '¿Qué hará el grupo fuera del campo?'}>
        <div className="fan-zone-callout">
          <span><Sparkles /></span>
          <div><small>TERMÓMETRO DE LA CALLE</small><b>{campaign.localSupport >= 70 ? 'La ciudad ya juega con vosotros' : campaign.localSupport >= 52 ? 'El apoyo local está creciendo' : 'Todavía hay que conquistar a la sede'}</b><p>La actividad elegida modifica el vínculo con la afición, la presión exterior, la fatiga y el estado emocional del vestuario.</p></div>
          <strong>{campaign.localSupport}<small>/100 APOYO</small></strong>
        </div>
        <div className="cinematic-option-nav"><span>ACTIVIDADES {leisurePage * 3 + 1}–{Math.min(leisureActivities.length, leisurePage * 3 + 3)} DE {leisureActivities.length}</span><div><button disabled={leisurePage === 0} onClick={() => setLeisurePage((value) => value - 1)}><ChevronLeft /></button><button disabled={(leisurePage + 1) * 3 >= leisureActivities.length} onClick={() => setLeisurePage((value) => value + 1)}><ChevronRight /></button></div></div>
        <div className="leisure-grid">{leisureOptions.map((activity) => <button key={activity.id} disabled={Boolean(todayLeisure)} className={todayLeisure?.label === activity.name ? 'is-selected' : ''} onClick={() => decide('leisure', leisureKey, activity.name, activity.effects)}>
          <span className="leisure-icon">{activity.id.includes('family') ? <Users /> : activity.id.includes('recovery') || activity.id.includes('rest') ? <Heart /> : activity.id.includes('video') ? <Brain /> : <Sparkles />}</span>
          <span><b>{activity.name}</b><p>{activity.description}</p><small><Clock3 /> {activity.duration}</small><EffectChips effects={activity.effects} /></span>{todayLeisure?.label === activity.name && <Check />}
        </button>)}</div>
      </Panel>
    </div>}

    {tab === 'operations' && <div className="camp-section">
      <Panel eyebrow={`CENTRO DE DECISIONES · ${campaign.date}`} title="Todo lo que ocurre fuera de los focos">
        <div className="daily-operations-grid">{dailyDecisionGroups.map((group) => {
          const prefix = `${group.id}:${campaign.date}:`
          const selected = campaign.decisionLog.find((decision) => decision.key.startsWith(prefix))
          const GroupIcon = group.id === 'recovery' ? Stethoscope : group.id === 'nutrition' ? Utensils : group.id === 'media' ? Radio : group.id === 'operations' ? Plane : Users
          return <section key={group.id} className={`daily-decision-group daily-decision-group--${group.id}`}>
            <header><span><GroupIcon /></span><div><small>{selected ? 'DECISIÓN CONFIRMADA' : 'PENDIENTE HOY'}</small><h3>{group.name}</h3><p>{group.description}</p></div></header>
            <div>{group.options.map((option) => <button key={option.id} disabled={Boolean(selected)} className={selected?.label === option.name ? 'is-selected' : ''} onClick={() => decide(group.id, `${prefix}${option.id}`, option.name, option.effects)}>
              <span><b>{option.name}</b><small><Clock3 /> {option.duration}</small></span><p>{option.description}</p><EffectChips effects={option.effects} />{selected?.label === option.name && <Check />}
            </button>)}</div>
          </section>
        })}</div>
        <div className="decision-note"><ShieldCheck /> Cada bloque solo puede decidirse una vez al día. Sus efectos quedan en el historial, viajan al entorno del partido y alteran preparación, presión y fatiga.</div>
      </Panel>
    </div>}

    {tab === 'mindset' && <div className="camp-section mindset-layout">
      <Panel eyebrow="ESTADO VIVO" title="La mentalidad del vestuario"><div className="mindset-score"><span style={{ '--readiness': `${readiness * 3.6}deg` } as React.CSSProperties}><b>{readiness}</b><small>ÍNDICE GLOBAL</small></span><div><h3>{readiness >= 82 ? 'Preparados para competir' : readiness >= 68 ? 'Evolución positiva' : 'Equilibrio frágil'}</h3><p>No es un bonus artificial: estas métricas modifican condición, fatiga, moral, decisiones y familiaridad de los jugadores en el motor.</p></div></div><div className="mindset-metrics">{[
        ['Moral', campaign.morale, 'green'], ['Cohesión', campaign.cohesion, 'cyan'], ['Familiaridad', campaign.tacticalFamiliarity, 'cyan'], ['Recuperación', campaign.recovery, 'green'], ['Adaptación climática', campaign.climateAdaptation, 'gold'], ['Apoyo local', campaign.localSupport, 'gold'], ['Presión', campaign.pressure, 'red'], ['Fatiga', campaign.fatigue, 'red'],
      ].map(([label, value, tone]) => <div key={String(label)}><span>{label}</span><b>{value}%</b><Progress value={Number(value)} tone={tone as 'green' | 'cyan' | 'gold' | 'red'} /></div>)}</div></Panel>
      <Panel eyebrow="DIARIO DE DECISIONES" title="Cómo has llegado hasta aquí"><div className="decision-log">{campaign.decisionLog.length ? [...campaign.decisionLog].reverse().map((decision) => <article key={decision.key}><span><Check /></span><div><small>{decision.madeAt} · {decision.type.toUpperCase()}</small><b>{decision.label}</b><EffectChips effects={decision.effects} /></div></article>) : <p className="empty-copy">Todavía no has tomado decisiones de concentración.</p>}</div></Panel>
    </div>}
  </div>
}
