import pmx from '../../../src'

pmx.init({
  tracing: {
    enabled: true,
    samplingRate: 1 // Trace all requests
  }
})

// @ts-expect-error - CI only: express installed only in CI environment
import * as express from 'express'
import { AddressInfo } from 'net'

const app = express()

// Endpoint with instant response (< 1ms)
app.get('/instant', (_req, res) => {
  res.send('instant')
})

// Endpoint with 2ms delay
app.get('/slow', (_req, res) => {
  setTimeout(() => {
    res.send('slow')
  }, 2)
})

const server = app.listen(0, () => {
  const port = (server.address() as AddressInfo).port
  const http = require('http')

  // Make instant request (should be < 1ms)
  http.get(`http://localhost:${port}/instant`, () => {})

  // Make slow request (should be > 1ms)
  setTimeout(() => {
    http.get(`http://localhost:${port}/slow`, () => {})
  }, 100)
})

process.on('SIGINT', () => {
  server.close()
  pmx.destroy()
})
