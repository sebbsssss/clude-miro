'use client'

import { motion } from 'framer-motion'

function Bar({ label, defaultVal, vikingVal, cludeVal, unit = '%', maxVal = 100 }) {
  const defaultWidth = Math.min((defaultVal / maxVal) * 100, 100)
  const vikingWidth = Math.min((vikingVal / maxVal) * 100, 100)
  const cludeWidth = Math.min((cludeVal / maxVal) * 100, 100)

  return (
    <div className="mb-8">
      <p className="font-mono text-sm font-bold mb-2">{label}</p>

      <div className="flex items-center gap-3 mb-1.5">
        <span className="font-mono text-[10px] text-muted w-20">Baseline</span>
        <div className="flex-1 bg-[#fafaf8] rounded-full h-6 overflow-hidden">
          <motion.div className="h-full rounded-full flex items-center justify-end pr-3" style={{ background: '#d4d4d4' }} initial={{ width: 0 }} animate={{ width: `${defaultWidth}%` }} transition={{ duration: 1 }}>
            <span className="text-[10px] font-semibold text-white tabular-nums">{defaultVal.toFixed(1)}{unit}</span>
          </motion.div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-1.5">
        <span className="font-mono text-[10px] w-20" style={{ color: '#e8a849' }}>OpenViking</span>
        <div className="flex-1 bg-[#fafaf8] rounded-full h-6 overflow-hidden">
          <motion.div className="h-full rounded-full flex items-center justify-end pr-3" style={{ background: '#e8a849' }} initial={{ width: 0 }} animate={{ width: `${vikingWidth}%` }} transition={{ duration: 1, delay: 0.15 }}>
            <span className="text-[10px] font-semibold text-white tabular-nums">{vikingVal.toFixed(1)}{unit}</span>
          </motion.div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <span className="font-mono text-[10px] w-20" style={{ color: '#455cfa' }}>Clude</span>
        <div className="flex-1 bg-[#fafaf8] rounded-full h-6 overflow-hidden">
          <motion.div className="h-full rounded-full flex items-center justify-end pr-3" style={{ background: '#455cfa' }} initial={{ width: 0 }} animate={{ width: `${cludeWidth}%` }} transition={{ duration: 1, delay: 0.3 }}>
            <span className="text-[10px] font-semibold text-white tabular-nums">{cludeVal.toFixed(1)}{unit}</span>
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default function ComparisonChart({ results }) {
  if (!results) return null

  const { default: d, viking: v, clude: c } = results
  const vk = v || { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 }
  const predAccD = d.predictions > 0 ? (d.correct / d.predictions) * 100 : 0
  const predAccV = vk.predictions > 0 ? (vk.correct / vk.predictions) * 100 : 0
  const predAccC = c.predictions > 0 ? (c.correct / c.predictions) * 100 : 0

  return (
    <motion.div className="bg-white rounded-xl p-8 border border-border" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Bar label="Hallucination Rate ↓" defaultVal={d.hallucinations} vikingVal={vk.hallucinations} cludeVal={c.hallucinations} maxVal={50} />
      <Bar label="Fact Retention ↑" defaultVal={d.factRetention} vikingVal={vk.factRetention} cludeVal={c.factRetention} />
      <Bar label="Prediction Accuracy ↑" defaultVal={predAccD} vikingVal={predAccV} cludeVal={predAccC} />
      <Bar label="Cost Per Round ↓" defaultVal={d.cost} vikingVal={vk.cost} cludeVal={c.cost} unit="$" maxVal={Math.max(d.cost, 1)} />

      <div className="mt-8 p-6 bg-[#fafaf8] rounded-lg border border-border">
        <p className="font-mono text-[10px] tracking-widest text-muted/50 mb-4">SUMMARY</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          <div>
            <p className="text-3xl font-bold text-dark tabular-nums">
              {d.hallucinations > 0 ? `${(d.hallucinations / Math.max(c.hallucinations, 0.1)).toFixed(0)}x` : '—'}
            </p>
            <p className="text-[10px] text-muted font-mono mt-1">less hallucination vs baseline</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-dark tabular-nums">
              {vk.hallucinations > 0 ? `${(vk.hallucinations / Math.max(c.hallucinations, 0.1)).toFixed(0)}x` : '—'}
            </p>
            <p className="text-[10px] text-muted font-mono mt-1">less hallucination vs OpenViking</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-dark tabular-nums">
              +{(c.factRetention - d.factRetention).toFixed(0)}%
            </p>
            <p className="text-[10px] text-muted font-mono mt-1">better retention</p>
          </div>
          <div>
            <p className="text-3xl font-bold text-dark tabular-nums">
              {d.cost > 0 ? `${(d.cost / Math.max(c.cost, 0.01)).toFixed(0)}x` : '—'}
            </p>
            <p className="text-[10px] text-muted font-mono mt-1">cost reduction</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
