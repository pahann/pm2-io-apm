import { ServiceManager } from '../serviceManager'
import { Transport } from './transport'
import Debug from 'debug'
import type { Debugger } from 'debug'

export class Action {
  handler!: Function
  name!: string
  type!: string
  isScoped!: boolean
  callback?: Function
  arity!: number
  opts: Object | null | undefined
}

export class ActionService {

  private timer: NodeJS.Timer | undefined = undefined
  private transport: Transport | undefined = undefined
  private actions: Map<string, Action> = new Map<string, Action>()
  private logger: Debugger = Debug('axm:services:actions')

  private listener (data: unknown) {
    this.logger(`Received new message from reverse`)
    if (!data) return false

    const dataObj = data as { msg?: string; action_name?: string; opts?: unknown; uuid?: string }
    const actionName = dataObj.msg ? dataObj.msg : dataObj.action_name ? dataObj.action_name : (typeof data === 'string' ? data : '')
    let action = this.actions.get(actionName)
    if (typeof action !== 'object') {
      return this.logger(`Received action ${actionName} but failed to find the implementation`)
    }

    // handle normal custom action
    if (!action.isScoped) {
      this.logger(`Succesfully called custom action ${action.name} with arity ${action.handler.length}`)
      // In case 2 arguments has been set but no options has been transmitted
      if (action.handler.length === 2) {
        let params = {}
        if (typeof data === 'object' && data !== null) {
          params = (data as { opts?: unknown }).opts ?? {}
        }
        return action.handler(params, action.callback)
      }
      return action.handler(action.callback)
    }

    // handle scoped actions
    if (dataObj.uuid === undefined) {
      return this.logger(`Received scoped action ${action.name} but without uuid`)
    }

    // create a simple object that represent a stream
    const stream = {
      send : (dt: unknown) => {
        this.transport!.send('axm:scoped_action:stream', {
          data: dt,
          uuid: dataObj.uuid,
          action_name: actionName
        })
      },
      error : (dt: unknown) => {
        this.transport!.send('axm:scoped_action:error', {
          data: dt,
          uuid: dataObj.uuid,
          action_name: actionName
        })
      },
      end : (dt: unknown) => {
        this.transport!.send('axm:scoped_action:end', {
          data: dt,
          uuid: dataObj.uuid,
          action_name: actionName
        })
      }
    }

    this.logger(`Succesfully called scoped action ${action.name}`)
    return action.handler(dataObj.opts ?? {}, stream)
  }

  init (): void {
    this.transport = ServiceManager.get('transport')
    // tslint:disable-next-line
    if (this.transport === undefined) {
      return this.logger(`Failed to load transport service`)
    }
    this.actions.clear()
    this.transport.on('data', this.listener.bind(this))
  }

  destroy (): void {
    if (this.timer !== undefined) {
      clearInterval(this.timer)
    }
    // tslint:disable-next-line
    if (this.transport !== undefined) {
      this.transport.removeListener('data', this.listener.bind(this))
    }
  }

  /**
   * Register a custom action that will be called when we receive a call for this actionName
   */
  registerAction (actionName?: string, opts?: Object | undefined | Function, handler?: Function): void {
    if (typeof opts === 'function') {
      handler = opts
      opts = undefined
    }

    if (typeof actionName !== 'string') {
      console.error(`You must define an name when registering an action`)
      return
    }
    if (typeof handler !== 'function') {
      console.error(`You must define an callback when registering an action`)
      return
    }
    if (this.transport === undefined) {
      return this.logger(`Failed to load transport service`)
    }

    let type = 'custom'

    if (actionName.indexOf('km:') === 0 || actionName.indexOf('internal:') === 0) {
      type = 'internal'
    }

    const reply = (data: unknown) => {
      this.transport!.send('axm:reply', {
        at: new Date().getTime(),
        action_name: actionName,
        return: data
      })
    }

    const action: Action = {
      name: actionName,
      callback: reply,
      handler,
      type,
      isScoped: false,
      arity: handler.length,
      opts
    }
    this.logger(`Succesfully registered custom action ${action.name}`)
    this.actions.set(actionName, action)
    this.transport.addAction(action)
  }
}
