import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { useDeals } from '../data/useData'
import './Config.css'

const STORE_KEY = 'voa-rio-prefs'
const MESES = [
  '2026-06', '2026-07', '2026-08', '2026-09',
  '2026-10', '2026-11', '2026-12', '2027-01',
]

const DEFAULTS = { whatsapp: true, threshold: 20, meses: ['2026-07', '2026-08'] }

function loadPrefs() {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') } }
  catch { return DEFAULTS }
}

export default function Config() {
  const { config } = useDeals()
  const [prefs, setPrefs] = useState(loadPrefs)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    localStorage.setItem(STORE_KEY, JSON.stringify(prefs))
    setSaved(true)
    const t = setTimeout(() => setSaved(false), 1200)
    return () => clearTimeout(t)
  }, [prefs])

  const set = (patch) => setPrefs((p) => ({ ...p, ...patch }))
  const toggleMes = (m) => set({
    meses: prefs.meses.includes(m) ? prefs.meses.filter((x) => x !== m) : [...prefs.meses, m],
  })

  const backendThreshold = config?.queda_pct ? Math.round(config.queda_pct * 100) : null

  return (
    <div className="config-page">
      <header className="section-pad">
        <div className="eyebrow">Preferências</div>
        <h1 className="config-title">Configurações</h1>
        <p className="muted config-lead">
          Estas preferências ficam salvas neste dispositivo. Os parâmetros reais do
          robô são definidos em <code>motor/config.py</code> e aplicados na próxima coleta.
        </p>
      </header>

      <section className="section-pad config-list">
        <div className="cfg-card glass">
          <div className="cfg-row">
            <div>
              <strong>Alertas no WhatsApp</strong>
              <span className="faint">Notificar quando uma oferta disparar</span>
            </div>
            <Toggle on={prefs.whatsapp} onChange={(v) => set({ whatsapp: v })} />
          </div>
        </div>

        <div className="cfg-card glass">
          <div className="cfg-head">
            <strong>Gatilho de queda</strong>
            <span className="cfg-value">{prefs.threshold}%</span>
          </div>
          <span className="faint">Avisar quando o preço cair pelo menos isso vs a média.</span>
          <input type="range" min="5" max="50" step="5" value={prefs.threshold}
            className="slider"
            onChange={(e) => set({ threshold: Number(e.target.value) })} />
          <div className="slider-scale faint"><span>5%</span><span>50%</span></div>
          {backendThreshold != null && backendThreshold !== prefs.threshold && (
            <p className="cfg-hint">Robô usando atualmente <strong>{backendThreshold}%</strong>.</p>
          )}
        </div>

        <div className="cfg-card glass">
          <div className="cfg-head"><strong>Meses monitorados</strong></div>
          <span className="faint">Janela de datas para buscar passagens.</span>
          <div className="month-grid">
            {MESES.map((m) => {
              const [y, mo] = m.split('-')
              const label = new Date(Number(y), Number(mo) - 1, 1)
                .toLocaleDateString('pt-BR', { month: 'short' })
              return (
                <button key={m}
                  className={`month-chip ${prefs.meses.includes(m) ? 'on' : ''}`}
                  onClick={() => toggleMes(m)}>
                  <span className="month-name">{label}</span>
                  <span className="month-year faint">{y}</span>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      <motion.div className="save-toast" animate={{ opacity: saved ? 1 : 0, y: saved ? 0 : 8 }}>
        ✓ salvo
      </motion.div>
    </div>
  )
}

function Toggle({ on, onChange }) {
  return (
    <button className={`toggle ${on ? 'on' : ''}`} onClick={() => onChange(!on)}
      role="switch" aria-checked={on}>
      <motion.span className="toggle-knob" layout
        transition={{ type: 'spring', stiffness: 600, damping: 32 }} />
    </button>
  )
}
