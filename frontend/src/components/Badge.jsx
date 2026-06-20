import { motion } from 'framer-motion'
import './Badge.css'

// Badge de queda de preço. tone: hot | good | mild | flat
export default function Badge({ pct, tone = 'good', children, pulse = false }) {
  const label = children ?? (pct > 0 ? `−${Math.round(pct)}%` : 'estável')
  return (
    <motion.span
      className={`badge badge-${tone}`}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
    >
      {pulse && <span className="badge-dot" />}
      {label}
    </motion.span>
  )
}
