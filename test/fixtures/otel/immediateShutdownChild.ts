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

  // Send 5 requests quickly
  for (let i = 0; i < 5; i++) {
    http.get(`http://localhost:${port}/test`, () => {
      if (process.send) {
        process.send({ type: 'request-sent' })
      }
    })
  }

  // Signal ready to shutdown immediately after requests
  setTimeout(() => {
    server.close()
    if (process.send) {
      process.send({ type: 'ready-to-shutdown' })
    }
  }, 100)
})
