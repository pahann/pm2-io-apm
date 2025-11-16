import EDS from '../EDS'

export default class Histogram {
  private _measurement
  private _callFn

  private _sample = new EDS({ alpha: 0.015 })
  private _min: number | undefined
  private _max: number | undefined
  private _count: number = 0
  private _sum: number = 0

  // These are for the Welford algorithm for calculating running variance
  // without floating-point doom.
  private _varianceM: number = 0
  private _varianceS: number = 0
  private _ema: number = 0

  private used: boolean = false

  constructor (opts?: { measurement?: string }) {
    opts = opts || {}

    this._measurement = opts.measurement
    this._callFn = undefined

    const methods: Record<string, (() => unknown) | undefined> = {
      min      : this.getMin,
      max      : this.getMax,
      sum      : this.getSum,
      count    : this.getCount,
      variance : this._calculateVariance,
      mean     : this._calculateMean,
      // stddev   : this._calculateStddev,
      ema      : this.getEma
    }

    if (this._measurement && methods.hasOwnProperty(this._measurement)) {
      this._callFn = methods[this._measurement]
    } else {
      this._callFn = function () {
        const percentiles = this.percentiles([0.5, 0.75, 0.95, 0.99, 0.999])

        const medians: Record<string, number | null> = {
          median   : percentiles[0.5] ?? null,
          p75      : percentiles[0.75] ?? null,
          p95      : percentiles[0.95] ?? null,
          p99      : percentiles[0.99] ?? null,
          p999     : percentiles[0.999] ?? null
        }

        return this._measurement ? medians[this._measurement] : null
      }
    }
  }

  update (value: number) {
    this.used = true
    this._count++
    this._sum += value

    this._sample.update(value)
    this._updateMin(value)
    this._updateMax(value)
    this._updateVariance(value)
    this._updateEma(value)
  }

  percentiles (percentiles: number[]): Record<number, number | null> {
    const values = this._sample
      .toArray()
      .sort(function (a, b) {
        return (a === b)
          ? 0
          : a - b
      })

    const results: Record<number, number | null> = {}
    for (let i = 0; i < percentiles.length; i++) {
      const percentile = percentiles[i]
      if (percentile === undefined) continue
      if (!values.length) {
        results[percentile] = null
        continue
      }

      const pos = percentile * (values.length + 1)

      if (pos < 1) {
        results[percentile] = values[0] ?? null
      } else if (pos >= values.length) {
        results[percentile] = values[values.length - 1] ?? null
      } else {
        const lower = values[Math.floor(pos) - 1]
        const upper = values[Math.ceil(pos) - 1]
        if (lower === undefined || upper === undefined) {
          results[percentile] = null
          continue
        }

        results[percentile] = lower + (pos - Math.floor(pos)) * (upper - lower)
      }
    }

    return results
  }

  val (): unknown {
    if (typeof(this._callFn) === 'function') {
      return this._callFn()
    } else {
      return this._callFn
    }
  }

  getMin (): number | undefined {
    return this._min
  }

  getMax (): number | undefined {
    return this._max
  }

  getSum (): number {
    return this._sum
  }

  getCount (): number {
    return this._count
  }

  getEma (): number {
    return this._ema
  }

  fullResults (): Record<string, number | null | undefined> {
    const percentiles = this.percentiles([0.5, 0.75, 0.95, 0.99, 0.999])

    return {
      min      : this._min,
      max      : this._max,
      sum      : this._sum,
      variance : this._calculateVariance(),
      mean     : this._calculateMean(),
      // stddev   : this._calculateStddev(),
      count    : this._count,
      median   : percentiles[0.5],
      p75      : percentiles[0.75],
      p95      : percentiles[0.95],
      p99      : percentiles[0.99],
      p999     : percentiles[0.999],
      ema      : this._ema
    }
  }

  _updateMin (value: number): void {
    if (this._min === undefined || value < this._min) {
      this._min = value
    }
  }

  _updateMax (value: number): void {
    if (this._max === undefined || value > this._max) {
      this._max = value
    }
  }

  _updateVariance (value: number): void {
    if (this._count === 1) {
      this._varianceM = value
      return
    }

    const oldM = this._varianceM

    this._varianceM += ((value - oldM) / this._count)
    this._varianceS += ((value - oldM) * (value - this._varianceM))
  }

  _updateEma (value: number): void {
    if (this._count <= 1) {
      this._ema = this._calculateMean()
      return
    }
    const alpha = 2 / (1 + this._count)
    this._ema = value * alpha + this._ema * (1 - alpha)
  }

  _calculateMean (): number {
    return (this._count === 0)
      ? 0
      : this._sum / this._count
  }

  _calculateVariance (): number | null {
    return (this._count <= 1)
      ? null
      : this._varianceS / (this._count - 1)
  }

  isUsed (): boolean {
    return this.used
  }

  // TODO still used ?
  // _calculateStddev () {
  //   return (this._count < 1)
  //     ? null
  //     : Math.sqrt(this._calculateVariance())
  // }
}
