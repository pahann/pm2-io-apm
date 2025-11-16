import * as netModule from 'net'
import { MetricService, MetricType } from '../services/metrics'
import { MetricInterface } from '../features/metrics'
import Debug from 'debug'
import type { Debugger } from 'debug'
import Meter from '../utils/metrics/meter'
import * as shimmer from 'shimmer'
import { ServiceManager } from '../serviceManager'

export class NetworkTrafficConfig {
  upload!: boolean
  download!: boolean
}

const defaultConfig: NetworkTrafficConfig = {
  upload: false,
  download: false
}

const allEnabled: NetworkTrafficConfig = {
  upload: true,
  download: true
}

export default class NetworkMetric implements MetricInterface {
  private metricService: MetricService | undefined
  private timer: NodeJS.Timer | undefined
  private logger: Debugger = Debug('axm:features:metrics:network')
  private socketProto: unknown

  init (config?: NetworkTrafficConfig | boolean) {
    if (config === false) return
    if (config === true) {
      config = allEnabled
    }
    if (config === undefined) {
      config = defaultConfig
    }

    this.metricService = ServiceManager.get('metrics')
    if (this.metricService === undefined) {
      return this.logger(`Failed to load metric service`)
    }

    if (config.download === true) {
      this.catchDownload()
    }
    if (config.upload === true) {
      this.catchUpload()
    }
    this.logger('init')
  }

  destroy () {
    if (this.timer !== undefined) {
      clearTimeout(this.timer)
    }

    if (this.socketProto !== undefined && this.socketProto !== null) {
      shimmer.unwrap(this.socketProto as Record<string, unknown>, 'read')
      shimmer.unwrap(this.socketProto as Record<string, unknown>, 'write')
    }

    this.logger('destroy')
  }

  private catchDownload () {
    if (this.metricService === undefined) return this.logger(`Failed to load metric service`)
    const downloadMeter = new Meter({})

    this.metricService.registerMetric({
      name: 'Network In',
      id: 'internal/network/in',
      historic: true,
      type: MetricType.meter,
      implementation: downloadMeter,
      unit: 'kb/s',
      handler: function () {
        const impl = this.implementation as Meter
        return Math.floor((impl.val() as number) / 1024 * 1000) / 1000
      }
    })

    setTimeout(() => {
      const property = netModule.Socket.prototype.read
      // @ts-expect-error - Monkey patching: shimmer adds __wrapped property at runtime
      const isWrapped = property && property.__wrapped === true
      if (isWrapped) {
        return this.logger(`Already patched socket read, canceling`)
      }
      type ReadableSocket = { on: (event: string, handler: (data: Buffer | string) => void) => void; read: (size?: number) => unknown }
      shimmer.wrap(netModule.Socket.prototype as unknown as Record<string, unknown>, 'read', function (original: (size?: number) => unknown) {
        return function (this: ReadableSocket, size?: number) {
          this.on('data', (data: Buffer | string) => {
            if (data && typeof data === 'object' && 'length' in data) {
              downloadMeter.mark(data.length)
            }
          })
          return original.call(this, size)
        }
      } as (original: unknown) => unknown)
    }, 500)
  }

  private catchUpload () {
    if (this.metricService === undefined) return this.logger(`Failed to load metric service`)
    const uploadMeter = new Meter()
    this.metricService.registerMetric({
      name: 'Network Out',
      id: 'internal/network/out',
      type: MetricType.meter,
      historic: true,
      implementation: uploadMeter,
      unit: 'kb/s',
      handler: function () {
        const impl = this.implementation as Meter
        return Math.floor((impl.val() as number) / 1024 * 1000) / 1000
      }
    })

    setTimeout(() => {
      const property = netModule.Socket.prototype.write
      // @ts-expect-error - Monkey patching: shimmer adds __wrapped property at runtime
      const isWrapped = property && property.__wrapped === true
      if (isWrapped) {
        return this.logger(`Already patched socket write, canceling`)
      }
      type WriteFn = (buffer: string | Uint8Array, cb?: (err?: Error) => void) => boolean
      shimmer.wrap(netModule.Socket.prototype as unknown as Record<string, unknown>, 'write', function (original: WriteFn) {
        return function (this: unknown, buffer: string | Uint8Array, cb?: (err?: Error) => void) {
          if (buffer && typeof buffer === 'object' && 'length' in buffer && typeof buffer.length === 'number') {
            uploadMeter.mark(buffer.length)
          }
          return original.call(this, buffer, cb)
        }
      } as (original: unknown) => unknown)
    }, 500)
  }
}
