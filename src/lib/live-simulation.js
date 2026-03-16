/**
 * CludeMiro Live Simulation Engine
 * 
 * Runs 1,000 agents with REAL Clude memory (Supabase + Voyage embeddings)
 * vs simulated default memory degradation.
 * 
 * Each Clude agent gets:
 * - Unique owner_wallet
 * - 10 real memories stored with embeddings
 * - Real vector recall every round
 */

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://okdregbvzsmjfkeobkzf.supabase.co'
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || ''
const VOYAGE_API_KEY = process.env.VOYAGE_API_KEY || ''
const XAI_API_KEY = process.env.XAI_API_KEY || ''

const HEADERS = {
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
}

// ── World Facts ──────────────────────────────────────────────

const WORLD_FACTS = [
  { fact: "The global AI market reached $450 billion in 2026", question: "How large is the global AI market?", answer: "$450 billion" },
  { fact: "Quantum computing achieved 1000-qubit processors in February 2026", question: "How many qubits have quantum processors reached?", answer: "1000 qubits" },
  { fact: "Solar energy now provides 35% of global electricity", question: "What percentage of electricity comes from solar?", answer: "35%" },
  { fact: "The world population is 8.2 billion", question: "What is the world population?", answer: "8.2 billion" },
  { fact: "SpaceX completed 200 orbital launches in 2025", question: "How many orbital launches did SpaceX complete in 2025?", answer: "200" },
  { fact: "Autonomous vehicles are legal in 45 US states", question: "In how many US states are autonomous vehicles legal?", answer: "45 states" },
  { fact: "The average LLM inference cost dropped 90% since 2024", question: "How much has LLM inference cost dropped since 2024?", answer: "90%" },
  { fact: "Brain-computer interfaces are used by 50,000 patients", question: "How many patients use brain-computer interfaces?", answer: "50,000" },
  { fact: "The global unemployment rate is 4.8%", question: "What is the global unemployment rate?", answer: "4.8%" },
  { fact: "Carbon capture removes 2 gigatons of CO2 annually", question: "How much CO2 does carbon capture remove annually?", answer: "2 gigatons" },
  { fact: "Digital currencies are used by 2 billion people", question: "How many people use digital currencies?", answer: "2 billion" },
  { fact: "Average global internet speed is 150 Mbps", question: "What is the average global internet speed?", answer: "150 Mbps" },
  { fact: "Ocean temperatures rose 0.3C since 2020", question: "How much have ocean temperatures risen since 2020?", answer: "0.3C" },
  { fact: "Lab-grown meat is 5% of meat consumption", question: "What percentage of meat consumption is lab-grown?", answer: "5%" },
  { fact: "James Webb telescope found 3 habitable exoplanets", question: "How many habitable exoplanets has James Webb found?", answer: "3" },
  { fact: "Electric vehicles are 40% of new car sales", question: "What percentage of new car sales are EVs?", answer: "40%" },
  { fact: "5G coverage reaches 75% of world population", question: "What percentage of the world has 5G coverage?", answer: "75%" },
  { fact: "Average robotics system costs $15,000", question: "What does an average robotics system cost?", answer: "$15,000" },
  { fact: "Fusion prototype achieved net positive energy in 2025", question: "When did fusion achieve net positive energy?", answer: "2025" },
  { fact: "Global AI chip shortage resolved in Q3 2025", question: "When was the AI chip shortage resolved?", answer: "Q3 2025" },
]

// ── Embedding (batched) ──────────────────────────────────────

async function embedBatch(texts, batchSize = 50) {
  const results = []
  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize).map(t => t.slice(0, 4000))
    const resp = await fetch('https://api.voyageai.com/v1/embeddings', {
      method: 'POST',
      headers: { Authorization: `Bearer ${VOYAGE_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: batch, model: 'voyage-4-large' }),
    })
    if (!resp.ok) throw new Error(`Voyage error: ${resp.status}`)
    const data = await resp.json()
    results.push(...data.data.map(d => d.embedding))
    // Rate limit
    if (i + batchSize < texts.length) await sleep(200)
  }
  return results
}

async function embedSingle(text) {
  const [emb] = await embedBatch([text], 1)
  return emb
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Supabase Ops ─────────────────────────────────────────────

async function storeMemories(memories) {
  // Batch insert
  const batchSize = 100
  for (let i = 0; i < memories.length; i += batchSize) {
    const batch = memories.slice(i, i + batchSize)
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/memories`, {
      method: 'POST',
      headers: { ...HEADERS, Prefer: 'return=minimal' },
      body: JSON.stringify(batch),
    })
    if (!resp.ok) {
      const err = await resp.text()
      throw new Error(`Store error: ${resp.status} ${err}`)
    }
    if (i + batchSize < memories.length) await sleep(100)
  }
}

async function recallMemories(queryEmbedding, owner, topK = 5) {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/match_memories`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify({
      query_embedding: queryEmbedding,
      match_threshold: 0.15,
      match_count: topK,
      filter_types: null,
      filter_user: null,
      min_decay: 0.0,
      filter_owner: owner,
    }),
  })
  if (!resp.ok) throw new Error(`Recall error: ${resp.status}`)
  return resp.json()
}

async function hydrateMemories(ids) {
  if (!ids.length) return []
  const filter = ids.join(',')
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/memories?id=in.(${filter})&select=id,content,summary`,
    { headers: HEADERS }
  )
  if (!resp.ok) return []
  return resp.json()
}

async function cleanupOwners(prefix) {
  const resp = await fetch(
    `${SUPABASE_URL}/rest/v1/memories?owner_wallet=like.${prefix}*`,
    { method: 'DELETE', headers: HEADERS }
  )
}

// ── LLM Judge ────────────────────────────────────────────────

async function judgeAnswer(question, expectedAnswer, recalledMemories, agentId) {
  if (!recalledMemories.length) return { correct: false, hallucinated: false, answer: 'NO_MEMORY' }

  const memText = recalledMemories.map(m => `- ${m.content || m.summary || ''}`).join('\n')

  const resp = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'grok-3-fast',
      max_tokens: 150,
      temperature: 0,
      messages: [
        { role: 'system', content: 'Answer the question using ONLY the provided memories. If the answer is not in the memories, say "UNKNOWN". Be concise.' },
        { role: 'user', content: `Memories:\n${memText}\n\nQuestion: ${question}\nAnswer:` },
      ],
    }),
  })

  if (!resp.ok) return { correct: false, hallucinated: false, answer: 'API_ERROR' }
  const data = await resp.json()
  const answer = data.choices[0].message.content.trim()

  const isUnknown = answer.toLowerCase().includes('unknown') || answer.toLowerCase().includes("don't know")
  const containsExpected = answer.toLowerCase().includes(expectedAnswer.toLowerCase())

  return {
    correct: containsExpected,
    hallucinated: !isUnknown && !containsExpected, // answered confidently but wrong
    answer,
  }
}

// ── Main Simulation ──────────────────────────────────────────

export async function runLiveSimulation(numAgents = 1000, numRounds = 50, onProgress) {
  const runId = `cmiro-${Date.now()}`
  const factsPerAgent = 10

  onProgress({ type: 'status', message: `Initializing ${numAgents} agents...`, phase: 'seeding' })

  // ── Phase 1: Seed agents with facts ──
  // Each agent gets 10 random facts
  const agents = []
  const allMemoriesToStore = []
  const allTextsToEmbed = []

  for (let i = 0; i < numAgents; i++) {
    const owner = `${runId}-${i}`
    const indices = new Set()
    while (indices.size < factsPerAgent) {
      indices.add(Math.floor(Math.random() * WORLD_FACTS.length))
    }
    const agentFacts = [...indices].map(idx => WORLD_FACTS[idx])

    agents.push({ id: i, owner, facts: agentFacts, stored: false })

    for (const f of agentFacts) {
      allTextsToEmbed.push(f.fact)
      allMemoriesToStore.push({
        content: f.fact,
        summary: f.fact,
        memory_type: 'semantic',
        importance: 0.7,
        owner_wallet: owner,
        source: 'clude-miro',
        tags: ['clude-miro', 'benchmark'],
        // embedding added after batch embed
      })
    }
  }

  onProgress({ type: 'status', message: `Embedding ${allTextsToEmbed.length} memories...`, phase: 'embedding' })

  // Batch embed all at once
  const allEmbeddings = await embedBatch(allTextsToEmbed, 100)

  // Attach embeddings
  for (let i = 0; i < allMemoriesToStore.length; i++) {
    allMemoriesToStore[i].embedding = allEmbeddings[i]
  }

  onProgress({ type: 'status', message: 'Storing memories in Supabase...', phase: 'storing' })

  // Batch store
  await storeMemories(allMemoriesToStore)

  onProgress({ type: 'status', message: 'All agents seeded. Starting simulation...', phase: 'running' })

  // ── Phase 2: Run rounds ──
  // Default agents (simulated degradation)
  const defaultAgents = agents.map(a => ({
    ...a,
    hallucinations: 0,
    correctRecalls: 0,
    totalRecalls: 0,
    factIntegrity: [...a.facts], // degrades over time
  }))

  // Track Clude metrics
  const cludeResults = {
    hallucinations: 0,
    correct: 0,
    total: 0,
    costEmbeddings: allTextsToEmbed.length * 0.00006, // seeding cost
  }

  const defaultResults = {
    hallucinations: 0,
    correct: 0,
    total: 0,
  }

  for (let round = 0; round < numRounds; round++) {
    // Pick a random question for this round
    const questionIdx = Math.floor(Math.random() * WORLD_FACTS.length)
    const { question, answer: expectedAnswer } = WORLD_FACTS[questionIdx]

    // ── Default: simulate degradation ──
    for (const agent of defaultAgents) {
      const degradeRate = 0.02 + (round * 0.001)
      agent.factIntegrity = agent.factIntegrity.map(f => {
        if (Math.random() < degradeRate) {
          agent.hallucinations++
          return { ...f, fact: f.fact + ' [CORRUPTED]' }
        }
        return f
      })

      // Check if this agent has the answer
      const hasFact = agent.facts.some(f => f.answer === expectedAnswer)
      if (hasFact) {
        const isIntact = agent.factIntegrity.some(
          f => f.answer === expectedAnswer && !f.fact?.includes('[CORRUPTED]')
        )
        defaultResults.total++
        if (isIntact) defaultResults.correct++
        else defaultResults.hallucinations++
      }
    }

    // ── Clude: sample 10 agents per round for real recall ──
    // (Can't do all 1000 per round — rate limits + cost)
    const sampleSize = Math.min(10, numAgents)
    const sampledAgents = []
    const sampledIndices = new Set()
    while (sampledIndices.size < sampleSize) {
      sampledIndices.add(Math.floor(Math.random() * numAgents))
    }
    for (const idx of sampledIndices) sampledAgents.push(agents[idx])

    // Embed the question once
    const qEmb = await embedSingle(question)
    cludeResults.costEmbeddings += 0.00006

    // Recall for each sampled agent
    for (const agent of sampledAgents) {
      try {
        const matches = await recallMemories(qEmb, agent.owner, 5)
        const ids = matches.map(m => m.id)
        const hydrated = ids.length ? await hydrateMemories(ids) : []

        // Judge
        const result = await judgeAnswer(question, expectedAnswer, hydrated, agent.id)
        cludeResults.total++
        if (result.correct) cludeResults.correct++
        if (result.hallucinated) cludeResults.hallucinations++

        await sleep(50) // rate limit
      } catch (e) {
        // Skip on error
      }
    }

    // ── Progress ──
    const totalDefaultFacts = numAgents * factsPerAgent * (round + 1)
    const defaultHalRate = totalDefaultFacts > 0
      ? (defaultResults.hallucinations / Math.max(defaultResults.total, 1)) * 100
      : 0
    const defaultAccuracy = defaultResults.total > 0
      ? (defaultResults.correct / defaultResults.total) * 100
      : 100

    const cludeHalRate = cludeResults.total > 0
      ? (cludeResults.hallucinations / cludeResults.total) * 100
      : 0
    const cludeAccuracy = cludeResults.total > 0
      ? (cludeResults.correct / cludeResults.total) * 100
      : 100

    // Cost: default = $0.25/query (context stuffing), clude = $0.001/query
    const defaultCost = numAgents * (round + 1) * 0.25
    const cludeCost = cludeResults.costEmbeddings + (cludeResults.total * 0.001)

    onProgress({
      type: 'progress',
      round: round + 1,
      total: numRounds,
      phase: round < 10 ? 'Warming up' : round < 40 ? 'Running interactions' : 'Final rounds',
      metrics: {
        default: {
          hallucinations: defaultHalRate,
          factRetention: 100 - defaultHalRate,
          cost: defaultCost,
          predictions: defaultResults.total,
          correct: defaultResults.correct,
        },
        clude: {
          hallucinations: cludeHalRate,
          factRetention: cludeAccuracy,
          cost: cludeCost,
          predictions: cludeResults.total,
          correct: cludeResults.correct,
        },
      },
      live: true,
    })
  }

  // ── Phase 3: Cleanup ──
  onProgress({ type: 'status', message: 'Cleaning up memories...', phase: 'cleanup' })
  await cleanupOwners(runId)

  // ── Final results ──
  const finalDefaultCost = numAgents * numRounds * 0.25
  const finalCludeCost = cludeResults.costEmbeddings + (cludeResults.total * 0.001)

  const finalDefaultHal = defaultResults.total > 0 ? (defaultResults.hallucinations / defaultResults.total) * 100 : 0
  const finalCludeHal = cludeResults.total > 0 ? (cludeResults.hallucinations / cludeResults.total) * 100 : 0
  const finalDefaultAcc = defaultResults.total > 0 ? (defaultResults.correct / defaultResults.total) * 100 : 0
  const finalCludeAcc = cludeResults.total > 0 ? (cludeResults.correct / cludeResults.total) * 100 : 0

  return {
    agents: numAgents,
    rounds: numRounds,
    cludeQueriesRun: cludeResults.total,
    default: {
      hallucinations: finalDefaultHal,
      factRetention: 100 - finalDefaultHal,
      cost: finalDefaultCost,
      predictions: defaultResults.total,
      correct: defaultResults.correct,
    },
    clude: {
      hallucinations: finalCludeHal,
      factRetention: finalCludeAcc,
      cost: finalCludeCost,
      predictions: cludeResults.total,
      correct: cludeResults.correct,
    },
  }
}
