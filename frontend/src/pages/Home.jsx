import { motion } from 'framer-motion'
import { useDeals } from '../data/useData'
import MapHero from '../components/MapHero'
import DealCard from '../components/DealCard'
import { Loading, Empty } from '../components/States'
import { formatBRL } from '../lib/utils'
import './Home.css'

export default function Home() {
  const { deals, origin, loading, error, generatedAt } = useDeals()

  if (loading) return <Loading />
  if (error) return <Empty emoji="📡" title="Sem conexão com os dados">{String(error.message)}</Empty>

  const hot = deals.filter((d) => d.queda_pct >= 15)
  const melhor = deals[0]
  const atualizado = generatedAt
    ? new Date(generatedAt).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null

  return (
    <div className="home">
      <MapHero origin={origin} deals={deals} />

      <header className="home-head section-pad">
        <div className="eyebrow">Saindo do Rio de Janeiro</div>
        <h1 className="home-title">
          {hot.length > 0
            ? <>{hot.length} {hot.length === 1 ? 'oferta quente' : 'ofertas quentes'} agora 🔥</>
            : <>Acompanhando {deals.length} destinos</>}
        </h1>
        {melhor && (
          <p className="muted home-sub">
            Mais barata: <strong style={{ color: 'var(--text)' }}>{melhor.cidade}</strong> por{' '}
            <strong style={{ color: 'var(--teal)' }}>{formatBRL(melhor.preco_brl)}</strong>
          </p>
        )}
      </header>

      <Section title="Ofertas em destaque" count={deals.length}>
        {deals.length === 0
          ? <Empty>Os preços aparecem aqui após a próxima coleta do robô.</Empty>
          : (
            <div className="hscroll">
              {deals.map((d, i) => <DealCard key={d.destino} deal={d} index={i} />)}
            </div>
          )}
      </Section>

      {atualizado && (
        <motion.p className="home-updated faint"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          Atualizado em {atualizado} · dados de cache do Aviasales
        </motion.p>
      )}
    </div>
  )
}

function Section({ title, count, children }) {
  return (
    <section className="home-section">
      <div className="section-head section-pad">
        <h2>{title}</h2>
        {count != null && <span className="count-pill">{count}</span>}
      </div>
      {children}
    </section>
  )
}
