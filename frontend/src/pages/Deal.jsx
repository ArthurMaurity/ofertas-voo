import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useDeals, useHistory } from '../data/useData'
import Sparkline from '../components/Sparkline'
import Badge from '../components/Badge'
import CountUp from '../components/CountUp'
import { Loading, Empty } from '../components/States'
import { formatBRL, formatDate, regionGradient, dropTone } from '../lib/utils'
import './Deal.css'

export default function Deal() {
  const { code } = useParams()
  const navigate = useNavigate()
  const { deals, loading: l1 } = useDeals()
  const { routes, loading: l2 } = useHistory()

  if (l1 || l2) return <Loading label="Carregando oferta…" />

  const deal = deals.find((d) => d.destino === code)
  const route = routes[code]
  if (!deal && !route) {
    return <Empty emoji="🔍" title="Oferta não encontrada">
      Essa rota pode ter saído da lista. <button className="link-btn" onClick={() => navigate('/')}>Voltar ao início</button>
    </Empty>
  }
  const d = deal || route
  const serie = route?.serie || []
  const tone = dropTone(d.queda_pct)
  const dep = formatDate(d.departure_at)
  const ret = formatDate(d.return_at)

  return (
    <div className="deal-page">
      <div className="deal-hero">
        <div className="deal-hero-img" style={{ background: regionGradient(d) }} />
        <div className="deal-hero-grad" />
        <button className="back-btn glass" onClick={() => navigate(-1)}>←</button>
        <div className="deal-hero-info">
          <div className="eyebrow">{d.regiao}</div>
          <h1>{d.cidade}</h1>
          <span className="deal-hero-code">{d.destino}{d.pais ? ` · ${d.pais}` : ''}</span>
        </div>
      </div>

      <motion.div className="price-card glass section-pad"
        initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        <div className="price-main">
          <CountUp value={d.preco_brl} className="price-big" />
          {d.queda_pct > 0 && <Badge pct={d.queda_pct} tone={tone} pulse={tone === 'hot'} />}
        </div>
        <div className="price-stats">
          {d.media && <Stat label="média histórica" value={formatBRL(d.media)} />}
          {route?.min != null && <Stat label="menor visto" value={formatBRL(route.min)} accent />}
          {route?.max != null && <Stat label="maior visto" value={formatBRL(route.max)} />}
        </div>
      </motion.div>

      <section className="section-pad">
        <h2 className="block-title">Histórico de preço</h2>
        <div className="chart-card glass">
          <Sparkline serie={serie} height={150} full color="#00D4AA" />
          <div className="chart-foot faint">
            {serie.length > 1
              ? `${serie.length} leituras · ${route?.n_obs || serie.length} observações`
              : 'Histórico será preenchido nas próximas coletas'}
          </div>
        </div>
      </section>

      <section className="section-pad deal-facts">
        {(dep || ret) && (
          <div className="fact glass">
            <span className="faint">Datas</span>
            <strong>{dep || '—'}{ret ? ` → ${ret}` : ''}</strong>
          </div>
        )}
        {d.airline && (
          <div className="fact glass">
            <span className="faint">Companhia</span>
            <strong>{d.airline}</strong>
          </div>
        )}
        {d.mes_ida && (
          <div className="fact glass">
            <span className="faint">Mês monitorado</span>
            <strong>{d.mes_ida}</strong>
          </div>
        )}
      </section>

      {d.link && (
        <div className="section-pad">
          <motion.a href={d.link} target="_blank" rel="noopener noreferrer"
            className="cta-btn" whileTap={{ scale: 0.97 }}>
            Ver no Aviasales ↗
          </motion.a>
          <p className="faint cta-note">Preço de cache; confirme no site antes de comprar.</p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, accent }) {
  return (
    <div className="stat">
      <span className="faint">{label}</span>
      <strong style={accent ? { color: 'var(--teal)' } : undefined}>{value}</strong>
    </div>
  )
}
