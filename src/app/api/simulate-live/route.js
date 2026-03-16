import { runLiveSimulation } from '../../../lib/live-simulation'

export const maxDuration = 300 // 5 min timeout for Vercel

export async function POST(request) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      try {
        const results = await runLiveSimulation(1000, 50, send)
        send({ type: 'complete', results })
      } catch (err) {
        send({ type: 'error', message: err.message })
      }

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
