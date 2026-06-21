import { motion } from 'framer-motion'
import { usePassengers } from '../context/PassengersContext'
import './PassengerSelector.css'

// Seletor de adultos (1–6) — pill glassmorphism dark com accent teal.
export default function PassengerSelector() {
  const { adults, inc, dec, min, max } = usePassengers()

  return (
    <div className="pax-selector glass" role="group" aria-label="Número de passageiros">
      <motion.button
        type="button"
        className="pax-btn"
        onClick={dec}
        disabled={adults <= min}
        whileTap={{ scale: 0.88 }}
        aria-label="Remover passageiro"
      >
        −
      </motion.button>

      <div className="pax-value">
        <span className="pax-icon">👤</span>
        <motion.span key={adults} className="pax-count"
          initial={{ y: -8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
          {adults}
        </motion.span>
        <span className="pax-label">{adults === 1 ? 'adulto' : 'adultos'}</span>
      </div>

      <motion.button
        type="button"
        className="pax-btn"
        onClick={inc}
        disabled={adults >= max}
        whileTap={{ scale: 0.88 }}
        aria-label="Adicionar passageiro"
      >
        +
      </motion.button>
    </div>
  )
}
