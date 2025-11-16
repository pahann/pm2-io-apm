import pmx from '../../../src'

pmx.init({
  tracing: {
    enabled: true,
    samplingRate: 1,
    ignoreIncomingPaths: [
      /(.*).js$/,
      /(.*).css$/,
      /(.*).ico$/
    ]
  }
})

// @ts-expect-error - CI only: express installed only in CI environment
import * as express from 'express'
import { AddressInfo } from 'net'

const app = express()

app.get('/api/users', (_req, res) => res.send('users'))
app.get('/static/app.js', (_req, res) => res.send('// js'))
app.get('/static/style.css', (_req, res) => res.send('/* css */'))
app.get('/favicon.ico', (_req, res) => res.send('icon'))

const server = app.listen(0, () => {
  const port = (server.address() as AddressInfo).port
  const http = require('http')

  http.get(`http://localhost:${port}/api/users`, () => {})
  http.get(`http://localhost:${port}/static/app.js`, () => {})
  http.get(`http://localhost:${port}/static/style.css`, () => {})
  http.get(`http://localhost:${port}/favicon.ico`, () => {})
})

process.on('SIGINT', () => {
  server.close()
  pmx.destroy()
})
