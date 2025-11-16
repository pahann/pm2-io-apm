import BinaryHeap from './BinaryHeap'
import units from './units'

export default class ExponentiallyDecayingSample {
  private RESCALE_INTERVAL = 1 * units.HOURS
  private ALPHA = 0.015
  private SIZE = 1028

  private _elements: BinaryHeap
  private _rescaleInterval: number
  private _alpha: number
  private _size: number
  private _landmark: number | null = null
  private _nextRescale: number | null = null
  private _random: () => number

  constructor (options?: { rescaleInterval?: number; alpha?: number; size?: number; random?: () => number }) {
    options = options ?? {}

    this._elements = new BinaryHeap({
      score: function (element) {
        return -element.priority
      }
    })

    this._rescaleInterval = options.rescaleInterval ?? this.RESCALE_INTERVAL
    this._alpha = options.alpha ?? this.ALPHA
    this._size = options.size ?? this.SIZE
    this._random = options.random ?? (() => Math.random())
  }

  update (value: number, timestamp?: number) {
    const now = Date.now()
    if (!this._landmark) {
      this._landmark = now
      this._nextRescale = this._landmark + this._rescaleInterval
    }

    timestamp = timestamp ?? now

    const newSize = this._elements.size() + 1

    const element = {
      priority: this._priority(timestamp - this._landmark),
      value: value
    }

    if (newSize <= this._size) {
      this._elements.add(element)
    } else {
      const first = this._elements.first()
      if (first && element.priority > first.priority) {
        this._elements.removeFirst()
        this._elements.add(element)
      }
    }

    if (this._nextRescale !== null && now >= this._nextRescale) this._rescale(now)
  }

  toSortedArray () {
    return this._elements
      .toSortedArray()
      .map(function (element) {
        return element.value
      })
  }

  toArray () {
    return this._elements
      .toArray()
      .map(function (element) {
        return element.value
      })
  }

  _weight (age: number) {
    // We divide by 1000 to not run into huge numbers before reaching a
    // rescale event.
    return Math.exp(this._alpha * (age / 1000))
  }

  _priority (age: number) {
    return this._weight(age) / this._random()
  }


  _rescale (now: number) {
    now = now ?? Date.now()

    const self = this
    const oldLandmark = this._landmark ?? 0
    this._landmark = now ?? Date.now()
    this._nextRescale = now + this._rescaleInterval

    const factor = self._priority(-(self._landmark ?? 0) - oldLandmark)

    this._elements
      .toArray()
      .forEach(function (element) {
        element.priority *= factor
      })
  }

  avg (_now?: number) {
    let sum = 0
    this._elements
      .toArray()
      .forEach(function (element) {
        sum += element.value
      })
    return (sum / this._elements.size())
  }
}
