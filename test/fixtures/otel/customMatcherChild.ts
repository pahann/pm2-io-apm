import pmx from '../../../src'

pmx.init({
  tracing: {
    enabled: true,
    samplingRate: 1,
    ignoreIncomingPaths: [
      (url) => {
        return url.startsWith('/internal')
      }
    ]
  }
})

// @ts-expect-error - CI only: express installed only in CI environment
import * as express from 'express'
import { AddressInfo } from 'net'

const app = express()

app.get('/public/api', (_req, res) => res.send('public'))
app.get('/internal/health', (_req, res) => res.send('health'))
app.get('/internal/metrics', (_req, res) => res.send('metrics'))

const server = app.listen(0, () => {
  const port = (server.address() as AddressInfo).port
  const http = require('http')

  http.get(`http://localhost:${port}/public/api`, () => {})
  http.get(`http://localhost:${port}/internal/health`, () => {})
  http.get(`http://localhost:${port}/internal/metrics`, () => {})
})

process.on('SIGINT', () => {
  server.close()
  pmx.destroy()
})
