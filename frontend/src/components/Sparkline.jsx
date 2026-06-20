import { Area, AreaChart, ResponsiveContainer, Tooltip, YAxis } from 'recharts'
import { formatBRL, formatDate } from '../lib/utils'

// Sparkline de preço. `serie` = [{ t, p }]. Variante `full` mostra tooltip/eixo.
export default function Sparkline({ serie = [], height = 44, full = false, color = '#00D4AA' }) {
  if (!serie || serie.length < 2) {
    return <div style={{ height, display: 'grid', placeItems: 'center' }}
      className="faint" >sem histórico</div>
  }

  const gradId = `spark-${Math.round(serie[0].p)}-${serie.length}`
  const prices = serie.map((s) => s.p)
  const min = Math.min(...prices)
  const max = Math.max(...prices)

  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={serie} margin={{ top: 4, right: 2, left: 2, bottom: 0 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.45} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <YAxis hide domain={[min * 0.97, max * 1.03]} />
        {full && (
          <Tooltip
            cursor={{ stroke: 'rgba(255,255,255,0.2)' }}
            contentStyle={{
              background: 'rgba(14,21,40,0.95)', border: '1px solid var(--glass-border)',
              borderRadius: 12, fontSize: 12, color: '#EAF0FF',
            }}
            labelFormatter={(_, p) => formatDate(p?.[0]?.payload?.t) || ''}
            formatter={(v) => [formatBRL(v), 'preço']}
          />
        )}
        <Area
          type="monotone"
          dataKey="p"
          stroke={color}
          strokeWidth={2}
          fill={`url(#${gradId})`}
          isAnimationActive={full}
          dot={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
