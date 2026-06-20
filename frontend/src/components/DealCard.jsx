import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import Badge from './Badge'
import { formatBRL, formatDate, photoUrl, dropTone } from '../lib/utils'
import './DealCard.css'

// Card de oferta para o scroll horizontal da Home.
export default function DealCard({ deal, index = 0 }) {
  const navigate = useNavigate()
  const [loaded, setLoaded] = useState(false)
  const tone = dropTone(deal.queda_pct)
  const dep = formatDate(deal.departure_at)

  return (
    <motion.button
      className="deal-card glass"
      onClick={() => navigate(`/deal/${deal.destino}`)}
      initial={{ opacity: 0, y: 28, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 320, damping: 26, delay: index * 0.06 }}
      whileTap={{ scale: 0.96 }}
    >
      <div className="deal-photo">
        <img
          src={photoUrl(deal, 600, 520)}
          alt={deal.cidade}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          style={{ opacity: loaded ? 1 : 0 }}
        />
        <div className="deal-photo-grad" />
        {deal.queda_pct > 0 && (
          <div className="deal-badge-float">
            <Badge pct={deal.queda_pct} tone={tone} pulse={tone === 'hot'} />
          </div>
        )}
        <div className="deal-region">{deal.regiao}</div>
      </div>

      <div className="deal-body">
        <div className="deal-city-row">
          <h3 className="deal-city">{deal.cidade}</h3>
          <span className="deal-code">{deal.destino}</span>
        </div>
        <div className="deal-price-row">
          <span className="deal-price">{formatBRL(deal.preco_brl)}</span>
          {deal.media && (
            <span className="deal-old">{formatBRL(deal.media)}</span>
          )}
        </div>
        <div className="deal-meta faint">
          {dep ? `ida ${dep}` : 'datas flexíveis'}
          {deal.airline ? ` · ${deal.airline}` : ''}
        </div>
      </div>
    </motion.button>
  )
}
