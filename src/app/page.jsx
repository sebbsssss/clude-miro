'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SimulationViz from '../components/SimulationViz'
import MetricsPanel from '../components/MetricsPanel'
import ComparisonChart from '../components/ComparisonChart'

function downloadReport(results, mode) {
  const d = results.default
  const v = results.viking || { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 }
  const c = results.clude
  const predAccD = d.predictions > 0 ? (d.correct / d.predictions * 100).toFixed(1) : '0.0'
  const predAccV = v.predictions > 0 ? (v.correct / v.predictions * 100).toFixed(1) : '0.0'
  const predAccC = c.predictions > 0 ? (c.correct / c.predictions * 100).toFixed(1) : '0.0'
  const timestamp = new Date().toISOString()
  const costSavingsVsDefault = d.cost > 0 ? (d.cost / Math.max(c.cost, 0.01)).toFixed(0) : '—'
  const costSavingsVsViking = v.cost > 0 ? (v.cost / Math.max(c.cost, 0.01)).toFixed(0) : '—'

  const report = `# CludeMiro Benchmark Report
Generated: ${timestamp}
Mode: ${mode === 'live' ? 'Production (real Clude API)' : 'Simulation'}
Agents: ${results.agents || 1000}
Rounds: ${results.rounds || 50}
${results.cludeQueriesRun ? `Production queries executed: ${results.cludeQueriesRun}` : ''}

---

## Results Summary

| Metric | Baseline (RAG) | OpenViking | Clude |
|--------|----------------|------------|-------|
| Hallucination Rate | ${d.hallucinations.toFixed(2)}% | ${v.hallucinations.toFixed(2)}% | ${c.hallucinations.toFixed(2)}% |
| Fact Retention | ${d.factRetention.toFixed(2)}% | ${v.factRetention.toFixed(2)}% | ${c.factRetention.toFixed(2)}% |
| Prediction Accuracy | ${predAccD}% | ${predAccV}% | ${predAccC}% |
| Total Cost | $${d.cost.toFixed(2)} | $${v.cost.toFixed(2)} | $${c.cost.toFixed(2)} |
| Cost Per Query | $0.015 | $0.008 | $0.001 |

## Key Findings

- **Hallucination reduction**: Clude achieved ${c.hallucinations.toFixed(2)}% hallucination vs ${d.hallucinations.toFixed(2)}% baseline (${d.hallucinations > 0 ? (d.hallucinations / Math.max(c.hallucinations, 0.01)).toFixed(0) : '—'}x improvement)
- **vs OpenViking**: ${v.hallucinations > 0 ? (v.hallucinations / Math.max(c.hallucinations, 0.01)).toFixed(0) : '—'}x less hallucination than ByteDance's filesystem approach
- **Cost efficiency**: ${costSavingsVsDefault}x cheaper than baseline RAG, ${costSavingsVsViking}x cheaper than OpenViking
- **Retention**: ${c.factRetention.toFixed(1)}% fact retention after ${results.rounds || 50} rounds

## Methodology

### Cost Basis
- **Baseline (Basic RAG)**: ~6K tokens/query at GPT-4o rates ($2.50/1M input tokens = $0.015/query)
- **OpenViking**: Tiered L0/L1/L2 loading reduces context to ~3K tokens ($0.008/query)
- **Clude**: Cognitive vector retrieval returns only relevant memories ($0.001/query)
- Source: https://openai.com/api/pricing

### Simulation Design
1. ${results.agents || 1000} agents seeded with 10 ground-truth facts each
2. ${results.rounds || 50} rounds of interaction with memory degradation
3. Each round: random fact queries, memory recall, accuracy measurement
${mode === 'live' ? `4. Clude column uses real Supabase storage, Voyage-4-Large embeddings, and Grok-3 LLM judging` : '4. Degradation rates based on HaluMem benchmark data (arxiv.org/abs/2511.03506)'}

### Memory Architectures
- **Baseline**: Standard RAG — retrieve chunks by similarity, stuff into context window
- **OpenViking**: ByteDance filesystem paradigm with L0/L1/L2 tiered context loading
- **Clude**: Cognitive memory with vector retrieval, importance scoring, and Hebbian reinforcement

## At Scale Projections

| Scale | Baseline Cost/Round | OpenViking Cost/Round | Clude Cost/Round |
|-------|--------------------|-----------------------|------------------|
| 1K agents | $15 | $8 | $1 |
| 100K agents | $1,500 | $800 | $100 |
| 500K agents | $7,500 | $4,000 | $500 |
| 750K agents | $11,250 | $6,000 | $750 |
| 1M agents | $15,000 | $8,000 | $1,000 |

---

Benchmark: https://github.com/sebbsssss/clude-miro
Clude: https://clude.io
`

  const blob = new Blob([report], { type: 'text/markdown' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `cludemiro-report-${mode}-${new Date().toISOString().slice(0, 10)}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export default function Home() {
  const [mode, setMode] = useState('demo') // 'demo' or 'live'
  const [simRunning, setSimRunning] = useState(false)
  const [simComplete, setSimComplete] = useState(false)
  const [results, setResults] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [progress, setProgress] = useState({ round: 0, total: 50, phase: 'idle' })
  const [liveMetrics, setLiveMetrics] = useState({
    default: { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 },
    viking: { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 },
    clude: { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 },
  })

  const startSimulation = async () => {
    setSimRunning(true)
    setSimComplete(false)
    setResults(null)
    setStatusMsg('')
    setProgress({ round: 0, total: 50, phase: 'idle' })
    setLiveMetrics({
      default: { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 },
      viking: { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 },
      clude: { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 },
    })

    const endpoint = mode === 'live' ? '/api/simulate-live' : '/api/simulate'

    try {
      const res = await fetch(endpoint, { method: 'POST' })
      if (!res.ok) {
        console.error('Simulation API error:', res.status)
        setSimRunning(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'status') {
              setStatusMsg(data.message)
            } else if (data.type === 'progress') {
              setProgress(data)
              const emptyMetrics = { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 }
              setLiveMetrics({
                default: data.metrics.default || emptyMetrics,
                viking: data.metrics.viking || emptyMetrics,
                clude: data.metrics.clude || emptyMetrics,
              })
              setStatusMsg('')
            } else if (data.type === 'complete') {
              const emptyR = { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 }
              setResults({
                ...data.results,
                default: data.results.default || emptyR,
                viking: data.results.viking || emptyR,
                clude: data.results.clude || emptyR,
              })
              setSimComplete(true)
              setSimRunning(false)
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error(err)
      setSimRunning(false)
    }
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-20 pb-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <p className="font-mono text-sm tracking-widest text-clude mb-6">
            — SWARM MEMORY BENCHMARK
          </p>
          <h1 className="text-4xl md:text-6xl font-bold leading-[1.1] mb-6 tracking-tight">
            What happens when<br />
            swarm agents get<br />
            <span className="text-sys-clude">persistent memory?</span>
          </h1>
          <p className="text-lg text-muted max-w-xl mb-10 leading-relaxed">
            MiroFish simulates hundreds of thousands of AI agents — Brian Roemmele just ran 500K.
            We benchmarked 1,000 to show what cognitive memory changes. The patterns hold at any scale.
          </p>
          <p className="text-[11px] text-muted/50 font-mono max-w-xl mb-6">
            Cost basis: Basic RAG = ~6K tokens/query at GPT-4o rates ($2.50/1M input = $0.015/query).
            OpenViking tiered loading reduces context to ~3K tokens ($0.008). Clude returns only relevant memories via vector retrieval ($0.001).{' '}
            <a href="https://openai.com/api/pricing" target="_blank" rel="noopener" className="underline hover:text-dark">Source: OpenAI Pricing</a>
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => !simRunning && setMode('demo')}
              className={`px-4 py-2 rounded-lg font-mono text-sm transition ${
                mode === 'demo' ? 'bg-dark text-white' : 'bg-[#fafaf8] text-muted border border-border hover:bg-white'
              }`}
            >
              Demo Mode (instant)
            </button>
            <button
              onClick={() => !simRunning && setMode('live')}
              className={`px-4 py-2 rounded-lg font-mono text-sm transition ${
                mode === 'live' ? 'bg-sys-clude text-white' : 'bg-[#fafaf8] text-muted border border-border hover:bg-white'
              }`}
            >
              🔵 Production Mode (Clude API)
            </button>
          </div>
          {mode === 'live' && (
            <p className="text-sm text-gray-500 mb-4">
              Production mode stores memories in Supabase, runs vector recall via Voyage embeddings, and uses Grok to judge answers. Takes ~30 min for 1,000 agents.
            </p>
          )}

          <div className="flex gap-4 mb-16">
            <motion.button
              onClick={startSimulation}
              disabled={simRunning}
              className={`${mode === 'live' ? 'bg-red-500 hover:bg-red-600' : 'bg-clude hover:bg-blue-600'} text-white px-8 py-4 rounded-lg font-semibold text-lg transition disabled:opacity-50 disabled:cursor-not-allowed`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {simRunning ? (statusMsg || 'Simulation Running...') : simComplete ? 'Run Again' : mode === 'live' ? '🔵 Run Production Simulation →' : 'Run Simulation →'}
            </motion.button>
            <a
              href="https://github.com/sebbsssss/clude-miro"
              className="border-2 border-dark px-8 py-4 rounded-lg font-semibold text-lg hover:bg-dark hover:text-white transition"
            >
              View Source
            </a>
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 border-t border-gray-300 pt-8">
            {[
              { label: 'Agents Benchmarked', value: '1,000' },
              { label: 'Simulation Rounds', value: '50' },
              { label: 'Facts Per Agent', value: '10' },
              { label: mode === 'live' ? 'Mode' : 'Clude Hallucination', value: mode === 'live' ? '🔴 PRODUCTION' : '1%' },
            ].map((stat) => (
              <div key={stat.label}>
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm text-gray-500 font-mono">{stat.label}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </section>

      {/* Live Simulation */}
      <AnimatePresence>
        {(simRunning || simComplete) && (
          <motion.section
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="max-w-6xl mx-auto px-6 pb-16"
          >
            {/* Progress bar */}
            {simRunning && (
              <div className="mb-8 bg-white rounded-xl p-5 border border-border">
                {/* Phase steps */}
                {mode === 'live' && progress.round === 0 && (
                  <div className="flex items-center gap-6 mb-4">
                    {[
                      { key: 'embedding', label: 'Embed' },
                      { key: 'seeding', label: 'Check' },
                      { key: 'storing', label: 'Seed' },
                      { key: 'running', label: 'Simulate' },
                    ].map((step, i) => {
                      const currentPhase = statusMsg.toLowerCase()
                      const phases = ['embed', 'check', 'stor', 'running']
                      const activeIdx = phases.findIndex(p => currentPhase.includes(p))
                      const isDone = i < activeIdx
                      const isActive = i === activeIdx
                      return (
                        <div key={step.key} className="flex items-center gap-2">
                          <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-mono ${
                            isDone ? 'bg-clude text-white' : isActive ? 'bg-clude/20 text-clude animate-pulse' : 'bg-[#fafaf8] text-muted/40'
                          }`}>
                            {isDone ? '✓' : i + 1}
                          </div>
                          <span className={`text-[11px] font-mono ${isActive ? 'text-clude' : isDone ? 'text-dark' : 'text-muted/40'}`}>
                            {step.label}
                          </span>
                          {i < 3 && <span className="text-muted/20 ml-2">→</span>}
                        </div>
                      )
                    })}
                  </div>
                )}

                <div className="flex justify-between items-center mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 bg-clude rounded-full animate-pulse" />
                    {progress.round > 0 ? (
                      <>
                        <span className="font-mono text-xs tracking-wider text-muted">
                          ROUND {progress.round}/{progress.total}
                        </span>
                        <span className="text-xs text-muted/60">{progress.phase}</span>
                      </>
                    ) : (
                      <span className="text-xs text-muted">{statusMsg || 'Initializing...'}</span>
                    )}
                  </div>
                  <span className="font-mono text-sm font-semibold text-clude">
                    {progress.round > 0 ? `${Math.round((progress.round / progress.total) * 100)}%` : ''}
                  </span>
                </div>
                <div className="w-full bg-[#fafaf8] rounded-full h-1.5 overflow-hidden">
                  {progress.round > 0 ? (
                    <motion.div
                      className="bg-gradient-to-r from-clude to-blue-400 h-1.5 rounded-full"
                      animate={{ width: `${(progress.round / progress.total) * 100}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  ) : (
                    <div className="h-1.5 w-full animate-shimmer rounded-full" />
                  )}
                </div>
              </div>
            )}

            {/* Three-way comparison */}
            <div className="grid md:grid-cols-3 gap-4 mb-12">
              {/* Default */}
              <div className="bg-white rounded-xl p-5 border border-border">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1.5 h-8 rounded-full bg-sys-default" />
                  <div>
                    <h3 className="font-mono text-[11px] tracking-wider text-muted leading-none">BASELINE</h3>
                    <p className="text-[10px] text-muted/60 mt-0.5">Basic RAG · $0.015/q</p>
                  </div>
                </div>
                <SimulationViz metrics={liveMetrics.default} color="#c4c4c4" running={simRunning} costLabel={mode === 'live' ? 'PROJECTED' : 'COST'} />
              </div>

              {/* OpenViking */}
              <div className="bg-white rounded-xl p-5 border border-sys-viking/30">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-1.5 h-8 rounded-full bg-sys-viking" />
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-mono text-[11px] tracking-wider text-sys-viking leading-none">OPENVIKING</h3>
                      <span className="text-[8px] font-mono text-sys-viking/60 border border-sys-viking/20 px-1 py-px rounded">BYTEDANCE</span>
                    </div>
                    <p className="text-[10px] text-muted/60 mt-0.5">Filesystem tiers · $0.008/q</p>
                  </div>
                </div>
                <SimulationViz metrics={liveMetrics.viking} color="#e8a849" running={simRunning} costLabel={mode === 'live' ? 'PROJECTED' : 'COST'} />
              </div>

              {/* Clude */}
              <div className="bg-white rounded-xl p-5 border-2 border-sys-clude/20 shadow-[0_0_24px_rgba(69,92,250,0.06)]">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-1.5 h-8 rounded-full bg-sys-clude" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-mono text-[11px] tracking-wider text-sys-clude leading-none">CLUDE</h3>
                        {mode === 'live' && (
                          <span className="text-[8px] font-mono bg-sys-clude text-white px-1.5 py-px rounded animate-pulse">PRODUCTION</span>
                        )}
                      </div>
                      <p className="text-[10px] text-muted/60 mt-0.5">Vector retrieval · $0.001/q</p>
                    </div>
                  </div>
                </div>
                <SimulationViz metrics={liveMetrics.clude} color="#455cfa" running={simRunning} costLabel={mode === 'live' ? 'ACTUAL' : 'COST'} />
              </div>
            </div>

            {/* Live metrics */}
            <MetricsPanel
              defaultMetrics={liveMetrics.default}
              vikingMetrics={liveMetrics.viking}
              cludeMetrics={liveMetrics.clude}
              running={simRunning}
              isLive={mode === 'live'}
            />
          </motion.section>
        )}
      </AnimatePresence>

      {/* Results */}
      <AnimatePresence>
        {simComplete && results && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-6xl mx-auto px-6 pb-20"
          >
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-4xl font-bold">Results</h2>
              <button
                onClick={() => downloadReport(results, mode)}
                className="font-mono text-xs bg-dark text-white px-4 py-2 rounded-lg hover:bg-dark/80 transition"
              >
                ↓ Download Report
              </button>
            </div>
            <p className="text-muted mb-10">After {results.rounds || 50} rounds of simulation with {results.agents || '1,000'} agents</p>
            <ComparisonChart results={results} />
          </motion.section>
        )}
      </AnimatePresence>

      {/* How it works */}
      <section className="max-w-6xl mx-auto px-6 py-20 border-t border-gray-300">
        <h2 className="text-4xl font-bold mb-12">How the benchmark works</h2>
        <div className="grid md:grid-cols-3 gap-10">
          {[
            {
              step: '01',
              title: 'Seed agents with facts',
              desc: 'Each agent receives 10 ground-truth facts about a simulated world. These facts are stored as memories.',
            },
            {
              step: '02',
              title: 'Run interaction rounds',
              desc: 'Agents interact, share information, make predictions, and update their memories over 50 rounds.',
            },
            {
              step: '03',
              title: 'Measure everything',
              desc: 'We track hallucination rate, fact retention, prediction accuracy, cost, and behavioral consistency.',
            },
          ].map((item) => (
            <div key={item.step}>
              <p className="text-6xl font-bold text-gray-200 mb-4">{item.step}</p>
              <h3 className="text-xl font-bold mb-2">{item.title}</h3>
              <p className="text-gray-600">{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-6xl mx-auto px-6 py-12 border-t border-gray-300">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-bold text-xl">Clude × MiroFish</p>
            <p className="text-sm text-gray-500">Memory infrastructure for swarm intelligence</p>
          </div>
          <div className="flex gap-6 text-sm text-gray-500">
            <a href="https://clude.io" className="hover:text-clude">Clude</a>
            <a href="https://github.com/666ghj/MiroFish" className="hover:text-clude">MiroFish</a>
            <a href="https://github.com/sebbsssss/clude-miro" className="hover:text-clude">GitHub</a>
          </div>
        </div>
      </footer>
    </main>
  )
}
