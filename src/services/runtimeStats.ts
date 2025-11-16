'use strict'

import Debug from 'debug'
import type { Debugger } from 'debug'
import utils from '../utils/module'
import { EventEmitter2 } from 'eventemitter2'

type RuntimeStatsModule = {
  start?: () => void
  stop?: () => void
  on?: (event: string, handler: (data: unknown) => void) => void
  removeListener?: (event: string, handler: (data: unknown) => void) => void
}

export class RuntimeStatsService extends EventEmitter2 {

  private logger: Debugger = Debug('axm:services:runtimeStats')
  private handle!: (data: unknown) => void
  private noduleInstance: RuntimeStatsModule | undefined
  private enabled: boolean = false

  init () {
    this.logger('init')
    if (process.env.PM2_APM_DISABLE_RUNTIME_STATS === 'true') {
      return this.logger('disabling service because of the environment flag')
    }
    // try to find the module
    const modulePath = utils.detectModule('@pm2/node-runtime-stats')
    if (typeof modulePath !== 'string') return
    // if we find it we can try to require it
    const RuntimeStats = utils.loadModule(modulePath)
    if (RuntimeStats instanceof Error) {
      return this.logger(`Failed to require module @pm2/node-runtime-stats: ${RuntimeStats.message}`)
    }
    // Cast to constructor type since we know it's a class if not an Error
    const RuntimeStatsConstructor = RuntimeStats as new (opts: { delay: number }) => RuntimeStatsModule
    this.noduleInstance = new RuntimeStatsConstructor({
      delay: 1000
    })
    this.logger('starting runtime stats')
    if (this.noduleInstance && typeof this.noduleInstance.start === 'function') {
      this.noduleInstance.start()
    }
    this.handle = (data: unknown) => {
      this.logger('received runtime stats', data)
      this.emit('data', data)
    }
    // seriously i just created it two lines above
    if (this.noduleInstance && typeof this.noduleInstance.on === 'function') {
      this.noduleInstance.on('sense', this.handle)
    }
    this.enabled = true
  }

  /**
   * Is the service ready to send metrics about the runtime
   */
  isEnabled (): boolean {
    return this.enabled
  }

  destroy () {
    if (this.noduleInstance !== undefined) {
      this.logger('removing listener on runtime stats service')
      if (typeof this.noduleInstance.removeListener === 'function') {
        this.noduleInstance.removeListener('sense', this.handle)
      }
      if (typeof this.noduleInstance.stop === 'function') {
        this.noduleInstance.stop()
      }
    }
    this.logger('destroy')
  }
}
