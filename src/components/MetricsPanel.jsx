'use client'

import { motion } from 'framer-motion'

function MetricRow({ label, defaultVal, vikingVal, cludeVal, unit = '', highlight = false }) {
  return (
    <div className={`grid grid-cols-5 gap-4 py-4 border-b border-gray-100 ${highlight ? 'bg-blue-50/50 -mx-4 px-4 rounded-lg' : ''}`}>
      <p className="font-mono text-sm text-gray-600">{label}</p>
      <p className="text-lg font-bold text-red-500 text-center">
        {typeof defaultVal === 'number' ? defaultVal.toFixed(1) : defaultVal}{unit}
      </p>
      <p className="text-lg font-bold text-orange-500 text-center">
        {typeof vikingVal === 'number' ? vikingVal.toFixed(1) : vikingVal}{unit}
      </p>
      <p className="text-lg font-bold text-clude text-center">
        {typeof cludeVal === 'number' ? cludeVal.toFixed(1) : cludeVal}{unit}
      </p>
      <p className="text-lg font-bold text-green-600 text-center">
        {defaultVal > 0 ? `${(defaultVal / Math.max(cludeVal, 0.01)).toFixed(0)}x` : '—'}
      </p>
    </div>
  )
}

export default function MetricsPanel({ defaultMetrics, vikingMetrics, cludeMetrics, running, isLive }) {
  const d = defaultMetrics
  const v = vikingMetrics || { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 }
  const c = cludeMetrics

  const predAccDefault = d.predictions > 0 ? (d.correct / d.predictions) * 100 : 0
  const predAccViking = v.predictions > 0 ? (v.correct / v.predictions) * 100 : 0
  const predAccClude = c.predictions > 0 ? (c.correct / c.predictions) * 100 : 0

  return (
    <motion.div
      className="bg-white rounded-2xl p-8 shadow-sm"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="grid grid-cols-5 gap-4 mb-4 pb-4 border-b-2 border-gray-200">
        <p className="font-mono text-xs text-gray-500 tracking-wider">METRIC</p>
        <p className="font-mono text-xs text-red-500 tracking-wider text-center">DEFAULT</p>
        <p className="font-mono text-xs text-orange-500 tracking-wider text-center">OPENVIKING</p>
        <p className="font-mono text-xs text-clude tracking-wider text-center">CLUDE</p>
        <p className="font-mono text-xs text-green-600 tracking-wider text-center">vs DEFAULT</p>
      </div>

      <MetricRow label="Hallucination Rate" defaultVal={d.hallucinations} vikingVal={v.hallucinations} cludeVal={c.hallucinations} unit="%" highlight />
      <MetricRow label="Fact Retention" defaultVal={d.factRetention} vikingVal={v.factRetention} cludeVal={c.factRetention} unit="%" />
      <MetricRow label="Prediction Accuracy" defaultVal={predAccDefault} vikingVal={predAccViking} cludeVal={predAccClude} unit="%" />
      <MetricRow label={isLive ? "Cost (projected vs actual)" : "Cost Per Round"} defaultVal={d.cost} vikingVal={v.cost} cludeVal={c.cost} unit="" highlight />

      {running && (
        <div className="mt-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-clude rounded-full animate-pulse-blue" />
          <p className="font-mono text-xs text-gray-500">Simulation in progress...</p>
        </div>
      )}
    </motion.div>
  )
}
