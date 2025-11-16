import Debug from 'debug'
const debug = Debug('axm:configuration')

import { ServiceManager } from './serviceManager'
import Autocast from './utils/autocast'
import * as path from 'path'
import * as fs from 'fs'

export type ConfigObject = {
  module_conf?: Record<string, unknown>
  apm?: {
    type: string
    version: string | null
  }
  isModule?: boolean
  module_version?: string
  module_name?: string
  description?: string
  [key: string]: unknown
}

export default class Configuration {

  static configureModule (opts: Record<string, unknown>) {
    if (ServiceManager.get('transport')) ServiceManager.get('transport').setOptions(opts)
  }

  static findPackageJson (): string | null {
    try {
      require.main = Configuration.getMain()
    } catch (_e) {
      // Ignore error when getter is set on require.main, but no setter
    }

    if (!require.main) {
      return null
    }

    if (!require.main.paths) {
      return null
    }

    let pkgPath = path.resolve(path.dirname(require.main.filename), 'package.json')
    try {
      fs.statSync(pkgPath)
    } catch (e) {
      try {
        pkgPath = path.resolve(path.dirname(require.main.filename), '..', 'package.json')
        fs.statSync(pkgPath)
      } catch (e) {
        debug('Cannot find package.json')
        try {
          pkgPath = path.resolve(path.dirname(require.main.filename), '..', '..', 'package.json')
          fs.statSync(pkgPath)
        } catch (e) {
          debug('Cannot find package.json')
          return null
        }
      }
      return pkgPath
    }

    return pkgPath
  }

  static init (conf: ConfigObject, doNotTellPm2?: boolean): ConfigObject {
    const packageFilepath = Configuration.findPackageJson()
    let packageJson

    if (!conf.module_conf) {
      conf.module_conf = {}
    }
    conf.apm = {
      type: 'node',
      version: null
    }

    try {
      const prefix = __dirname.replace(/\\/g,'/').indexOf('/build/') >= 0 ? '../../' : '../'
      const pkg = require(prefix + 'package.json')
      conf.apm.version = pkg.version || null
    } catch (err) {
      if (err instanceof Error) {
        debug('Failed to fetch current apm version: ', err.message)
      }
    }

    if (conf.isModule === true) {
      /**
       * Merge package.json metadata
       */
      try {
        packageJson = require(packageFilepath || '')

        conf.module_version = packageJson.version
        conf.module_name = packageJson.name
        conf.description = packageJson.description

        if (packageJson.config) {
          conf = Object.assign(conf, packageJson.config)
          conf.module_conf = packageJson.config
        }
      } catch (e) {
        throw new Error(e instanceof Error ? e.message : String(e))
      }
    } else {
      conf.module_name = process.env.name || 'outside-pm2'
      try {
        packageJson = require(packageFilepath || '')

        conf.module_version = packageJson.version

        if (packageJson.config) {
          conf = Object.assign(conf, packageJson.config)
          conf.module_conf = packageJson.config
        }
      } catch (e) {
        if (e instanceof Error) {
          debug(e.message)
        }
      }
    }

    /**
     * If custom variables has been set, merge with returned configuration
     */
    try {
      const moduleName = conf.module_name
      if (moduleName && process.env[moduleName]) {
        const castedConf = new Autocast().autocast(JSON.parse(process.env[moduleName] || '')) as Record<string, unknown>
        conf = Object.assign(conf, castedConf)
        // Do not display probe configuration in Keymetrics
        if (castedConf && typeof castedConf === 'object') {
          delete castedConf.probes
        }
        // This is the configuration variable modifiable from keymetrics
        conf.module_conf = JSON.parse(JSON.stringify(Object.assign(conf.module_conf || {}, castedConf)))

        // Obfuscate passwords
        if (conf.module_conf) {
          Object.keys(conf.module_conf).forEach(function (key) {
            if ((key === 'password' || key === 'passwd') &&
              conf.module_conf && typeof conf.module_conf[key] === 'string' &&
              (conf.module_conf[key] as string).length >= 1) {
              conf.module_conf[key] = 'Password hidden'
            }
          })
        }
      }
    } catch (e) {
      debug(e)
    }

    if (doNotTellPm2 === true) return conf

    Configuration.configureModule(conf)
    return conf
  }

  static getMain (): NodeJS.Module {
    return require.main || ({ filename: './somefile.js', paths: [] } as unknown as NodeJS.Module)
  }
}
