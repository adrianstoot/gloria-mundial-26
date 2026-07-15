import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Globe2, ChevronLeft, ChevronRight, Play, Check, Swords, Trophy, BarChart3, HelpCircle } from 'lucide-react'
import { Flag } from '../components/Flag'
import { Brand } from '../components/Brand'
import { useGame } from '../App'
import { uiNations, defaultNation, playersFor } from './ui-model'
import { tournamentData, getOfficialSquad, type GroupId, type Nation, type TournamentFixture } from '../data'
import { deriveCampaignProgress } from './campaignProgress'

// Helper to slugify and match group keys
const GROUPS_KEYS: GroupId[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L']

function OnboardingFrame({ step, children, onBack }: { step: number; children: React.ReactNode; onBack: () => void }) {
  return (
    <main className="onboarding">
      <header className="onboarding__topbar">
        <button className="back-link" onClick={onBack}><ChevronLeft size={17} /> VOLVER</button>
        <Brand compact />
        <button className="help-link" onClick={() => window.alert('Mira el sorteo del mundial y su predicción antes de iniciar. Jugarás con los grupos sorteados en tu partida.')}><HelpCircle size={17} /> AYUDA</button>
      </header>
      <div className="onboarding__steps" aria-label={`Paso ${step} de 4`}>
        {[1, 2, 3, 4].map((item) => (
          <span key={item} className={item <= step ? 'is-active' : ''}>
            <i>{item === 1 ? <Check size={12} /> : item === 2 ? <Check size={12} /> : item}</i>
            <b>{item === 1 ? 'Seleccionador' : item === 2 ? 'Tu selección' : item === 3 ? 'Sorteo' : 'Preparación'}</b>
          </span>
        ))}
      </div>
      {children}
    </main>
  )
}

export function WorldCupDraw() {
  const navigate = useNavigate()
  const { campaign, updateCampaign } = useGame()
  const userNation = uiNations.find((item) => item.id === campaign.nationId) ?? uiNations[0]

  // Pots based on world ranking + hosts in Pot 1
  const sortedNations = useMemo(() => {
    return [...uiNations].sort((a, b) => a.worldRanking - b.worldRanking)
  }, [])

  const pots = useMemo(() => {
    const hosts = sortedNations.filter((n) => ['mex', 'can', 'usa'].includes(n.id))
    const nonHosts = sortedNations.filter((n) => !['mex', 'can', 'usa'].includes(n.id))

    // Pot 1: 3 hosts + top 9 non-hosts
    const pot1 = [...hosts, ...nonHosts.slice(0, 9)]
    const pot2 = nonHosts.slice(9, 21)
    const pot3 = nonHosts.slice(21, 33)
    const pot4 = nonHosts.slice(33, 45)

    return {
      1: pot1,
      2: pot2,
      3: pot3,
      4: pot4,
    }
  }, [sortedNations])

  // Screen states: 'idle', 'drawing', 'completed'
  const [drawState, setDrawState] = useState<'idle' | 'drawing' | 'completed'>('idle')
  // Active tab: 'grupos' or 'prediccion'
  const [tab, setTab] = useState<'grupos' | 'prediccion'>('grupos')

  // Drawn groups map
  const [drawnGroups, setDrawnGroups] = useState<Record<GroupId, Nation[]>>(() => {
    return Object.fromEntries(GROUPS_KEYS.map((g) => [g, []])) as unknown as Record<GroupId, Nation[]>
  })

  // Animation sequence steps
  const [animationSteps, setAnimationSteps] = useState<Array<{ group: GroupId; pot: number; nation: Nation }>>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(-1)
  const [simulatedResults, setSimulatedResults] = useState<any>(null)
  const [simulatedProgress, setSimulatedProgress] = useState<any>(null)
  const [isSimulating, setIsSimulating] = useState(false)

  // Animated draw display states
  const [activeDrawNation, setActiveDrawNation] = useState<Nation | null>(null)
  const [revealPhase, setRevealPhase] = useState<'idle' | 'spinning' | 'revealed'>('idle')
  const [spinningNation, setSpinningNation] = useState<Nation | null>(null)
  const [justLandedGroup, setJustLandedGroup] = useState<GroupId | null>(null)

  // Generate the draw sequence following real seeding & confederation rules
  const startDraw = () => {
    setDrawState('drawing')
    setCurrentStepIndex(-1)
    setSimulatedResults(null)
    setSimulatedProgress(null)
    setActiveDrawNation(null)
    setRevealPhase('idle')
    setSpinningNation(null)
    setJustLandedGroup(null)

    // Reset groups
    const newGroups = Object.fromEntries(GROUPS_KEYS.map((g) => [g, []])) as unknown as Record<GroupId, Nation[]>
    setDrawnGroups(newGroups)

    const shuffle = <T,>(arr: T[]): T[] => {
      const copy = [...arr]
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]]
      }
      return copy
    }

    // Place hosts in Group positions 1
    const mexico = uiNations.find((n) => n.id === 'mex')!
    const canada = uiNations.find((n) => n.id === 'can')!
    const usa = uiNations.find((n) => n.id === 'usa')!

    newGroups['A'].push(mexico)
    newGroups['B'].push(canada)
    newGroups['D'].push(usa)

    // Other Pot 1 teams
    const otherPot1 = pots[1].filter((n) => !['mex', 'can', 'usa'].includes(n.id))
    const shuffledOtherPot1 = shuffle(otherPot1)
    let pot1Idx = 0
    GROUPS_KEYS.forEach((group) => {
      if (group !== 'A' && group !== 'B' && group !== 'D') {
        newGroups[group].push(shuffledOtherPot1[pot1Idx++])
      }
    })

    // Confederation rules checking
    const canPlace = (team: Nation, groupTeams: Nation[]) => {
      const conf = team.confederation
      const count = groupTeams.filter((t) => t.confederation === conf).length
      if (conf === 'UEFA') {
        return count < 2
      } else {
        return count === 0
      }
    }

    const drawPot = (potTeams: Nation[]) => {
      const shuffled = shuffle(potTeams)
      for (const team of shuffled) {
        let placed = false
        // Try to place in a group that fits geographical rules
        for (const group of GROUPS_KEYS) {
          if (newGroups[group].length < 4 && canPlace(team, newGroups[group])) {
            newGroups[group].push(team)
            placed = true
            break
          }
        }
        if (!placed) {
          // Fallback: first available group
          for (const group of GROUPS_KEYS) {
            if (newGroups[group].length < 4) {
              newGroups[group].push(team)
              break
            }
          }
        }
      }
    }

    drawPot(pots[2])
    drawPot(pots[3])
    drawPot(pots[4])

    // Generate animation steps sequentially (A1, B1, C1... A2, B2... etc.)
    const steps: Array<{ group: GroupId; pot: number; nation: Nation }> = []

    // Pot 1
    GROUPS_KEYS.forEach((group) => {
      const nation = newGroups[group][0]
      if (nation) steps.push({ group, pot: 1, nation })
    })
    // Pot 2
    GROUPS_KEYS.forEach((group) => {
      const nation = newGroups[group][1]
      if (nation) steps.push({ group, pot: 2, nation })
    })
    // Pot 3
    GROUPS_KEYS.forEach((group) => {
      const nation = newGroups[group][2]
      if (nation) steps.push({ group, pot: 3, nation })
    })
    // Pot 4
    GROUPS_KEYS.forEach((group) => {
      const nation = newGroups[group][3]
      if (nation) steps.push({ group, pot: 4, nation })
    })

    // Reset drawnGroups to empty for the animation reveal
    setDrawnGroups(Object.fromEntries(GROUPS_KEYS.map((g) => [g, []])) as unknown as Record<GroupId, Nation[]>)
    setAnimationSteps(steps)
    setCurrentStepIndex(0)
  }

  // Draw simulation animation loop (premium televised spinning reveal effect - fast-paced)
  useEffect(() => {
    if (drawState !== 'drawing' || currentStepIndex < 0 || currentStepIndex >= animationSteps.length) {
      if (currentStepIndex >= animationSteps.length && drawState === 'drawing') {
        setDrawState('completed')
        setActiveDrawNation(null)
        setRevealPhase('idle')
        setJustLandedGroup(null)
      }
      return
    }

    const step = animationSteps[currentStepIndex]
    setRevealPhase('spinning')

    // Spin/lottery cycle effect (5 fast ticks = 150ms)
    const currentPotTeams = pots[step.pot as 1 | 2 | 3 | 4]
    let cycleCount = 0

    const spinInterval = setInterval(() => {
      const randomTeam = currentPotTeams[Math.floor(Math.random() * currentPotTeams.length)]
      setSpinningNation(randomTeam)
      cycleCount++

      if (cycleCount >= 5) {
        clearInterval(spinInterval)
        setRevealPhase('revealed')
        setActiveDrawNation(step.nation)
        setJustLandedGroup(step.group)

        // Append to group
        setDrawnGroups((current) => {
          const next = { ...current }
          next[step.group] = [...next[step.group], step.nation]
          return next
        })

        // Display team for 120ms before moving to the next
        setTimeout(() => {
          setJustLandedGroup(null)
          setCurrentStepIndex((prev) => prev + 1)
        }, 120)
      }
    }, 30)

    return () => clearInterval(spinInterval)
  }, [drawState, currentStepIndex, animationSteps, pots])

  // Instant draw skip
  const skipDraw = () => {
    if (drawState !== 'drawing') return
    // Finish all remaining steps instantly
    const finalGroups = Object.fromEntries(GROUPS_KEYS.map((g) => [g, []])) as unknown as Record<GroupId, Nation[]>
    animationSteps.forEach((step) => {
      finalGroups[step.group].push(step.nation)
    })
    setDrawnGroups(finalGroups)
    setCurrentStepIndex(animationSteps.length)
    setDrawState('completed')
    setActiveDrawNation(null)
    setRevealPhase('idle')
    setJustLandedGroup(null)
  }

  // Helper mapping: maps original group teams to newly drawn group teams
  const getMappedFixtures = (drawn: Record<GroupId, Nation[]>): TournamentFixture[] => {
    const originalGroups = Object.fromEntries(
      GROUPS_KEYS.map((g) => {
        const original = uiNations.filter((n) => n.group === g).sort((a, b) => a.id.localeCompare(b.id))
        return [g, original]
      })
    )

    return tournamentData.fixtures.map((fixture) => {
      if (fixture.stage !== 'GROUP' || !fixture.group) return fixture

      const orig = originalGroups[fixture.group]
      const dr = drawn[fixture.group]

      const homeIdx = orig.findIndex((n) => n.id === fixture.homeNationId)
      const awayIdx = orig.findIndex((n) => n.id === fixture.awayNationId)

      return {
        ...fixture,
        homeNationId: homeIdx >= 0 && dr[homeIdx] ? dr[homeIdx].id : fixture.homeNationId,
        awayNationId: awayIdx >= 0 && dr[awayIdx] ? dr[awayIdx].id : fixture.awayNationId,
      }
    })
  }

  // Mock simulate full tournament prediction using ratings
  const simulatePrediction = () => {
    setIsSimulating(true)
    const customFixtures = getMappedFixtures(drawnGroups)
    const customNations = uiNations.map((nation) => {
      const group = (Object.keys(drawnGroups) as GroupId[]).find((g) =>
        drawnGroups[g].some((n) => n.id === nation.id)
      ) ?? nation.group
      return { ...nation, group }
    })

    const customData = {
      ...tournamentData,
      nations: customNations,
      fixtures: customFixtures,
    }

    const tempResults: any = {}

    // 1. Goal sampler
    const sampleGoals = (lambda: number) => {
      const L = Math.exp(-lambda)
      let k = 0
      let p = 1
      do {
        k++
        p *= Math.random()
      } while (p > L && k < 10)
      return k - 1
    }

    const runMatchSimulation = (homeId: string, awayId: string) => {
      const homeN = customNations.find((n) => n.id === homeId)
      const awayN = customNations.find((n) => n.id === awayId)
      const hRating = homeN?.teamRating ?? 75
      const aRating = awayN?.teamRating ?? 75

      const lambdaHome = 1.35 * Math.exp((hRating - aRating) / 45)
      const lambdaAway = 1.15 * Math.exp((aRating - hRating) / 45)

      const homeGoals = sampleGoals(lambdaHome)
      const awayGoals = sampleGoals(lambdaAway)
      return { homeGoals, awayGoals }
    }

    // 2. Group stage matches (1 to 72)
    const groupStageFixtures = customFixtures.filter((f) => f.stage === 'GROUP')
    groupStageFixtures.forEach((f) => {
      const { homeGoals, awayGoals } = runMatchSimulation(f.homeNationId!, f.awayNationId!)
      tempResults[f.id] = {
        fixtureId: f.id,
        homeNationId: f.homeNationId!,
        awayNationId: f.awayNationId!,
        home: homeGoals,
        away: awayGoals,
        playedAt: f.date,
      }
    })

    let currentProgress = deriveCampaignProgress(customData, tempResults, { controlledNationId: campaign.nationId })

    // 3. Helper to simulate knockout round matches sequentially
    const simulateRound = (matches: any[]) => {
      matches.forEach((f) => {
        const homeId = f.homeNationId
        const awayId = f.awayNationId
        if (!homeId || !awayId) return

        let { homeGoals, awayGoals } = runMatchSimulation(homeId, awayId)
        let homePen = undefined
        let awayPen = undefined

        if (homeGoals === awayGoals) {
          // Extra time simulation
          const extraHome = sampleGoals(0.3)
          const extraAway = sampleGoals(0.3)
          homeGoals += extraHome
          awayGoals += extraAway

          if (homeGoals === awayGoals) {
            // Penalties
            if (Math.random() > 0.5) {
              homePen = 5
              awayPen = 4
            } else {
              homePen = 4
              awayPen = 5
            }
          }
        }

        tempResults[f.id] = {
          fixtureId: f.id,
          homeNationId: homeId,
          awayNationId: awayId,
          home: homeGoals,
          away: awayGoals,
          homePenalties: homePen,
          awayPenalties: awayPen,
          playedAt: f.date,
        }
      })
    }

    // 4. Knockout stage: Round of 32
    const r32 = currentProgress.fixtures.filter((f) => f.stage === 'ROUND_OF_32')
    simulateRound(r32)

    // 5. Round of 16
    currentProgress = deriveCampaignProgress(customData, tempResults, { controlledNationId: campaign.nationId })
    const r16 = currentProgress.fixtures.filter((f) => f.stage === 'ROUND_OF_16')
    simulateRound(r16)

    // 6. Quarterfinals
    currentProgress = deriveCampaignProgress(customData, tempResults, { controlledNationId: campaign.nationId })
    const qf = currentProgress.fixtures.filter((f) => f.stage === 'QUARTER_FINAL')
    simulateRound(qf)

    // 7. Semifinals
    currentProgress = deriveCampaignProgress(customData, tempResults, { controlledNationId: campaign.nationId })
    const sf = currentProgress.fixtures.filter((f) => f.stage === 'SEMI_FINAL')
    simulateRound(sf)

    // 8. Final & 3rd Place
    currentProgress = deriveCampaignProgress(customData, tempResults, { controlledNationId: campaign.nationId })
    const finals = currentProgress.fixtures.filter((f) => f.stage === 'FINAL' || f.stage === 'THIRD_PLACE')
    simulateRound(finals)

    // Final result
    currentProgress = deriveCampaignProgress(customData, tempResults, { controlledNationId: campaign.nationId })

    setSimulatedResults(tempResults)
    setSimulatedProgress(currentProgress)
    setIsSimulating(false)
  }

  // Save the custom drawn groups and custom fixtures, then start the game!
  const confirmDraw = () => {
    const customFixtures = getMappedFixtures(drawnGroups)
    const customNations = uiNations.map((nation) => {
      const group = (Object.keys(drawnGroups) as GroupId[]).find((g) =>
        drawnGroups[g].some((n) => n.id === nation.id)
      ) ?? nation.group
      return { ...nation, group }
    })

    updateCampaign({
      customNations,
      customFixtures,
      tutorialComplete: true,
      prologueComplete: true,
      unlockedModules: ['squad', 'hotel', 'training', 'tactics', 'press', 'hub'],
      squadConfirmed: true,
    })

    navigate('/juego')
  }

  return (
    <OnboardingFrame step={3} onBack={() => navigate('/elegir-seleccion')}>
      <section className="draw-page">
        <header className="draw-page__title">
          <span className="eyebrow"><Swords size={14} /> FASE DE GRUPOS DIBUJADA ALEATORIAMENTE</span>
          <h1>Sorteo de Grupos del Mundial</h1>
          <p>
            Divide los 48 equipos en 12 grupos de 4 (Grupos A a L). El sorteo se realiza usando 4 bombos clasificados por ranking FIFA.
          </p>
        </header>

        <div className="draw-layout">
          {/* Main draw workspace */}
          <main className="draw-workspace panel">
            {drawState === 'idle' && (
              <div className="draw-welcome">
                <Trophy size={60} className="draw-welcome__icon" />
                <h2>¿Preparado para conocer tus rivales?</h2>
                <p>
                  El bombo 1 contiene las cabezas de serie (incluyendo a tu selección {userNation.name} si está en el ranking superior).
                </p>
                <button className="button button--primary draw-start-btn" onClick={startDraw}>
                  <Play size={18} /> INICIAR SORTEO AUTOMÁTICO
                </button>
              </div>
            )}

            {drawState === 'drawing' && (
              <div className="draw-results-hub">
                <div className="draw-broadcast-box">
                  <div className="broadcast-screen">
                    <div className="broadcast-live-badge"><span className="live-dot" /> EN DIRECTO</div>
                    <div className="broadcast-pot-title">EXTRAYENDO DEL BOMBO {animationSteps[currentStepIndex]?.pot}</div>
                    <div className="broadcast-animation-wrap">
                      {revealPhase === 'spinning' && spinningNation && (
                        <div className="broadcast-ball broadcast-ball--spinning">
                          <Flag code={spinningNation.flagCode} label={spinningNation.name} size="lg" />
                          <div className="broadcast-ball-name">{spinningNation.name}</div>
                        </div>
                      )}
                      {revealPhase === 'revealed' && activeDrawNation && (
                        <div className="broadcast-ball broadcast-ball--revealed">
                          <Flag code={activeDrawNation.flagCode} label={activeDrawNation.name} size="lg" />
                          <div className="broadcast-ball-name">{activeDrawNation.name}</div>
                          <div className="broadcast-ball-group-assign">ASIGNADO AL GRUPO {animationSteps[currentStepIndex]?.group}</div>
                        </div>
                      )}
                    </div>
                    <button className="button button--secondary button--sm draw-skip-btn" onClick={skipDraw}>Omitir Sorteo</button>
                  </div>
                </div>

                <div className="draw-groups-container draw-groups-container--compact">
                  <div className="draw-groups-grid">
                    {GROUPS_KEYS.map((groupId) => {
                      const teams = drawnGroups[groupId] || []
                      const hasUserNation = teams.some((t) => t.id === userNation.id)
                      return (
                        <div key={groupId} className={`draw-group-card ${hasUserNation ? 'is-user-group' : ''} ${justLandedGroup === groupId ? 'has-just-landed' : ''}`}>
                          <div className="draw-group-header">
                            <span>GRUPO {groupId}</span>
                            {hasUserNation && <small className="user-group-tag">TU GRUPO</small>}
                          </div>
                          <div className="draw-group-teams">
                            {[0, 1, 2, 3].map((pos) => {
                              const team = teams[pos]
                              return (
                                <div key={pos} className={`draw-team-row ${team?.id === userNation.id ? 'is-user-team' : ''}`}>
                                  <span className="draw-team-pos">{pos + 1}</span>
                                  {team ? (
                                    <>
                                      <Flag code={team.flagCode} label={team.name} size="sm" />
                                      <b className="draw-team-name">{team.name}</b>
                                    </>
                                  ) : (
                                    <span className="draw-team-empty">—</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )}

            {drawState === 'completed' && (
              <div className="draw-results-hub">
                <div className="draw-groups-container">
                  <div className="draw-groups-grid">
                    {GROUPS_KEYS.map((groupId) => {
                      const teams = drawnGroups[groupId] || []
                      const hasUserNation = teams.some((t) => t.id === userNation.id)
                      return (
                        <div key={groupId} className={`draw-group-card ${hasUserNation ? 'is-user-group' : ''}`}>
                          <div className="draw-group-header">
                            <span>GRUPO {groupId}</span>
                            {hasUserNation && <small className="user-group-tag">TU GRUPO</small>}
                          </div>
                          <div className="draw-group-teams">
                            {[0, 1, 2, 3].map((pos) => {
                              const team = teams[pos]
                              return (
                                <div key={pos} className={`draw-team-row ${team?.id === userNation.id ? 'is-user-team' : ''}`}>
                                  <span className="draw-team-pos">{pos + 1}</span>
                                  {team ? (
                                    <>
                                      <Flag code={team.flagCode} label={team.name} size="sm" />
                                      <b className="draw-team-name">{team.name}</b>
                                      <small className="draw-team-rank">#{team.worldRanking}</small>
                                    </>
                                  ) : (
                                    <span className="draw-team-empty">—</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div className="draw-confirm-bar">
                  <p>Confirma el sorteo para entrar directamente en tu calendario diario.</p>
                  <button className="button button--primary confirm-draw-btn" onClick={confirmDraw}>
                    CONFIRMAR Y ABRIR CALENDARIO <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </main>

          {/* Sidebar displaying the 4 seeding pots */}
          <aside className="draw-pots-sidebar panel">
            <h3>Bombos de Sorteo (Clasificación FIFA)</h3>
            <div className="pots-container">
              {[1, 2, 3, 4].map((potNum) => (
                <div key={potNum} className="pot-box">
                  <h4>BOMBO {potNum}</h4>
                  <div className="pot-teams">
                    {pots[potNum as 1 | 2 | 3 | 4].map((nation) => {
                      const isDrawn = Object.values(drawnGroups).some((g) => g.some((n) => n.id === nation.id))
                      return (
                        <div key={nation.id} className={`pot-team-item ${isDrawn ? 'is-drawn' : ''} ${nation.id === userNation.id ? 'is-user' : ''}`}>
                          <Flag code={nation.flagCode} label={nation.name} size="sm" />
                          <span>{nation.name}</span>
                          <small>#{nation.worldRanking}</small>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </div>
      </section>
    </OnboardingFrame>
  )
}
