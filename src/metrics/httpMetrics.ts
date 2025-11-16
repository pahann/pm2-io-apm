'use strict'

import * as shimmer from 'shimmer'
import Debug from 'debug'
import type { Debugger } from 'debug'
import Configuration from '../configuration'
import { MetricInterface } from '../features/metrics'
import { ServiceManager } from '../serviceManager'
// import Meter from '../utils/metrics/meter'
import Histogram from '../utils/metrics/histogram'
import requireMiddle from 'require-in-the-middle'

import {
  MetricService,
  InternalMetric,
  MetricType,
  Metric
} from '../services/metrics'

export class HttpMetricsConfig {
  http!: boolean
}

export default class HttpMetrics implements MetricInterface {

  private defaultConf: HttpMetricsConfig = {
    http: true
  }
  private metrics: Map<string, unknown> = new Map<string, unknown>()
  private logger: Debugger = Debug('axm:features:metrics:http')
  private metricService: MetricService | undefined
  private modules: Record<string, unknown> = {}
  private hooks: { unhook: () => void } | undefined

  init (config?: HttpMetricsConfig | boolean) {
    if (config === false) return
    if (config === undefined) {
      config = this.defaultConf
    }
    if (typeof config !== 'object') {
      config = this.defaultConf
    }
    this.logger('init')
    Configuration.configureModule({
      latency: true
    })
    this.metricService = ServiceManager.get('metrics')
    if (this.metricService === undefined) return this.logger(`Failed to load metric service`)

    this.logger('hooking to require')
    this.hookRequire()
  }

  private registerHttpMetric () {
    if (this.metricService === undefined) return this.logger(`Failed to load metric service`)
    const histogram = new Histogram({ measurement: 'mean' })
    const p50: InternalMetric = {
      name: `HTTP Mean Latency`,
      id: 'internal/http/builtin/latency/p50',
      type: MetricType.histogram,
      historic: true,
      implementation: histogram,
      unit: 'ms',
      handler: () => {
        const percentiles = histogram.percentiles([ 0.5 ])
        return percentiles[0.5]
      }
    }
    const p95: InternalMetric = {
      name: `HTTP P95 Latency`,
      id: 'internal/http/builtin/latency/p95',
      type: MetricType.histogram,
      historic: true,
      implementation: histogram,
      handler: () => {
        const percentiles = histogram.percentiles([ 0.95 ])
        return percentiles[0.95]
      },
      unit: 'ms'
    }
    const meter: Metric = {
      name: 'HTTP',
      historic: true,
      id: 'internal/http/builtin/reqs',
      unit: 'req/min'
    }
    this.metricService.registerMetric(p50)
    this.metricService.registerMetric(p95)
    this.metrics.set('http.latency', histogram)
    this.metrics.set('http.meter', this.metricService.meter(meter))
  }

  private registerHttpsMetric () {
    if (this.metricService === undefined) return this.logger(`Failed to load metric service`)
    const histogram = new Histogram({ measurement: 'mean' })
    const p50: InternalMetric = {
      name: `HTTPS Mean Latency`,
      id: 'internal/https/builtin/latency/p50',
      type: MetricType.histogram,
      historic: true,
      implementation: histogram,
      unit: 'ms',
      handler: () => {
        const percentiles = histogram.percentiles([ 0.5 ])
        return percentiles[0.5]
      }
    }
    const p95: InternalMetric = {
      name: `HTTPS P95 Latency`,
      id: 'internal/https/builtin/latency/p95',
      type: MetricType.histogram,
      historic: true,
      implementation: histogram,
      handler: () => {
        const percentiles = histogram.percentiles([ 0.95 ])
        return percentiles[0.95]
      },
      unit: 'ms'
    }
    const meter: Metric = {
      name: 'HTTPS',
      historic: true,
      id: 'internal/https/builtin/reqs',
      unit: 'req/min'
    }
    this.metricService.registerMetric(p50)
    this.metricService.registerMetric(p95)
    this.metrics.set('https.latency', histogram)
    this.metrics.set('https.meter', this.metricService.meter(meter))
  }

  destroy () {
    if (this.modules.http !== undefined && this.modules.http !== null) {
      this.logger('unwraping http module')
      shimmer.unwrap(this.modules.http as Record<string, unknown>, 'emit')
      this.modules.http = undefined
    }
    if (this.modules.https !== undefined && this.modules.https !== null) {
      this.logger('unwraping https module')
      shimmer.unwrap(this.modules.https as Record<string, unknown>, 'emit')
      this.modules.https = undefined
    }
    if (this.hooks) {
      this.hooks.unhook()
    }
    this.logger('destroy')
  }

  /**
   * Hook the http emit event emitter to be able to track response latency / request count
   */
  private hookHttp (nodule: unknown, name: string) {
    if (!nodule || typeof nodule !== 'object') return
    type HttpModule = { Server?: { prototype?: unknown } }
    const httpModule = nodule as HttpModule
    if (httpModule.Server === undefined || httpModule.Server.prototype === undefined) return
    if (this.modules[name] !== undefined) return this.logger(`Module ${name} already hooked`)
    this.logger(`Hooking to ${name} module`)
    this.modules[name] = httpModule.Server.prototype
    // register the metrics
    if (name === 'http') {
      this.registerHttpMetric()
    } else if (name === 'https') {
      this.registerHttpsMetric()
    }
    const self = this
    const serverPrototype = httpModule.Server.prototype
    if (serverPrototype === null || serverPrototype === undefined) return
    // wrap the emitter
    shimmer.wrap(serverPrototype as Record<string, unknown>, 'emit', ((original: Function) => {
      return function (this: unknown, event: string, _req: unknown, res: unknown) {
        // only handle http request
        if (event !== 'request') return original.apply(this, arguments)

        const meter = self.metrics.get(`${name}.meter`) as { mark: () => void } | undefined
        if (meter !== undefined && typeof meter.mark === 'function') {
          meter.mark()
        }
        const latency = self.metrics.get(`${name}.latency`) as { update: (value: number) => void } | undefined
        if (latency === undefined || typeof latency.update !== 'function') return original.apply(this, arguments)
        if (res === undefined || res === null) return original.apply(this, arguments)
        const startTime = Date.now()
        // wait for the response to set the metrics
        type ResponseLike = { once: (event: string, handler: () => void) => void }
        if (res && typeof (res as ResponseLike).once === 'function') {
          (res as ResponseLike).once('finish', () => {
            if (latency && typeof latency.update === 'function') {
              latency.update(Date.now() - startTime)
            }
          })
        }
        return original.apply(this, arguments)
      }
    }) as (original: unknown) => unknown)
  }

  private hookRequire () {
    this.hooks = requireMiddle(['http', 'https'], (exports: unknown, name: string) => {
      this.hookHttp(exports, name)
      return exports
    })
  }
}
