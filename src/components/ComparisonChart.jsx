'use client'

import { motion } from 'framer-motion'

function Bar({ label, defaultVal, cludeVal, unit = '%', maxVal = 100 }) {
  const defaultWidth = Math.min((defaultVal / maxVal) * 100, 100)
  const cludeWidth = Math.min((cludeVal / maxVal) * 100, 100)

  return (
    <div className="mb-8">
      <div className="flex justify-between mb-2">
        <p className="font-mono text-sm font-bold">{label}</p>
      </div>

      {/* Default */}
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-xs text-gray-500 w-16">Default</span>
        <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
          <motion.div
            className="h-full bg-red-400 rounded-full flex items-center justify-end pr-3"
            initial={{ width: 0 }}
            animate={{ width: `${defaultWidth}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          >
            <span className="text-xs font-bold text-white">
              {defaultVal.toFixed(1)}{unit}
            </span>
          </motion.div>
        </div>
      </div>

      {/* Clude */}
      <div className="flex items-center gap-3">
        <span className="font-mono text-xs text-clude w-16">Clude</span>
        <div className="flex-1 bg-gray-100 rounded-full h-8 overflow-hidden">
          <motion.div
            className="h-full bg-clude rounded-full flex items-center justify-end pr-3"
            initial={{ width: 0 }}
            animate={{ width: `${cludeWidth}%` }}
            transition={{ duration: 1, ease: 'easeOut', delay: 0.3 }}
          >
            <span className="text-xs font-bold text-white">
              {cludeVal.toFixed(1)}{unit}
            </span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default function ComparisonChart({ results }) {
  if (!results) return null

  const { default: d, clude: c } = results
  const predAccD = d.predictions > 0 ? (d.correct / d.predictions) * 100 : 0
  const predAccC = c.predictions > 0 ? (c.correct / c.predictions) * 100 : 0

  return (
    <motion.div
      className="bg-white rounded-2xl p-8 shadow-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <Bar label="Hallucination Rate ↓" defaultVal={d.hallucinations} cludeVal={c.hallucinations} maxVal={50} />
      <Bar label="Fact Retention ↑" defaultVal={d.factRetention} cludeVal={c.factRetention} />
      <Bar label="Prediction Accuracy ↑" defaultVal={predAccD} cludeVal={predAccC} />
      <Bar label="Cost Per Round ↓" defaultVal={d.cost} cludeVal={c.cost} unit="$" maxVal={Math.max(d.cost, 1)} />

      {/* Summary card */}
      <div className="mt-8 p-6 bg-gray-50 rounded-xl">
        <h3 className="font-bold text-lg mb-4">Summary</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-3xl font-bold text-clude">
              {d.hallucinations > 0 ? `${(d.hallucinations / Math.max(c.hallucinations, 0.1)).toFixed(0)}x` : '—'}
            </p>
            <p className="text-xs text-gray-500 font-mono">Less hallucination</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-clude">
              +{(c.factRetention - d.factRetention).toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 font-mono">Better retention</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-clude">
              +{(predAccC - predAccD).toFixed(0)}%
            </p>
            <p className="text-xs text-gray-500 font-mono">Better predictions</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-clude">
              {d.cost > 0 ? `${(d.cost / Math.max(c.cost, 0.01)).toFixed(0)}x` : '—'}
            </p>
            <p className="text-xs text-gray-500 font-mono">Cost reduction</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
