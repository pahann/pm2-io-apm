import pmx from '../../../src'

pmx.init({
  tracing: {
    enabled: true,
    samplingRate: 1
  }
})

// @ts-expect-error - CI only: express installed only in CI environment
import * as express from 'express'
import { AddressInfo } from 'net'

const app = express()

app.get('/test', (_req, res) => {
  res.send('ok')
})

const server = app.listen(0, () => {
  const port = (server.address() as AddressInfo).port
  const http = require('http')

  // Send 5 requests
  for (let i = 0; i < 5; i++) {
    http.get(`http://localhost:${port}/test`, () => {
      if (process.send) {
        process.send({ type: 'request-sent' })
      }
    })
  }

  setTimeout(() => {
    server.close()
    if (process.send) {
      process.send({ type: 'ready-to-shutdown' })
    }
  }, 100)
})

// Listen for graceful shutdown
process.on('message', async (msg: Record<string, string>) => {
  if (msg.type === 'shutdown') {
    // Simulate graceful shutdown with manual flush
    // In a real implementation, this would await TracingFeature.forceFlush()

    // Access the tracing feature and get the shutdown promise
    const tracingFeature = (pmx as Record<string, unknown>).featureManager
    if (tracingFeature && typeof tracingFeature === 'object') {
      const tracing = (tracingFeature as Record<string, unknown>).get
      if (typeof tracing === 'function') {
        const tracingInstance = tracing('tracing') as Record<string, unknown> | undefined
        if (tracingInstance && tracingInstance.otel) {
          const otel = tracingInstance.otel as Record<string, () => Promise<void>>
          if (typeof otel.shutdown === 'function') {
            // Properly await the shutdown
            await otel.shutdown()
          }
        }
      }
    }

    if (process.send) {
      process.send({ type: 'shutdown-complete' })
    }
  }
})
