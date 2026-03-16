'use client'

import { motion } from 'framer-motion'

export default function SimulationViz({ metrics, color, running }) {
  const { hallucinations, factRetention, cost } = metrics

  // Generate dots representing agents
  const dots = Array.from({ length: 100 }, (_, i) => {
    const isHallucinating = i < Math.floor(hallucinations)
    return {
      id: i,
      x: (i % 10) * 10 + 5,
      y: Math.floor(i / 10) * 10 + 5,
      hallucinating: isHallucinating,
    }
  })

  return (
    <div className="relative">
      {/* Agent grid */}
      <svg viewBox="0 0 100 100" className="w-full aspect-square rounded-xl bg-gray-50">
        {dots.map((dot) => (
          <motion.circle
            key={dot.id}
            cx={dot.x}
            cy={dot.y}
            r={running ? 2.5 : 2}
            fill={dot.hallucinating ? '#ef4444' : color}
            opacity={dot.hallucinating ? 0.9 : 0.4}
            animate={
              running && dot.hallucinating
                ? { r: [2, 3.5, 2], opacity: [0.9, 1, 0.9] }
                : {}
            }
            transition={{ duration: 1, repeat: Infinity, delay: dot.id * 0.02 }}
          />
        ))}
        {/* Connection lines between nearby agents */}
        {dots.slice(0, 20).map((dot, i) => {
          const next = dots[(i + 1) % dots.length]
          return (
            <line
              key={`line-${i}`}
              x1={dot.x}
              y1={dot.y}
              x2={next.x}
              y2={next.y}
              stroke={color}
              strokeWidth={0.3}
              opacity={0.15}
            />
          )
        })}
      </svg>

      {/* Overlay stats */}
      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="font-mono text-xs text-gray-500">HALLUCINATIONS</p>
          <p className="text-2xl font-bold" style={{ color: hallucinations > 5 ? '#ef4444' : color }}>
            {hallucinations.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="font-mono text-xs text-gray-500">FACT RETENTION</p>
          <p className="text-2xl font-bold" style={{ color }}>
            {factRetention.toFixed(1)}%
          </p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3">
          <p className="font-mono text-xs text-gray-500">COST</p>
          <p className="text-2xl font-bold" style={{ color }}>
            ${cost.toFixed(2)}
          </p>
        </div>
      </div>
    </div>
  )
}
