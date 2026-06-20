import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useHistory } from '../data/useData'
import Sparkline from '../components/Sparkline'
import Badge from '../components/Badge'
import { Loading, Empty } from '../components/States'
import { formatBRL, dropTone } from '../lib/utils'
import './RoutesPage.css'

const FILTERS = [
  { key: 'all', label: 'Todas' },
  { key: 'drop', label: 'Em queda' },
  { key: 'cheap', label: 'Mais baratas' },
]

export default function RoutesPage() {
  const { routes, loading, error } = useHistory()
  const [filter, setFilter] = useState('all')
  const navigate = useNavigate()

  const list = useMemo(() => {
    let arr = Object.values(routes)
    if (filter === 'drop') arr = arr.filter((r) => r.queda_pct > 0)
    arr.sort((a, b) => filter === 'cheap'
      ? a.preco_atual - b.preco_atual
      : (b.queda_pct - a.queda_pct) || (a.preco_atual - b.preco_atual))
    return arr
  }, [routes, filter])

  if (loading) return <Loading label="Carregando rotas…" />
  if (error) return <Empty emoji="📡" title="Sem dados de rotas">{String(error.message)}</Empty>

  return (
    <div className="routes-page">
      <header className="section-pad">
        <div className="eyebrow">Monitoramento</div>
        <h1 className="routes-title">Rotas acompanhadas</h1>
        <div className="filters">
          {FILTERS.map((f) => (
            <button key={f.key}
              className={`chip ${filter === f.key ? 'chip-active' : ''}`}
              onClick={() => setFilter(f.key)}>
              {f.label}
            </button>
          ))}
        </div>
      </header>

      {list.length === 0 ? (
        <Empty>Nenhuma rota neste filtro ainda.</Empty>
      ) : (
        <ul className="route-list">
          {list.map((r, i) => {
            const tone = dropTone(r.queda_pct)
            return (
              <motion.li key={r.destino}
                className="route-row glass"
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03, type: 'spring', stiffness: 300, damping: 28 }}
                onClick={() => navigate(`/deal/${r.destino}`)}>
                <div className="route-id">
                  <strong>{r.cidade}</strong>
                  <span className="faint">{r.destino} · {r.regiao}</span>
                </div>
                <div className="route-spark">
                  <Sparkline serie={r.serie} height={36}
                    color={tone === 'flat' ? '#5E6B8C' : '#00D4AA'} />
                </div>
                <div className="route-right">
                  <span className="route-price">{formatBRL(r.preco_atual)}</span>
                  <Badge pct={r.queda_pct} tone={tone} />
                </div>
              </motion.li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
