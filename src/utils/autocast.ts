export default class Autocast {
  /**
   * Common strings to cast
   */
  commonStrings: Record<string, boolean | undefined | null | number> = {
    'true': true,
    'false': false,
    'undefined': undefined,
    'null': null,
    'NaN': NaN
  }

  process (key: string, value: unknown, o: Record<string, unknown>): void {
    if (typeof(value) === 'object') return
    o[key] = this._cast(value)
  }

  traverse (o: Record<string, unknown>, func: (key: string, value: unknown, obj: Record<string, unknown>) => void): void {
    for (let i in o) {
      func.apply(this,[i,o[i], o])
      if (o[i] !== null && typeof(o[i]) === 'object') {
        // going on step down in the object tree!!
        this.traverse(o[i] as Record<string, unknown>, func)
      }
    }
  }

  /**
   * Given a value, try and cast it
   */
  autocast (s: unknown): unknown {
    if (typeof(s) === 'object') {
      this.traverse(s as Record<string, unknown>, this.process)
      return s
    }

    return this._cast(s)
  }

  private _cast (s: unknown): unknown {
    let key

    // Don't cast Date objects
    if (s instanceof Date) return s
    if (typeof s === 'boolean') return s

    // Try to cast it to a number
    if (typeof s === 'number' || (typeof s === 'string' && !isNaN(Number(s)))) return Number(s)

    // Try to make it a common string
    for (key in this.commonStrings) {
      if (s === key) return this.commonStrings[key]
    }

    // Give up
    return s
  }
}
