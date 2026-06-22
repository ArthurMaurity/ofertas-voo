import { NavLink } from 'react-router-dom'
import { motion } from 'framer-motion'

const ITEMS = [
  { to: '/', label: 'Início', icon: '🌎', end: true },
  { to: '/rotas', label: 'Rotas', icon: '📈', end: false },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav glass">
      <div className="nav-brand">✈️ Voa Rio</div>
      {ITEMS.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          {({ isActive }) => (
            <>
              {isActive && (
                <motion.span layoutId="nav-pill" className="nav-pill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }} />
              )}
              <span className="nav-icon">{it.icon}</span>
              <span>{it.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
