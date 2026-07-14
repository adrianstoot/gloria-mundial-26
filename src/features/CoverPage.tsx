import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, CloudOff, Download, Gamepad2, HardDrive, Settings2, ShieldCheck, Trash2, Upload, Volume2, X } from 'lucide-react'
import { Brand } from '../components/Brand'
import { useGame } from '../App'
import { uiNations } from './ui-model'
import { audioDirector } from '../audio/audioDirector'

export function CoverPage() {
  const navigate = useNavigate()
  const { campaign, hasSave, hasLegacySave, clearSave, exportSave, importSave, exportLegacySave, discardLegacySave } = useGame()
  const [settings, setSettings] = useState(false)
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('gm26-master-volume') ?? 70))
  const [motion, setMotion] = useState(() => localStorage.getItem('gm26-cover-motion') !== 'false')
  const [manageSaves, setManageSaves] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [entered, setEntered] = useState(false)
  const savedNation = uiNations.find((nation) => nation.id === campaign.nationId)
  useEffect(() => {
    const enter = () => { setEntered(true); void audioDirector.unlock(campaign.audio) }
    window.addEventListener('keydown', enter, { once: true })
    return () => window.removeEventListener('keydown', enter)
  }, [campaign.audio])

  return (
    <main className={`cover ${motion ? '' : 'cover--still'}`}>
      {!entered && <button className="console-press-start" onClick={() => { setEntered(true); void audioDirector.unlock(campaign.audio) }}><span><Gamepad2 /></span><b>PULSA CUALQUIER BOTÓN</b><small>ENTRAR EN GLORIA MUNDIAL 26</small></button>}
      <div className="cover__image" />
      <div className="cover__vignette" />
      <div className="cover__particles" aria-hidden="true">
        {Array.from({ length: 16 }, (_, index) => <i key={index} style={{ '--i': index } as React.CSSProperties} />)}
      </div>
      <header className="cover__topbar">
        <span className="cover__edition"><ShieldCheck size={15} /> EDICIÓN MUNDIAL 2026</span>
        <div className="cover__status"><CloudOff size={15} /> Jugable sin conexión <span /> EXPERIENCIA v3</div>
      </header>
      <section className="cover__content">
        <div className="cover__title-wrap">
          <Brand />
          <p>Una nación. Una oportunidad. La eternidad.</p>
          <span className="cover__date">25 MAY — 19 JUL · NORTEAMÉRICA</span>
        </div>
        <div className="cover__menu" aria-label="Menú principal">
          {hasSave && campaign.manager.name && (
            <button className="cover-save" onClick={() => navigate('/juego')}>
              <span className="cover-save__flag"><span className={`fi fi-${savedNation?.flagCode ?? 'un'}`} /></span>
              <span><small>CONTINUAR · {savedNation?.shortName}</small><b>{campaign.manager.name} {campaign.manager.surname}</b><em>{new Intl.DateTimeFormat('es-ES',{day:'numeric',month:'long',year:'numeric'}).format(new Date(`${campaign.date}T12:00:00`))}</em></span>
              <ChevronRight />
            </button>
          )}
          <button className="button button--gold button--hero" onClick={() => navigate('/nueva-partida')}>
            <Gamepad2 size={20} /> NUEVA CAMPAÑA <ChevronRight size={19} />
          </button>
          <button className="button button--glass button--hero" onClick={() => setSettings(true)}><Settings2 size={19} /> AJUSTES</button>
          {hasLegacySave && <div className="legacy-save"><span><HardDrive /><b>Campaña v2 migrada a v3</b><small>País, convocatoria, decisiones, táctica y resultados se han conservado. La copia original sigue exportable.</small></span><div><button onClick={exportLegacySave}><Download /> EXPORTAR v2</button><button onClick={discardLegacySave}><Trash2 /> RETIRAR COPIA</button></div></div>}
          {hasSave && (
            <button className="cover__delete" onClick={() => setManageSaves(true)}><HardDrive size={15} /> Gestionar partida y copias</button>
          )}
        </div>
      </section>
      <footer className="cover__footer">
        <span>5 selecciones jugables</span><i /><span>48 simuladas</span><i /><span>104 partidos</span>
        <small>Simulador original · Datos y valoraciones independientes</small>
      </footer>

      {settings && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setSettings(false)}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="settings-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="eyebrow">PREFERENCIAS</span><h2 id="settings-title">Ajustes de experiencia</h2></div><button className="icon-button" onClick={() => setSettings(false)} aria-label="Cerrar"><X /></button></header>
            <div className="settings-row"><span><Volume2 /><b>Volumen general</b><small>Ambiente, efectos y celebración</small></span><input aria-label="Volumen general" type="range" value={volume} onChange={(event) => setVolume(Number(event.target.value))} /><strong>{volume}%</strong></div>
            <div className="settings-row"><span><Download /><b>Movimiento ambiental</b><small>Confeti y transiciones de portada</small></span><button className={`toggle ${motion ? 'is-on' : ''}`} onClick={() => setMotion((value) => !value)} aria-pressed={motion}><i /></button></div>
            <button className="button button--gold button--wide" onClick={() => { localStorage.setItem('gm26-master-volume', String(volume)); localStorage.setItem('gm26-cover-motion', String(motion)); setSettings(false) }}>GUARDAR AJUSTES</button>
          </section>
        </div>
      )}

      {manageSaves && (
        <div className="modal-backdrop" role="presentation" onMouseDown={() => setManageSaves(false)}>
          <section className="modal save-manager" role="dialog" aria-modal="true" aria-labelledby="save-manager-title" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span className="eyebrow">PARTIDA LOCAL</span><h2 id="save-manager-title">Copias y recuperación</h2></div><button className="icon-button" onClick={() => setManageSaves(false)} aria-label="Cerrar"><X /></button></header>
            <div className="save-manager__slot"><span className="cover-save__flag"><span className={`fi fi-${savedNation?.flagCode ?? 'un'}`} /></span><span><small>SLOT 1 · AUTOGUARDADO</small><b>{campaign.manager.name} {campaign.manager.surname}</b><em>{savedNation?.name} · {campaign.date}</em></span><ShieldCheck /></div>
            <p>La aplicación conserva la versión actual y una copia anterior en IndexedDB para recuperar una escritura dañada.</p>
            <div className="save-manager__actions"><button className="button button--glass" onClick={() => { exportSave(); setSaveMessage('Copia .gm26save creada.') }}><Download /> EXPORTAR COPIA</button><label className="button button--glass"><Upload /> IMPORTAR COPIA<input type="file" accept=".gm26save,application/json" onChange={(event) => { const file=event.target.files?.[0]; if(!file)return; void importSave(file).then(()=>setSaveMessage('Partida importada y validada.')).catch((error:unknown)=>setSaveMessage(error instanceof Error?error.message:'No se pudo importar la partida.')) }} /></label></div>
            {saveMessage&&<div className="inline-message"><ShieldCheck /> {saveMessage}</div>}
            <button className="cover__delete cover__delete--danger" onClick={() => { setManageSaves(false); setConfirmDelete(true) }}><Trash2 /> Borrar esta campaña</button>
          </section>
        </div>
      )}

      {confirmDelete && (
        <div className="modal-backdrop">
          <section className="modal modal--small" role="alertdialog" aria-modal="true">
            <span className="modal__danger"><Trash2 /></span><h2>¿Borrar la campaña local?</h2><p>Se eliminará la partida guardada en este dispositivo. Esta acción no puede deshacerse.</p>
            <div className="button-row"><button className="button button--glass" onClick={() => setConfirmDelete(false)}>CANCELAR</button><button className="button button--danger" onClick={() => { clearSave(); setConfirmDelete(false) }}>BORRAR</button></div>
          </section>
        </div>
      )}
    </main>
  )
}
