import * as fs from 'fs'
import Debug from 'debug'
import * as path from 'path'

const debug = Debug('axm:utils:module')

export default class ModuleUtils {
  /**
   * Try to load a module from its path
   */
  static loadModule (modulePath: string, args?: Object): unknown | Error {
    let nodule
    try {
      if (args) {
        nodule = require(modulePath).apply(this, args)
      } else {
        nodule = require(modulePath)
      }
      debug(`Succesfully required module at path ${modulePath}`)
      return nodule
    } catch (err) {
      debug(`Failed to load module at path ${modulePath}: ${err instanceof Error ? err.message : String(err)}`)
      return err
    }
  }

  /**
   * Try to detect the path of a specific module
   */
  static detectModule (moduleName: string): string | null {
    const fakePath = ['./node_modules', '/node_modules']
    if (!require.main) {
      return null
    }
    const paths = typeof require.main.paths === 'undefined' ? fakePath : require.main.paths

    const requirePaths = paths.slice()

    return ModuleUtils._lookForModule(requirePaths, moduleName)
  }

  /**
   * Lookup in each require path for the module name
   */
  private static _lookForModule (requirePaths: Array<string>, moduleName: string): string | null {
    // check for every path if we can find the module
    for (const requirePath of requirePaths) {
      const completePath = path.join(requirePath, moduleName)
      debug(`Looking for module ${moduleName} in ${completePath}`)
      try {
        fs.accessSync(completePath, fs.constants.R_OK)
        debug(`Found module ${moduleName} in path ${completePath}`)
        return completePath
      } catch (_err) {
        debug(`module ${moduleName} not found in path ${completePath}`)
        continue
      }
    }
    return null
  }
}
