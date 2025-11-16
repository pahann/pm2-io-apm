
import IO, { IOConfig } from '../pmx'
const IO_KEY = Symbol.for('@pm2/io')

type GlobalWithIO = typeof globalThis & { [key: symbol]: IO }

export class Entrypoint {
  private io!: IO

  constructor () {
    try {
      const globalIO = (global as GlobalWithIO)[IO_KEY]
      if (!globalIO) throw new Error('IO not initialized')
      this.io = globalIO.init(this.conf())

      this.onStart((err: unknown) => {
        if (err) {
          console.error(err)
          process.exit(1)
        }

        this.sensors()
        this.events()
        this.actuators()

        this.io.onExit((code: unknown, signal: unknown) => {
          this.onStop(err as Error, () => {
            this.io.destroy()
          }, code, signal)
        })

        if (process && process.send) process.send('ready')
      })
    } catch (e) {
      // properly exit in case onStart/onStop method has not been override
      if (this.io) {
        this.io.destroy()
      }

      throw (e)
    }
  }

  events () {
    return
  }

  sensors () {
    return
  }

  actuators () {
    return
  }

  onStart (_cb: (err?: unknown) => void) {
    throw new Error('Entrypoint onStart() not specified')
  }

  onStop (_err: Error, cb: () => void, _code: unknown, _signal: unknown) {
    return cb()
  }

  conf (): IOConfig | undefined {
    return undefined
  }
}
