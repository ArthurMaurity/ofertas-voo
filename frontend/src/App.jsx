import { useEffect } from 'react'
import { Routes, Route, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import BottomNav from './components/BottomNav'
import AgentChat from './components/AgentChat'
import Home from './pages/Home'
import Deal from './pages/Deal'
import RoutesPage from './pages/RoutesPage'

const pageMotion = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
}

function Page({ children }) {
  return <motion.div className="page" {...pageMotion}>{children}</motion.div>
}

export default function App() {
  const location = useLocation()
  useEffect(() => { window.scrollTo(0, 0) }, [location.pathname])
  return (
    <div className="app-shell">
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<Page><Home /></Page>} />
          <Route path="/deal/:code" element={<Page><Deal /></Page>} />
          <Route path="/rotas" element={<Page><RoutesPage /></Page>} />
          <Route path="*" element={<Page><Home /></Page>} />
        </Routes>
      </AnimatePresence>
      <AgentChat />
      <BottomNav />
    </div>
  )
}
