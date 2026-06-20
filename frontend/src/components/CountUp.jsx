import { useEffect } from 'react'
import { animate, motion, useMotionValue, useTransform } from 'framer-motion'

// Número que conta até o valor, formatado em BRL. Usado nos preços em destaque.
export default function CountUp({ value = 0, duration = 1.1, className }) {
  const mv = useMotionValue(0)
  const rounded = useTransform(mv, (v) =>
    new Intl.NumberFormat('pt-BR', {
      style: 'currency', currency: 'BRL', maximumFractionDigits: 0,
    }).format(Math.round(v))
  )

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: [0.16, 1, 0.3, 1] })
    return controls.stop
  }, [value, duration, mv])

  return <motion.span className={className}>{rounded}</motion.span>
}
