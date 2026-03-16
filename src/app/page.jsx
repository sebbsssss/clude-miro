'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import SimulationViz from '../components/SimulationViz'
import MetricsPanel from '../components/MetricsPanel'
import ComparisonChart from '../components/ComparisonChart'

export default function Home() {
  const [mode, setMode] = useState('demo') // 'demo' or 'live'
  const [simRunning, setSimRunning] = useState(false)
  const [simComplete, setSimComplete] = useState(false)
  const [results, setResults] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [progress, setProgress] = useState({ round: 0, total: 50, phase: 'idle' })
  const [liveMetrics, setLiveMetrics] = useState({
    default: { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 },
    clude: { hallucinations: 0, factRetention: 100, cost: 0, predictions: 0, correct: 0 },
  })

  const startSimulation = async () => {
    setSimRunning(true)
    setSimComplete(false)
    setResults(null)
    setStatusMsg('')

    const endpoint = mode === 'live' ? '/api/simulate-live' : '/api/simulate'

    try {
      const res = await fetch(endpoint, { method: 'POST' })
      const reader = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = decoder.decode(value)
        const lines = text.split('\n').filter(l => l.startsWith('data: '))

        for (const line of lines) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'status') {
              setStatusMsg(data.message)
            } else if (data.type === 'progress') {
              setProgress(data)
              setLiveMetrics(data.metrics)
              setStatusMsg('')
            } else if (data.type === 'complete') {
              setResults(data.results)
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
          <h1 className="text-5xl md:text-7xl font-extrabold leading-tight mb-6">
            What happens when<br />
            <span className="text-clude">500K agents</span> get<br />
            real memory?
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mb-10">
            MiroFish simulates hundreds of thousands of AI agents. But what happens to
            prediction accuracy when those agents can actually remember? We ran the numbers.
          </p>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => !simRunning && setMode('demo')}
              className={`px-4 py-2 rounded-lg font-mono text-sm transition ${
                mode === 'demo' ? 'bg-dark text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              Demo Mode (instant)
            </button>
            <button
              onClick={() => !simRunning && setMode('live')}
              className={`px-4 py-2 rounded-lg font-mono text-sm transition ${
                mode === 'live' ? 'bg-clude text-white' : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
              }`}
            >
              🔴 Live Mode (real Clude API)
            </button>
          </div>
          {mode === 'live' && (
            <p className="text-sm text-gray-500 mb-4">
              Live mode stores real memories in Supabase, runs real vector recall, and uses Grok to judge answers. Takes ~30 min for 1,000 agents.
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
              {simRunning ? (statusMsg || 'Simulation Running...') : simComplete ? 'Run Again' : mode === 'live' ? '🔴 Run Live Simulation →' : 'Run Simulation →'}
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
              { label: 'Agents', value: '1,000' },
              { label: 'Rounds', value: '50' },
              { label: 'Facts Per Agent', value: '10' },
              { label: mode === 'live' ? 'Mode' : 'Clude Hallucination', value: mode === 'live' ? '🔴 LIVE' : '1%' },
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
              <div className="mb-8">
                <div className="flex justify-between mb-2">
                  <span className="font-mono text-sm text-gray-600">
                    Round {progress.round}/{progress.total} — {progress.phase}
                  </span>
                  <span className="font-mono text-sm text-gray-600">
                    {Math.round((progress.round / progress.total) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <motion.div
                    className="bg-clude h-2 rounded-full"
                    animate={{ width: `${(progress.round / progress.total) * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>
            )}

            {/* Side by side visualization */}
            <div className="grid md:grid-cols-2 gap-8 mb-12">
              <div className="bg-white rounded-2xl p-6 shadow-sm">
                <h3 className="font-mono text-sm text-gray-500 mb-1">DEFAULT MEMORY</h3>
                <p className="text-xs text-gray-400 mb-4">Context window stuffing</p>
                <SimulationViz
                  metrics={liveMetrics.default}
                  color="#ef4444"
                  running={simRunning}
                />
              </div>
              <div className="bg-white rounded-2xl p-6 shadow-sm border-2 border-clude">
                <div className="flex justify-between items-center">
                  <h3 className="font-mono text-sm text-clude mb-1">CLUDE MEMORY</h3>
                  {mode === 'live' && (
                    <span className="bg-red-500 text-white text-xs font-mono px-2 py-0.5 rounded-full animate-pulse">LIVE</span>
                  )}
                </div>
                <p className="text-xs text-gray-400 mb-4">{mode === 'live' ? 'Real Supabase + Voyage + Grok' : 'Cognitive memory retrieval'}</p>
                <SimulationViz
                  metrics={liveMetrics.clude}
                  color="#455cfa"
                  running={simRunning}
                />
              </div>
            </div>

            {/* Live metrics */}
            <MetricsPanel
              defaultMetrics={liveMetrics.default}
              cludeMetrics={liveMetrics.clude}
              running={simRunning}
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
            <h2 className="text-4xl font-bold mb-2">Results</h2>
            <p className="text-gray-500 mb-10">After 50 rounds of simulation with 1,000 agents</p>
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
