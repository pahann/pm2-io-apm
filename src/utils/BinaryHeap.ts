interface Element {
  priority: number
  value: number
}

export default class BinaryHeap {

  private _elements: Element[]
  private _score: (element: Element) => number

  constructor (options: { score: (element: Element) => number; elements?: Element[] }) {
    this._elements = options.elements ?? []
    this._score = options.score
  }

  add (...elements: Element[]) {
    for (let i = 0; i < elements.length; i++) {
      const element = elements[i]
      if (!element) continue

      this._elements.push(element)
      this._bubble(this._elements.length - 1)
    }
  }

  first (): Element | undefined {
    return this._elements[0]
  }

  removeFirst (): Element | undefined {
    const root = this._elements[0]
    const last = this._elements.pop()

    if (this._elements.length > 0 && last !== undefined) {
      this._elements[0] = last
      this._sink(0)
    }

    return root
  }

  clone (): BinaryHeap {
    return new BinaryHeap({
      elements: this.toArray(),
      score: this._score
    })
  }

  toSortedArray (): Element[] {
    const array: Element[] = []
    const clone = this.clone()

    while (true) {
      const element = clone.removeFirst()
      if (element === undefined) break

      array.push(element)
    }

    return array
  }

  toArray (): Element[] {
    return [...this._elements]
  }

  size (): number {
    return this._elements.length
  }

  _bubble (bubbleIndex: number) {
    const bubbleElement = this._elements[bubbleIndex]
    if (!bubbleElement) return
    const bubbleScore = this._score(bubbleElement)

    while (bubbleIndex > 0) {
      const parentIndex = this._parentIndex(bubbleIndex)
      const parentElement = this._elements[parentIndex]
      if (!parentElement) break
      const parentScore = this._score(parentElement)

      if (bubbleScore <= parentScore) break

      this._elements[parentIndex] = bubbleElement
      this._elements[bubbleIndex] = parentElement
      bubbleIndex = parentIndex
    }
  }

  _sink (sinkIndex: number) {
    const sinkElement = this._elements[sinkIndex]
    if (!sinkElement) return
    const sinkScore = this._score(sinkElement)
    const length = this._elements.length

    while (true) {
      let swapIndex
      let swapScore
      let swapElement: Element | null = null
      const childIndexes = this._childIndexes(sinkIndex)

      for (let i = 0; i < childIndexes.length; i++) {
        const childIndex = childIndexes[i]
        if (childIndex === undefined) continue

        if (childIndex >= length) break

        const childElement = this._elements[childIndex]
        if (!childElement) continue
        const childScore = this._score(childElement)

        if (childScore > sinkScore) {
          if (swapScore === undefined || swapScore < childScore) {
            swapIndex = childIndex
            swapScore = childScore
            swapElement = childElement
          }
        }
      }

      if (swapIndex === undefined || swapElement === null) break

      this._elements[swapIndex] = sinkElement
      this._elements[sinkIndex] = swapElement
      sinkIndex = swapIndex
    }
  }

  _parentIndex (index: number) {
    return Math.floor((index - 1) / 2)
  }

  _childIndexes (index: number) {
    return [
      2 * index + 1,
      2 * index + 2
    ]
  }

}
