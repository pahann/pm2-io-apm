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

  // Send requests to generate spans
  for (let i = 0; i < 10; i++) {
    http.get(`http://localhost:${port}/test`, () => {})
  }

  setTimeout(() => {
    server.close()
    if (process.send) {
      process.send({ type: 'ready-to-shutdown' })
    }
  }, 100)
})

process.on('message', async (msg: Record<string, string>) => {
  if (msg.type === 'shutdown-and-measure') {
    // Get access to the otel instance
    const featureManager = (pmx as Record<string, unknown>).featureManager
    if (featureManager && typeof featureManager === 'object') {
      const get = (featureManager as Record<string, unknown>).get
      if (typeof get === 'function') {
        const tracing = get('tracing') as Record<string, unknown> | undefined
        if (tracing && tracing.otel) {
          const otel = tracing.otel as Record<string, () => Promise<void>>

          // Measure shutdown time
          const start = Date.now()
          await otel.shutdown()
          const duration = Date.now() - start

          if (process.send) {
            process.send({ type: 'shutdown-duration', duration })
          }
          return
        }
      }
    }

    if (process.send) {
      process.send({ type: 'shutdown-duration', duration: 0 })
    }
  }
})
