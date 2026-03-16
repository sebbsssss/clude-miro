'use client'

import { motion } from 'framer-motion'

export default function SimulationViz({ metrics, color, running }) {
  const m = metrics || { hallucinations: 0, factRetention: 100, cost: 0 }
  const { hallucinations, factRetention, cost } = m

  // Generate agent dots in a honeycomb-ish pattern
  const cols = 12
  const rows = 8
  const total = cols * rows
  const halCount = Math.floor((hallucinations / 100) * total)

  const dots = Array.from({ length: total }, (_, i) => {
    const row = Math.floor(i / cols)
    const col = i % cols
    const offset = row % 2 === 0 ? 0 : 4
    return {
      id: i,
      x: col * 8.3 + offset + 2,
      y: row * 11 + 6,
      hallucinating: i < halCount,
    }
  })

  return (
    <div>
      {/* Agent visualization */}
      <div className="rounded-xl overflow-hidden mb-5" style={{ background: `${color}08` }}>
        <svg viewBox="0 0 100 96" className="w-full">
          {dots.map((dot) => (
            <motion.circle
              key={dot.id}
              cx={dot.x}
              cy={dot.y}
              r={running && dot.hallucinating ? 3 : 2.8}
              fill={dot.hallucinating ? '#ef4444' : color}
              opacity={dot.hallucinating ? 1 : 0.35}
              animate={
                running && dot.hallucinating
                  ? { opacity: [1, 0.4, 1], r: [2.8, 3.5, 2.8] }
                  : {}
              }
              transition={{ duration: 1.5, repeat: Infinity, delay: dot.id * 0.01 }}
            />
          ))}
        </svg>
      </div>

      {/* Metrics row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl p-3 text-center" style={{ background: `${color}0a` }}>
          <p className="text-[10px] font-mono tracking-wider text-gray-400 mb-1">HALLUCINATION</p>
          <p className="text-xl font-bold" style={{ color: hallucinations > 3 ? '#ef4444' : color }}>
            {hallucinations.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: `${color}0a` }}>
          <p className="text-[10px] font-mono tracking-wider text-gray-400 mb-1">RETENTION</p>
          <p className="text-xl font-bold" style={{ color }}>
            {factRetention.toFixed(1)}%
          </p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ background: `${color}0a` }}>
          <p className="text-[10px] font-mono tracking-wider text-gray-400 mb-1">COST</p>
          <p className="text-xl font-bold" style={{ color }}>
            {cost >= 1000 ? `$${(cost / 1000).toFixed(0)}K` : `$${cost.toFixed(0)}`}
          </p>
        </div>
      </div>
    </div>
  )
}
