import { expect } from 'chai'
import { fork } from 'child_process'
import { resolve } from 'path'

const launch = (fixture: string) => {
  return fork(resolve(__dirname, fixture), [], {
    execArgv: process.env.NYC_ROOT_ID ? process.execArgv : [ '-r', 'ts-node/register' ],
    env: { NODE_ENV: 'test' }
  })
}

describe('Span Filtering', function () {
  this.timeout(15000)

  describe('MINIMUM_TRACE_DURATION', () => {
    it('should filter out short duration spans in production', (done) => {
      const child = fork(resolve(__dirname, '../fixtures/otel/minimumDurationChild.ts'), [], {
        execArgv: process.env.NYC_ROOT_ID ? process.execArgv : [ '-r', 'ts-node/register' ],
        env: { NODE_ENV: 'production' } // NOT test mode
      })

      const spans: Record<string, unknown>[] = []

      child.on('message', (pck: Record<string, unknown>) => {
        if (pck.type !== 'trace-span') return
        spans.push(pck.data as Record<string, unknown>)
      })

      setTimeout(() => {
        child.kill('SIGINT')

        // In production mode, MINIMUM_TRACE_DURATION = 1000 microseconds (1ms)
        // Spans shorter than 1ms should be filtered
        const shortSpans = spans.filter(span => (span.duration as number) < 1000)
        expect(shortSpans.length).to.equal(0, 'Short spans should be filtered in production')

        done()
      }, 3000)
    })

    it('should allow all spans in test mode', (done) => {
      const child = launch('../fixtures/otel/minimumDurationChild.ts')

      const spans: Record<string, unknown>[] = []
      let hasVeryShortSpan = false

      child.on('message', (pck: Record<string, unknown>) => {
        if (pck.type !== 'trace-span') return
        const span = pck.data as Record<string, unknown>
        spans.push(span)

        // Check if we received a very short span (< 1ms)
        if ((span.duration as number) < 1000) {
          hasVeryShortSpan = true
        }
      })

      setTimeout(() => {
        child.kill('SIGINT')

        // In test mode, MINIMUM_TRACE_DURATION = 0
        // So even very short spans should pass through
        expect(hasVeryShortSpan).to.equal(true, 'Should allow short spans in test mode')

        done()
      }, 3000)
    })
  })

  describe('ignoreIncomingPaths', () => {
    it('should ignore paths matching regex patterns', (done) => {
      const child = launch('../fixtures/otel/ignoreIncomingChild.ts')

      const spans: Record<string, unknown>[] = []

      child.on('message', (pck: Record<string, unknown>) => {
        if (pck.type !== 'trace-span') return
        spans.push(pck.data as Record<string, unknown>)
      })

      setTimeout(() => {
        child.kill('SIGINT')

        // The fixture requests:
        // - /api/users (should be traced)
        // - /static/app.js (should be ignored - matches *.js)
        // - /static/style.css (should be ignored - matches *.css)
        // - /favicon.ico (should be ignored - matches *.ico)

        const tracedPaths = spans.map(span => span.name)

        // Should have /api/users
        const hasApiUsers = tracedPaths.some(name => String(name).includes('/api/users'))
        expect(hasApiUsers).to.equal(true, 'Should trace /api/users')

        // Should NOT have .js, .css, or .ico paths
        const hasJsPath = tracedPaths.some(name => String(name).includes('.js'))
        const hasCssPath = tracedPaths.some(name => String(name).includes('.css'))
        const hasIcoPath = tracedPaths.some(name => String(name).includes('.ico'))

        expect(hasJsPath).to.equal(false, 'Should ignore .js paths')
        expect(hasCssPath).to.equal(false, 'Should ignore .css paths')
        expect(hasIcoPath).to.equal(false, 'Should ignore .ico paths')

        done()
      }, 3000)
    })

    it('should ignore OPTIONS and HEAD requests', (done) => {
      const child = launch('../fixtures/otel/ignoreMethodsChild.ts')

      const spans: Record<string, unknown>[] = []

      child.on('message', (pck: Record<string, unknown>) => {
        if (pck.type !== 'trace-span') return
        spans.push(pck.data as Record<string, unknown>)
      })

      setTimeout(() => {
        child.kill('SIGINT')

        // The fixture sends:
        // - GET /api/test (should be traced)
        // - OPTIONS /api/test (should be ignored)
        // - HEAD /api/test (should be ignored)

        const spanTags = spans.map(span => (span.tags as Record<string, string>))
        const methods = spanTags
          .filter(tags => tags && tags['http.method'])
          .map(tags => tags['http.method'])

        expect(methods).to.not.include('OPTIONS', 'Should ignore OPTIONS requests')
        expect(methods).to.not.include('HEAD', 'Should ignore HEAD requests')
        expect(methods).to.include('GET', 'Should trace GET requests')

        done()
      }, 3000)
    })

    it('should support custom function matchers', (done) => {
      const child = launch('../fixtures/otel/customMatcherChild.ts')

      const spans: Record<string, unknown>[] = []

      child.on('message', (pck: Record<string, unknown>) => {
        if (pck.type !== 'trace-span') return
        spans.push(pck.data as Record<string, unknown>)
      })

      setTimeout(() => {
        child.kill('SIGINT')

        // The fixture uses a custom matcher that ignores paths starting with /internal
        const spanNames = spans.map(span => span.name)

        const hasInternalPath = spanNames.some(name => String(name).startsWith('/internal'))
        expect(hasInternalPath).to.equal(false, 'Should ignore /internal paths')

        const hasPublicPath = spanNames.some(name => String(name).includes('/public'))
        expect(hasPublicPath).to.equal(true, 'Should trace /public paths')

        done()
      }, 3000)
    })
  })

  describe('ignoreOutgoingUrls', () => {
    it('should ignore outgoing requests matching patterns', (done) => {
      const child = launch('../fixtures/otel/ignoreOutgoingChild.ts')

      const spans: Record<string, unknown>[] = []

      child.on('message', (pck: Record<string, unknown>) => {
        if (pck.type !== 'trace-span') return
        spans.push(pck.data as Record<string, unknown>)
      })

      setTimeout(() => {
        child.kill('SIGINT')

        // The fixture makes outgoing requests to:
        // - http://api.example.com/users (should be traced)
        // - http://localhost:8125/metrics (should be ignored - metrics endpoint)
        // - http://internal-health-check/ping (should be ignored)

        const spanTags = spans.map(span => (span.tags as Record<string, string>))
        const urls = spanTags
          .filter(tags => tags && tags['http.url'])
          .map(tags => tags['http.url'])

        const hasApiCall = urls.some(url => url && url.includes('api.example.com'))
        expect(hasApiCall).to.equal(true, 'Should trace API calls')

        const hasMetricsCall = urls.some(url => url && url.includes('metrics'))
        expect(hasMetricsCall).to.equal(false, 'Should ignore metrics endpoint')

        const hasHealthCheck = urls.some(url => url && url.includes('health-check'))
        expect(hasHealthCheck).to.equal(false, 'Should ignore health checks')

        done()
      }, 3000)
    })
  })

  describe('samplingRate', () => {
    it('should sample approximately 50% of traces when samplingRate is 0.5', (done) => {
      const child = launch('../fixtures/otel/samplingChild.ts')

      const spans: Record<string, unknown>[] = []
      let requestCount = 0

      child.on('message', (pck: Record<string, unknown>) => {
        if (pck.type === 'request-sent') {
          requestCount++
        }
        if (pck.type === 'trace-span') {
          spans.push(pck.data as Record<string, unknown>)
        }
      })

      setTimeout(() => {
        child.kill('SIGINT')

        // The fixture sends 20 requests with samplingRate: 0.5
        // We expect ~10 traces (with some variance)
        const samplingRatio = spans.length / requestCount

        expect(requestCount).to.be.at.least(10, 'Should send multiple requests')
        expect(samplingRatio).to.be.within(0.3, 0.7, 'Sampling ratio should be around 0.5 ± 0.2')

        done()
      }, 5000)
    })

    it('should trace all requests when samplingRate is 1.0', (done) => {
      const child = launch('../fixtures/otel/samplingFullChild.ts')

      const spans: Record<string, unknown>[] = []
      let requestCount = 0

      child.on('message', (pck: Record<string, unknown>) => {
        if (pck.type === 'request-sent') {
          requestCount++
        }
        if (pck.type === 'trace-span') {
          spans.push(pck.data as Record<string, unknown>)
        }
      })

      setTimeout(() => {
        child.kill('SIGINT')

        // With samplingRate: 1.0, all requests should be traced
        const samplingRatio = spans.length / requestCount

        expect(requestCount).to.be.at.least(5, 'Should send multiple requests')
        expect(samplingRatio).to.equal(1.0, 'All requests should be traced with samplingRate 1.0')

        done()
      }, 3000)
    })
  })
})
