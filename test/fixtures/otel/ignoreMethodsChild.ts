import pmx from '../../../src'

pmx.init({
  tracing: {
    enabled: true,
    samplingRate: 1,
    ignoreIncomingPaths: [
      (_url, request) => {
        const method = (request.method || 'GET').toLowerCase()
        return ['options', 'head'].includes(method)
      }
    ]
  }
})

// @ts-expect-error - CI only: express installed only in CI environment
import * as express from 'express'
import { AddressInfo } from 'net'

const app = express()

app.all('/api/test', (_req, res) => res.send('ok'))

const server = app.listen(0, () => {
  const port = (server.address() as AddressInfo).port
  const http = require('http')

  // GET request
  http.get(`http://localhost:${port}/api/test`, () => {})

  // OPTIONS request
  http.request({
    hostname: 'localhost',
    port,
    path: '/api/test',
    method: 'OPTIONS'
  }).end()

  // HEAD request
  http.request({
    hostname: 'localhost',
    port,
    path: '/api/test',
    method: 'HEAD'
  }).end()
})

process.on('SIGINT', () => {
  server.close()
  pmx.destroy()
})
