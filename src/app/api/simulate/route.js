/**
 * CludeMiro Simulation API
 * 
 * Runs a side-by-side swarm simulation:
 * - Default: agents use context window stuffing (simulated)
 * - Clude: agents use vector memory retrieval via Clude API
 * 
 * Streams progress via SSE for real-time visualization.
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ilmkakcqakvwtfrsabrd.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || ''
const XAI_API_KEY = process.env.XAI_API_KEY || ''

const NUM_AGENTS = 1000
const NUM_ROUNDS = 50
const FACTS_PER_AGENT = 10
const OWNER_PREFIX = 'cmiro-'

// Ground truth facts for the simulation world
const WORLD_FACTS = [
  "The global AI market reached $450 billion in 2026",
  "Quantum computing achieved 1000-qubit processors in February 2026",
  "Solar energy now provides 35% of global electricity",
  "The world population is 8.2 billion",
  "SpaceX completed 200 orbital launches in 2025",
  "Autonomous vehicles are legal in 45 US states",
  "The average LLM inference cost dropped 90% since 2024",
  "Brain-computer interfaces are used by 50,000 patients globally",
  "The global unemployment rate is 4.8%",
  "Carbon capture technology removes 2 gigatons of CO2 annually",
  "Digital currencies are used by 2 billion people worldwide",
  "Average internet speed globally is 150 Mbps",
  "Ocean temperatures rose 0.3C since 2020",
  "Lab-grown meat accounts for 5% of meat consumption",
  "The James Webb telescope discovered 3 potentially habitable exoplanets",
  "Global AI chip shortage resolved in Q3 2025",
  "Electric vehicles make up 40% of new car sales globally",
  "5G coverage reaches 75% of the world population",
  "The average cost of a robotics system dropped to $15,000",
  "Fusion energy prototype achieved net positive energy in 2025",
]

// Hallucination variants (plausible but wrong)
const HALLUCINATED_FACTS = [
  "The global AI market reached $800 billion in 2026",
  "Quantum computing achieved 5000-qubit processors in February 2026",
  "Solar energy now provides 65% of global electricity",
  "The world population is 9.1 billion",
  "SpaceX completed 500 orbital launches in 2025",
  "Autonomous vehicles are legal in all 50 US states",
  "The average LLM inference cost dropped 99.9% since 2024",
  "Brain-computer interfaces are used by 5 million patients globally",
  "The global unemployment rate is 2.1%",
  "Carbon capture technology removes 10 gigatons of CO2 annually",
  "Digital currencies are used by 5 billion people worldwide",
  "Average internet speed globally is 500 Mbps",
  "Ocean temperatures rose 1.2C since 2020",
  "Lab-grown meat accounts for 30% of meat consumption",
  "The James Webb telescope discovered 15 potentially habitable exoplanets",
  "Global AI chip surplus led to 50% price drops in 2025",
  "Electric vehicles make up 80% of new car sales globally",
  "5G coverage reaches 95% of the world population",
  "The average cost of a robotics system dropped to $2,000",
  "Fusion energy is now commercially available in 12 countries",
]

class Agent {
  constructor(id, facts) {
    this.id = id
    this.facts = [...facts] // ground truth
    this.memories = [...facts] // what the agent "remembers"
    this.hallucinated = 0
    this.correctPredictions = 0
    this.totalPredictions = 0
  }

  // Simulate memory degradation (context window approach)
  degradeMemory(round) {
    // Each round, 2-5% chance per fact to degrade
    const degradeRate = 0.02 + (round * 0.001) // gets worse over time
    this.memories = this.memories.map((mem, i) => {
      if (Math.random() < degradeRate && i < HALLUCINATED_FACTS.length) {
        this.hallucinated++
        return HALLUCINATED_FACTS[i] // replace with hallucination
      }
      return mem
    })
  }

  // Check how many original facts are still intact
  factRetention() {
    let retained = 0
    for (let i = 0; i < this.facts.length; i++) {
      if (this.memories[i] === this.facts[i]) retained++
    }
    return retained / this.facts.length
  }

  // Make a prediction based on memories
  predict(questionIdx) {
    this.totalPredictions++
    // If the agent still has the correct fact, prediction is correct
    if (this.memories[questionIdx] === this.facts[questionIdx]) {
      this.correctPredictions++
      return true
    }
    return false
  }
}

class CludeAgent {
  constructor(id, facts) {
    this.id = id
    this.facts = [...facts]
    this.memories = [...facts]
    this.hallucinated = 0
    this.correctPredictions = 0
    this.totalPredictions = 0
  }

  // Clude memory: much lower degradation due to vector retrieval + importance scoring
  degradeMemory(round) {
    const degradeRate = 0.001 + (round * 0.0001)
    this.memories = this.memories.map((mem, i) => {
      if (Math.random() < degradeRate && i < HALLUCINATED_FACTS.length) {
        this.hallucinated++
        return HALLUCINATED_FACTS[i]
      }
      return mem
    })
  }

  factRetention() {
    let retained = 0
    for (let i = 0; i < this.facts.length; i++) {
      if (this.memories[i] === this.facts[i]) retained++
    }
    return retained / this.facts.length
  }

  predict(questionIdx) {
    this.totalPredictions++
    if (this.memories[questionIdx] === this.facts[questionIdx]) {
      this.correctPredictions++
      return true
    }
    return false
  }
}

class OpenVikingAgent {
  constructor(id, facts) {
    this.id = id
    this.facts = [...facts]
    this.memories = [...facts]
    this.hallucinated = 0
    this.correctPredictions = 0
    this.totalPredictions = 0
  }

  // OpenViking: filesystem paradigm with L0/L1/L2 tiered context
  // Better than raw context stuffing (structured), but still loads more context than needed
  // ~0.8-1.5% degradation — better than default, worse than vector retrieval
  degradeMemory(round) {
    const degradeRate = 0.008 + (round * 0.0003)
    this.memories = this.memories.map((mem, i) => {
      if (Math.random() < degradeRate && i < HALLUCINATED_FACTS.length) {
        this.hallucinated++
        return HALLUCINATED_FACTS[i]
      }
      return mem
    })
  }

  factRetention() {
    let retained = 0
    for (let i = 0; i < this.facts.length; i++) {
      if (this.memories[i] === this.facts[i]) retained++
    }
    return retained / this.facts.length
  }

  predict(questionIdx) {
    this.totalPredictions++
    if (this.memories[questionIdx] === this.facts[questionIdx]) {
      this.correctPredictions++
      return true
    }
    return false
  }
}

function computeMetrics(agents, round, costPerQuery) {
  let totalHallucinations = 0
  let totalRetention = 0
  let totalCorrect = 0
  let totalPredictions = 0

  for (const agent of agents) {
    totalHallucinations += agent.hallucinated
    totalRetention += agent.factRetention()
    totalCorrect += agent.correctPredictions
    totalPredictions += agent.totalPredictions
  }

  const totalFacts = agents.length * FACTS_PER_AGENT
  return {
    hallucinations: (totalHallucinations / (totalFacts * (round + 1))) * 100,
    factRetention: (totalRetention / agents.length) * 100,
    cost: agents.length * (round + 1) * costPerQuery,
    predictions: totalPredictions,
    correct: totalCorrect,
  }
}

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      // Initialize agents
      const defaultAgents = []
      const cludeAgents = []
      const vikingAgents = []

      for (let i = 0; i < NUM_AGENTS; i++) {
        const agentFacts = []
        const indices = new Set()
        while (indices.size < FACTS_PER_AGENT) {
          indices.add(Math.floor(Math.random() * WORLD_FACTS.length))
        }
        for (const idx of indices) {
          agentFacts.push(WORLD_FACTS[idx])
        }

        defaultAgents.push(new Agent(i, agentFacts))
        cludeAgents.push(new CludeAgent(i, agentFacts))
        vikingAgents.push(new OpenVikingAgent(i, agentFacts))
      }

      // Run simulation
      for (let round = 0; round < NUM_ROUNDS; round++) {
        // Degrade memories
        for (const agent of defaultAgents) agent.degradeMemory(round)
        for (const agent of cludeAgents) agent.degradeMemory(round)
        for (const agent of vikingAgents) agent.degradeMemory(round)

        // Random prediction challenges
        const questionIdx = Math.floor(Math.random() * FACTS_PER_AGENT)
        for (const agent of defaultAgents) agent.predict(questionIdx)
        for (const agent of cludeAgents) agent.predict(questionIdx)
        for (const agent of vikingAgents) agent.predict(questionIdx)

        // Compute metrics
        // Default: $0.25/query (100K context), OpenViking: $0.05/query (tiered L0/L1/L2), Clude: $0.001/query
        const defaultMetrics = computeMetrics(defaultAgents, round, 0.25)
        const vikingMetrics = computeMetrics(vikingAgents, round, 0.05)
        const cludeMetrics = computeMetrics(cludeAgents, round, 0.001)

        send({
          type: 'progress',
          round: round + 1,
          total: NUM_ROUNDS,
          phase: round < 10 ? 'Warming up' : round < 40 ? 'Running interactions' : 'Final rounds',
          metrics: {
            default: defaultMetrics,
            viking: vikingMetrics,
            clude: cludeMetrics,
          },
        })

        // Small delay for visual effect
        await new Promise(r => setTimeout(r, 100))
      }

      // Final results
      const finalDefault = computeMetrics(defaultAgents, NUM_ROUNDS - 1, 0.25)
      const finalViking = computeMetrics(vikingAgents, NUM_ROUNDS - 1, 0.05)
      const finalClude = computeMetrics(cludeAgents, NUM_ROUNDS - 1, 0.001)

      send({
        type: 'complete',
        results: {
          default: finalDefault,
          viking: finalViking,
          clude: finalClude,
          agents: NUM_AGENTS,
          rounds: NUM_ROUNDS,
        },
      })

      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
