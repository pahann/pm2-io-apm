
import PMX from './pmx'

const IO_KEY = Symbol.for('@pm2/io')

type GlobalWithIO = typeof globalThis & {
  [key: symbol]: PMX
}

const globalWithIO = global as GlobalWithIO
const isAlreadyHere = (Object.getOwnPropertySymbols(global).indexOf(IO_KEY) > -1)

const io: PMX = isAlreadyHere && globalWithIO[IO_KEY] ? globalWithIO[IO_KEY] : new PMX().init()
globalWithIO[IO_KEY] = io

export = io
