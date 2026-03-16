'use client'

import { motion } from 'framer-motion'

export default function SimulationViz({ metrics, color, running, costLabel }) {
  const m = metrics || { hallucinations: 0, factRetention: 100, cost: 0 }
  const { hallucinations, factRetention, cost } = m

  // Honeycomb dots
  const cols = 12
  const rows = 7
  const total = cols * rows
  const halCount = Math.floor((hallucinations / 100) * total)

  const dots = Array.from({ length: total }, (_, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    const offset = row % 2 === 0 ? 0 : 4
    return { id: i, x: col * 8.3 + offset + 2, y: row * 12 + 8, bad: i < halCount }
  })

  return (
    <div>
      {/* Dot grid */}
      <div className="rounded-lg overflow-hidden mb-4 bg-[#fafaf8]">
        <svg viewBox="0 0 100 92" className="w-full">
          {dots.map((dot) => (
            <motion.circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={2.5}
              fill={dot.bad ? '#e5484d' : color}
              opacity={dot.bad ? 0.9 : 0.2}
              animate={
                running && dot.bad
                  ? { opacity: [0.9, 0.3, 0.9] }
                  : {}
              }
              transition={{ duration: 2, repeat: Infinity, delay: dot.id * 0.015 }}
            />
          ))}
        </svg>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-1.5">
        <div className="bg-[#fafaf8] rounded-lg p-2.5 text-center">
          <p className="text-[8px] font-mono tracking-widest text-muted/50 mb-1">HALLUC.</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color: hallucinations > 3 ? '#e5484d' : color }}>
            {hallucinations.toFixed(1)}<span className="text-xs text-muted/40">%</span>
          </p>
        </div>
        <div className="bg-[#fafaf8] rounded-lg p-2.5 text-center">
          <p className="text-[8px] font-mono tracking-widest text-muted/50 mb-1">RETAIN</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color }}>
            {factRetention.toFixed(1)}<span className="text-xs text-muted/40">%</span>
          </p>
        </div>
        <div className="bg-[#fafaf8] rounded-lg p-2.5 text-center">
          <p className="text-[8px] font-mono tracking-widest text-muted/50 mb-1">{costLabel || 'COST'}</p>
          <p className="text-lg font-semibold tabular-nums" style={{ color }}>
            <span className="text-xs text-muted/40">$</span>{cost >= 1000 ? `${(cost / 1000).toFixed(1)}K` : cost.toFixed(0)}
          </p>
        </div>
      </div>
    </div>
  )
}
