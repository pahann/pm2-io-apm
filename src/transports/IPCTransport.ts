import * as cluster from 'cluster'
import Debug from 'debug'
import type { Debugger } from 'debug'
import { EventEmitter2 } from 'eventemitter2'
import type { Action } from '../services/actions'
import type { InternalMetric } from '../services/metrics'
import type { Transport, TransportConfig } from '../services/transport'

type MessageHandler = (data?: Object) => void

type NodeProcessWithInternals = NodeJS.Process & {
  _getActiveHandles?: () => Array<{ constructor: { name: string } }>
}

type ClusterWithWorker = typeof cluster & {
  isWorker?: boolean
  worker?: {
    process: NodeJS.Process
  }
}

export class IPCTransport extends EventEmitter2 implements Transport {

  private initiated = false // tslint:disable-line
  private logger: Debugger = Debug('axm:transport:ipc')
  private onMessage: MessageHandler | undefined
  private autoExitHandle: NodeJS.Timer | undefined

  init (_config?: TransportConfig): Transport {
    this.logger('Init new transport service')
    if (this.initiated === true) {
      console.error(`Trying to re-init the transport, please avoid`)
      return this
    }
    this.initiated = true
    this.logger('Agent launched')
    this.onMessage = (data?: Object) => {
      this.logger(`Received reverse message from IPC`)
      this.emit('data', data)
    }
    process.on('message', this.onMessage)

    // if the process is standalone, the fact that there is a listener attached
    // forbid the event loop to exit when there are no other task there
    // @ts-expect-error
    if (cluster.isWorker === false) {
      this.autoExitHook()
    }
    return this
  }

  private autoExitHook () {
    // clean listener if event loop is empty
    // important to ensure apm will not prevent application to stop
    this.autoExitHandle = setInterval(() => {
      const clusterWithWorker = cluster as ClusterWithWorker
      const currentProcess: NodeProcessWithInternals = (clusterWithWorker.isWorker && clusterWithWorker.worker) ? clusterWithWorker.worker.process : process

      if (typeof currentProcess._getActiveHandles === "function" && currentProcess._getActiveHandles().length === 3) {
        const handlers: string[] = currentProcess._getActiveHandles().map((h) => h.constructor.name)

        if (handlers.includes('Pipe') === true &&
            handlers.includes('Socket') === true && this.onMessage) {
          process.removeListener('message', this.onMessage)
          const tmp = setTimeout((_: unknown) => {
            this.logger(`Still alive, listen back to IPC`)
            if (this.onMessage) process.on('message', this.onMessage)
          }, 200)
          tmp.unref()
        }
      }
    }, 3000)

    this.autoExitHandle.unref()
  }

  setMetrics (metrics: InternalMetric[]) {
    const serializedMetric = metrics.reduce((object: Record<string, unknown>, metric: InternalMetric) => {
      if (typeof metric.name !== 'string') return object
      object[metric.name] = {
        historic: metric.historic,
        unit: metric.unit,
        type: metric.id,
        value: metric.value
      }
      return object
    }, {})
    this.send('axm:monitor', serializedMetric)
  }

  addAction (action: Action) {
    this.logger(`Add action: ${action.name}:${action.type}`)
    this.send('axm:action', {
      action_name: action.name,
      action_type: action.type,
      arity: action.arity,
      opts: action.opts
    })
  }

  setOptions (options: unknown) {
    this.logger(`Set options: [${options && typeof options === 'object' ? Object.keys(options).join(',') : ''}]`)
    return this.send('axm:option:configuration', options)
  }

  send (channel: string, payload: unknown): number | void {
    if (typeof process.send !== 'function') return -1
    if (process.connected === false) {
      console.error('Process disconnected from parent! (not connected)')
      return process.exit(1)
    }

    try {
      this.logger(`Send on channel ${channel}`)
      process.send({ type: channel, data: payload })
    } catch (err) {
      this.logger('Process disconnected from parent !')
      this.logger(err)
      return process.exit(1)
    }
  }

  destroy () {
    if (this.onMessage !== undefined) {
      process.removeListener('message', this.onMessage)
    }
    if (this.autoExitHandle !== undefined) {
      clearInterval(this.autoExitHandle)
    }
    this.logger('destroy')
  }
}
