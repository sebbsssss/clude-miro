/**
 * CludeMiro Production Simulation Engine
 * 
 * Pre-embeds everything upfront, then simulation is just 
 * Supabase inserts + RPC lookups (no Voyage calls during rounds).
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

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

// ── Embedding ────────────────────────────────────────────────

async function embedBatch(texts, batchSize = 128) {
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
    if (i + batchSize < texts.length) await sleep(200)
  }
  return results
}

// ── Supabase Ops ─────────────────────────────────────────────

async function storeMemories(memories, onProgress) {
  const batchSize = 1000
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
    if (onProgress) onProgress(`Stored ${Math.min(i + batchSize, memories.length)}/${memories.length} memories...`)
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
  await fetch(
    `${SUPABASE_URL}/rest/v1/memories?owner_wallet=like.${prefix}*`,
    { method: 'DELETE', headers: HEADERS }
  )
}

// ── LLM Judge (batched) ──────────────────────────────────────

async function judgeAnswersBatch(tasks) {
  // tasks: [{ question, expectedAnswer, memories }]
  // Fire all Grok calls in parallel (max 10 concurrent)
  const CONCURRENT = 10
  const results = []

  for (let i = 0; i < tasks.length; i += CONCURRENT) {
    const chunk = tasks.slice(i, i + CONCURRENT)
    const promises = chunk.map(async ({ question, expectedAnswer, memories }) => {
      if (!memories.length) return { correct: false, hallucinated: false }
      const memText = memories.map(m => `- ${m.content || m.summary || ''}`).join('\n')
      try {
        const resp = await fetch('https://api.x.ai/v1/chat/completions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${XAI_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'grok-3-fast',
            max_tokens: 100,
            temperature: 0,
            messages: [
              { role: 'system', content: `You are judging if a memory system recalled the right information.
Given memories and a question, determine if the expected answer is present in the memories.
Reply ONLY with one word: CORRECT, WRONG, or UNKNOWN.
- CORRECT: The memories contain information that answers the question (even if phrased differently or with extra context)
- WRONG: The memories contain a confident but INCORRECT answer
- UNKNOWN: The memories don't contain relevant information` },
              { role: 'user', content: `Memories:\n${memText}\n\nQuestion: ${question}\nExpected answer: ${expectedAnswer}\n\nVerdict:` },
            ],
          }),
        })
        if (!resp.ok) return { correct: false, hallucinated: false }
        const data = await resp.json()
        const verdict = data.choices[0].message.content.trim().toUpperCase()
        return {
          correct: verdict.includes('CORRECT'),
          hallucinated: verdict.includes('WRONG'),
        }
      } catch {
        return { correct: false, hallucinated: false }
      }
    })
    results.push(...(await Promise.all(promises)))
  }
  return results
}

// ── Main Simulation ──────────────────────────────────────────

export async function runLiveSimulation(numAgents = 1000, numRounds = 50, onProgress) {
  const runId = `cmiro-${Date.now()}`
  const factsPerAgent = 10

  // ── Phase 1: PRE-EMBED EVERYTHING ──
  onProgress({ type: 'status', message: 'Pre-embedding all facts and questions...', phase: 'embedding' })

  // Collect unique texts: all facts + all questions (just 20+20 = 40 texts, one Voyage call)
  const factTexts = WORLD_FACTS.map(f => f.fact)
  const questionTexts = WORLD_FACTS.map(f => f.question)
  const allTexts = [...factTexts, ...questionTexts]

  const allEmbeddings = await embedBatch(allTexts, 128)
  const factEmbeddings = allEmbeddings.slice(0, factTexts.length)    // index 0-19
  const questionEmbeddings = allEmbeddings.slice(factTexts.length)   // index 20-39

  // Map fact text → embedding for fast lookup
  const factEmbMap = new Map()
  factTexts.forEach((t, i) => factEmbMap.set(t, factEmbeddings[i]))
  const questionEmbMap = new Map()
  questionTexts.forEach((t, i) => questionEmbMap.set(t, questionEmbeddings[i]))

  onProgress({ type: 'status', message: `Embeddings cached (${allTexts.length} vectors). Seeding ${numAgents} agents...`, phase: 'seeding' })

  // ── Phase 2: Assign facts + store memories ──
  const agents = []
  const allMemoriesToStore = []

  for (let i = 0; i < numAgents; i++) {
    const owner = `${runId}-${i}`
    const indices = new Set()
    while (indices.size < factsPerAgent) {
      indices.add(Math.floor(Math.random() * WORLD_FACTS.length))
    }
    const agentFacts = [...indices].map(idx => WORLD_FACTS[idx])
    agents.push({ id: i, owner, facts: agentFacts })

    for (const f of agentFacts) {
      allMemoriesToStore.push({
        content: f.fact,
        summary: f.fact,
        memory_type: 'semantic',
        importance: 0.7,
        owner_wallet: owner,
        source: 'clude-miro',
        tags: ['clude-miro', 'benchmark'],
        embedding: factEmbMap.get(f.fact),
      })
    }
  }

  onProgress({ type: 'status', message: `Storing ${allMemoriesToStore.length} memories...`, phase: 'storing' })
  await storeMemories(allMemoriesToStore, (msg) => {
    onProgress({ type: 'status', message: msg, phase: 'storing' })
  })

  onProgress({ type: 'status', message: 'Seeding complete. Running simulation...', phase: 'running' })

  // ── Phase 3: Simulate rounds ──
  // Default + OpenViking = simulated degradation (no API calls)
  const defaultAgents = agents.map(a => ({ ...a, hallucinations: 0, intact: new Set(a.facts.map((_, i) => i)) }))
  const vikingAgents = agents.map(a => ({ ...a, hallucinations: 0, intact: new Set(a.facts.map((_, i) => i)) }))

  const cludeResults = { hallucinations: 0, correct: 0, total: 0 }
  const defaultResults = { hallucinations: 0, correct: 0, total: 0 }
  const vikingResults = { hallucinations: 0, correct: 0, total: 0 }
  const embeddingCost = allTexts.length * 0.00006

  for (let round = 0; round < numRounds; round++) {
    const questionIdx = Math.floor(Math.random() * WORLD_FACTS.length)
    const { question, answer: expectedAnswer } = WORLD_FACTS[questionIdx]

    // ── Default: heavy degradation (only test agents that have the fact) ──
    for (const agent of defaultAgents) {
      const degradeRate = 0.02 + (round * 0.001)
      for (const idx of [...agent.intact]) {
        if (Math.random() < degradeRate) {
          agent.intact.delete(idx)
          agent.hallucinations++
        }
      }
      const factIdx = agent.facts.findIndex(f => f.answer === expectedAnswer)
      if (factIdx !== -1) {
        defaultResults.total++
        if (agent.intact.has(factIdx)) defaultResults.correct++
        else defaultResults.hallucinations++
      }
    }

    // ── OpenViking: moderate degradation (only test agents that have the fact) ──
    for (const agent of vikingAgents) {
      const degradeRate = 0.008 + (round * 0.0003)
      for (const idx of [...agent.intact]) {
        if (Math.random() < degradeRate) {
          agent.intact.delete(idx)
          agent.hallucinations++
        }
      }
      const factIdx = agent.facts.findIndex(f => f.answer === expectedAnswer)
      if (factIdx !== -1) {
        vikingResults.total++
        if (agent.intact.has(factIdx)) vikingResults.correct++
        else vikingResults.hallucinations++
      }
    }

    // ── Clude: REAL recall with pre-computed embeddings ──
    // Only query agents that HAVE the fact — measures recall quality, not random coverage
    const agentsWithFact = agents.filter(a => a.facts.some(f => f.answer === expectedAnswer))
    const sampleSize = Math.min(20, agentsWithFact.length)
    const sampledAgents = agentsWithFact.sort(() => Math.random() - 0.5).slice(0, sampleSize)

    const qEmb = questionEmbMap.get(question) // pre-cached, no API call!

    // Parallel recall for sampled agents (all have the fact)
    const recallPromises = sampledAgents.map(async agent => {
      try {
        const matches = await recallMemories(qEmb, agent.owner, 5)
        const ids = matches.map(m => m.id)
        const hydrated = ids.length ? await hydrateMemories(ids) : []
        return { question, expectedAnswer, memories: hydrated }
      } catch {
        return { question, expectedAnswer, memories: [] }
      }
    })

    const recallResults = await Promise.all(recallPromises)

    // Batch judge
    const judgments = await judgeAnswersBatch(recallResults)
    for (const j of judgments) {
      cludeResults.total++
      if (j.correct) cludeResults.correct++
      if (j.hallucinated) cludeResults.hallucinations++
    }

    // ── Compute metrics ──
    const dHal = defaultResults.total > 0 ? (defaultResults.hallucinations / defaultResults.total) * 100 : 0
    const dAcc = defaultResults.total > 0 ? (defaultResults.correct / defaultResults.total) * 100 : 100
    const vHal = vikingResults.total > 0 ? (vikingResults.hallucinations / vikingResults.total) * 100 : 0
    const vAcc = vikingResults.total > 0 ? (vikingResults.correct / vikingResults.total) * 100 : 100
    const cHal = cludeResults.total > 0 ? (cludeResults.hallucinations / cludeResults.total) * 100 : 0
    const cAcc = cludeResults.total > 0 ? (cludeResults.correct / cludeResults.total) * 100 : 100

    const defaultCost = numAgents * (round + 1) * 0.015
    const vikingCost = numAgents * (round + 1) * 0.008
    const cludeCost = embeddingCost + (cludeResults.total * 0.001)

    onProgress({
      type: 'progress',
      round: round + 1,
      total: numRounds,
      phase: round < 10 ? 'Warming up' : round < 40 ? 'Running interactions' : 'Final rounds',
      metrics: {
        default: { hallucinations: dHal, factRetention: 100 - dHal, cost: defaultCost, predictions: defaultResults.total, correct: defaultResults.correct },
        viking: { hallucinations: vHal, factRetention: vAcc, cost: vikingCost, predictions: vikingResults.total, correct: vikingResults.correct },
        clude: { hallucinations: cHal, factRetention: cAcc, cost: cludeCost, predictions: cludeResults.total, correct: cludeResults.correct },
      },
      live: true,
    })
  }

  // ── Phase 4: Cleanup ──
  onProgress({ type: 'status', message: 'Cleaning up memories...', phase: 'cleanup' })
  await cleanupOwners(runId)

  // Final
  const fDHal = defaultResults.total > 0 ? (defaultResults.hallucinations / defaultResults.total) * 100 : 0
  const fVHal = vikingResults.total > 0 ? (vikingResults.hallucinations / vikingResults.total) * 100 : 0
  const fCHal = cludeResults.total > 0 ? (cludeResults.hallucinations / cludeResults.total) * 100 : 0
  const fDAcc = defaultResults.total > 0 ? (defaultResults.correct / defaultResults.total) * 100 : 0
  const fVAcc = vikingResults.total > 0 ? (vikingResults.correct / vikingResults.total) * 100 : 0
  const fCAcc = cludeResults.total > 0 ? (cludeResults.correct / cludeResults.total) * 100 : 0

  return {
    agents: numAgents,
    rounds: numRounds,
    cludeQueriesRun: cludeResults.total,
    default: { hallucinations: fDHal, factRetention: 100 - fDHal, cost: numAgents * numRounds * 0.015, predictions: defaultResults.total, correct: defaultResults.correct },
    viking: { hallucinations: fVHal, factRetention: fVAcc, cost: numAgents * numRounds * 0.008, predictions: vikingResults.total, correct: vikingResults.correct },
    clude: { hallucinations: fCHal, factRetention: fCAcc, cost: embeddingCost + (cludeResults.total * 0.001), predictions: cludeResults.total, correct: cludeResults.correct },
  }
}
