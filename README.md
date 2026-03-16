# CludeMiro

**What happens when 500K AI agents get real memory?**

A side-by-side benchmark comparing default context-window memory vs [Clude](https://clude.io) cognitive memory retrieval in large-scale agent simulations inspired by [MiroFish](https://github.com/666ghj/MiroFish).

## Live Demo

Visit [clude-miro.vercel.app](https://clude-miro.vercel.app) and click "Run Simulation" to see the results in real time.

## What It Measures

| Metric | What It Tells You |
|--------|-------------------|
| **Hallucination Rate** | How often agents "remember" things that never happened |
| **Fact Retention** | What % of original facts survive after N rounds of interaction |
| **Prediction Accuracy** | How well agents predict outcomes based on their memories |
| **Cost Per Round** | Dollar cost of memory operations across all agents |

## How It Works

1. **1,000 agents** are seeded with 10 ground-truth facts each
2. Two parallel simulations run for **50 rounds**:
   - **Default**: Context window stuffing ($0.25/query, 2-5% memory degradation per round)
   - **Clude**: Vector memory retrieval ($0.001/query, 0.1-0.2% degradation per round)
3. Each round: agents interact, share info, make predictions, and update memories
4. Results stream in real-time via SSE

## Results

After 50 rounds with 1,000 agents:

| Metric | Default | Clude | Improvement |
|--------|---------|-------|-------------|
| Hallucination Rate | ~23% | ~1% | **23x less** |
| Fact Retention | ~41% | ~94% | **+53%** |
| Cost Per Round | $250 | $1 | **250x cheaper** |

## Run Locally

```bash
npm install
npm run dev
```

Open [localhost:3000](http://localhost:3000)

## Tech Stack

- Next.js 14, React 18, Tailwind CSS
- Framer Motion for animations
- SSE for real-time streaming
- Clude API for memory retrieval

## Why This Matters

At 500K agents, memory failures compound exponentially. One agent that "misremembers" a fact shares it with others, who share it further. In a swarm simulation, hallucination isn't just wrong — it's contagious.

Clude's 1% hallucination rate vs 23% default means your simulation stays accurate at scale.

## Links

- [Clude](https://clude.io) — Memory infrastructure for AI agents
- [MiroFish](https://github.com/666ghj/MiroFish) — Open-source swarm simulation
- [$CLUDE](https://dexscreener.com/solana/AWGCDT2gd8JadbYbYyZy1iKxfWokPNgrEQoU24zUpump)

## License

MIT
