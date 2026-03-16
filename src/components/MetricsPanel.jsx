'use client'

import { motion } from 'framer-motion'

function MetricRow({ label, defaultVal, vikingVal, cludeVal, unit = '', highlight = false, deltaMode = 'lower' }) {
  // Delta calculation
  let delta = '—'
  if (deltaMode === 'lower' && defaultVal > 0 && cludeVal > 0) {
    // "Nx less" — e.g. hallucination: 53% vs 2% = 23x
    delta = `${(defaultVal / cludeVal).toFixed(0)}x`
  } else if (deltaMode === 'higher' && defaultVal > 0) {
    // "+N%" — e.g. retention: 50% vs 98% = +48%
    delta = `+${(cludeVal - defaultVal).toFixed(0)}%`
  } else if (deltaMode === 'cost' && cludeVal > 0) {
    delta = `${(defaultVal / cludeVal).toFixed(0)}x`
  }

  return (
    <div className={`grid grid-cols-5 gap-4 py-4 border-b border-border ${highlight ? 'bg-blue-50/50 -mx-4 px-4 rounded-lg' : ''}`}>
      <p className="font-mono text-sm text-muted">{label}</p>
      <p className="text-base font-semibold text-center tabular-nums" style={{ color: '#999' }}>
        {typeof defaultVal === 'number' ? defaultVal.toFixed(1) : defaultVal}{unit}
      </p>
      <p className="text-base font-semibold text-center tabular-nums" style={{ color: '#e8a849' }}>
        {typeof vikingVal === 'number' ? vikingVal.toFixed(1) : vikingVal}{unit}
      </p>
      <p className="text-base font-semibold text-center tabular-nums" style={{ color: '#455cfa' }}>
        {typeof cludeVal === 'number' ? cludeVal.toFixed(1) : cludeVal}{unit}
      </p>
      <p className="text-base font-semibold text-center tabular-nums" style={{ color: '#111' }}>
        {delta}
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
      className="bg-white rounded-xl p-8 border border-border"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <div className="grid grid-cols-5 gap-4 mb-4 pb-4 border-b border-border">
        <p className="font-mono text-[10px] text-muted/50 tracking-widest">METRIC</p>
        <p className="font-mono text-[10px] tracking-widest text-center" style={{ color: '#999' }}>BASELINE</p>
        <p className="font-mono text-[10px] tracking-widest text-center" style={{ color: '#e8a849' }}>OPENVIKING</p>
        <p className="font-mono text-[10px] tracking-widest text-center" style={{ color: '#455cfa' }}>CLUDE</p>
        <p className="font-mono text-[10px] text-dark tracking-widest text-center">DELTA</p>
      </div>

      <MetricRow label="Hallucination Rate" defaultVal={d.hallucinations} vikingVal={v.hallucinations} cludeVal={c.hallucinations} unit="%" deltaMode="lower" highlight />
      <MetricRow label="Fact Retention" defaultVal={d.factRetention} vikingVal={v.factRetention} cludeVal={c.factRetention} unit="%" deltaMode="higher" />
      <MetricRow label="Prediction Accuracy" defaultVal={predAccDefault} vikingVal={predAccViking} cludeVal={predAccClude} unit="%" deltaMode="higher" />
      <MetricRow label={isLive ? "Cost (projected vs actual)" : "Cost Per Round"} defaultVal={d.cost} vikingVal={v.cost} cludeVal={c.cost} unit="" deltaMode="cost" highlight />

      {running && (
        <div className="mt-4 flex items-center gap-2">
          <div className="w-2 h-2 bg-clude rounded-full animate-pulse-blue" />
          <p className="font-mono text-xs text-gray-500">Simulation in progress...</p>
        </div>
      )}
    </motion.div>
  )
}
