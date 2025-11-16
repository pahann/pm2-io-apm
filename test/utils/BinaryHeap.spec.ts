import { expect } from 'chai'
import BinaryHeap from '../../src/utils/BinaryHeap'

describe('BinaryHeap', () => {
  describe('Basic Operations', () => {
    it('should create empty heap', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      expect(heap.size()).to.equal(0)
    })

    it('should add single element and retrieve it', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: 5, value: 5 })
      expect(heap.size()).to.equal(1)
      expect(heap.removeFirst()?.value).to.equal(5)
      expect(heap.size()).to.equal(0)
    })

    it('should maintain max-heap property (highest priority first)', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      const values = [3, 1, 4, 1, 5, 9, 2, 6, 5, 3, 5]

      values.forEach(n => heap.add({ priority: n, value: n }))
      expect(heap.size()).to.equal(values.length)

      const extracted: number[] = []
      while (heap.size() > 0) {
        extracted.push(heap.removeFirst()!.value)
      }

      // Should be sorted in descending order (max heap by default)
      for (let i = 1; i < extracted.length; i++) {
        expect(extracted[i]).to.be.at.most(extracted[i - 1])
      }
    })

    it('should handle duplicate priorities correctly', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: 5, value: 1 })
      heap.add({ priority: 5, value: 2 })
      heap.add({ priority: 5, value: 3 })

      expect(heap.size()).to.equal(3)
      expect(heap.removeFirst()?.priority).to.equal(5)
      expect(heap.removeFirst()?.priority).to.equal(5)
      expect(heap.removeFirst()?.priority).to.equal(5)
      expect(heap.size()).to.equal(0)
    })

    it('should return undefined when removing from empty heap', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      expect(heap.removeFirst()).to.be.undefined
    })

    it('should handle negative priorities', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: -5, value: -5 })
      heap.add({ priority: 0, value: 0 })
      heap.add({ priority: -10, value: -10 })
      heap.add({ priority: 5, value: 5 })

      expect(heap.removeFirst()?.value).to.equal(5)
      expect(heap.removeFirst()?.value).to.equal(0)
      expect(heap.removeFirst()?.value).to.equal(-5)
      expect(heap.removeFirst()?.value).to.equal(-10)
    })
  })

  describe('Custom Score Functions', () => {
    it('should handle inverted score function (min heap)', () => {
      // Negate priority for min heap behavior
      const heap = new BinaryHeap({ score: (x) => -x.priority })

      heap.add({ priority: 3, value: 3 })
      heap.add({ priority: 1, value: 1 })
      heap.add({ priority: 4, value: 4 })
      heap.add({ priority: 1, value: 1 })
      heap.add({ priority: 5, value: 5 })

      // Should extract in ascending order
      expect(heap.removeFirst()?.value).to.equal(1)
      expect(heap.removeFirst()?.value).to.equal(1)
      expect(heap.removeFirst()?.value).to.equal(3)
      expect(heap.removeFirst()?.value).to.equal(4)
      expect(heap.removeFirst()?.value).to.equal(5)
    })

    it('should handle score based on value field', () => {
      // Score by value instead of priority
      const heap = new BinaryHeap({ score: (x) => x.value })

      heap.add({ priority: 1, value: 100 })
      heap.add({ priority: 2, value: 50 })
      heap.add({ priority: 3, value: 200 })

      // Should extract by value, not priority
      expect(heap.removeFirst()?.value).to.equal(200)
      expect(heap.removeFirst()?.value).to.equal(100)
      expect(heap.removeFirst()?.value).to.equal(50)
    })
  })

  describe('Clone and Array Operations', () => {
    it('should clone heap correctly', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: 3, value: 3 })
      heap.add({ priority: 1, value: 1 })
      heap.add({ priority: 4, value: 4 })

      const clone = heap.clone()
      expect(clone.size()).to.equal(heap.size())

      // Original and clone should have same elements
      expect(heap.removeFirst()?.value).to.equal(4)
      expect(clone.removeFirst()?.value).to.equal(4)
    })

    it('should convert to array', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: 3, value: 3 })
      heap.add({ priority: 1, value: 1 })
      heap.add({ priority: 4, value: 4 })

      const array = heap.toArray()
      expect(array).to.be.an('array')
      expect(array.length).to.equal(3)
      expect(heap.size()).to.equal(3) // Original unchanged
    })

    it('should convert to sorted array', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: 3, value: 3 })
      heap.add({ priority: 1, value: 1 })
      heap.add({ priority: 4, value: 4 })
      heap.add({ priority: 1, value: 1 })
      heap.add({ priority: 5, value: 5 })

      const sorted = heap.toSortedArray()

      // Should be descending order (max heap)
      expect(sorted[0].value).to.equal(5)
      expect(sorted[1].value).to.equal(4)
      expect(sorted[2].value).to.equal(3)

      // Original heap should be unchanged
      expect(heap.size()).to.equal(5)
    })

    it('should get first element without removing', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: 3, value: 3 })
      heap.add({ priority: 1, value: 1 })
      heap.add({ priority: 4, value: 4 })

      const first = heap.first()
      expect(first?.value).to.equal(4)
      expect(heap.size()).to.equal(3) // Not removed
    })
  })

  describe('Stress Tests', () => {
    it('should handle large datasets', function () {
      this.timeout(5000)

      const heap = new BinaryHeap({ score: (x) => x.priority })
      const size = 10000

      // Add random values
      for (let i = 0; i < size; i++) {
        const priority = Math.random() * 1000
        heap.add({ priority, value: priority })
      }

      expect(heap.size()).to.equal(size)

      // Remove all and verify descending order
      let prev = Infinity
      let count = 0
      while (heap.size() > 0) {
        const current = heap.removeFirst()!
        expect(current.value).to.be.at.most(prev)
        prev = current.value
        count++
      }

      expect(count).to.equal(size)
    })

    it('should handle interleaved add/remove operations', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })

      heap.add({ priority: 5, value: 5 })
      heap.add({ priority: 3, value: 3 })
      expect(heap.removeFirst()?.value).to.equal(5)

      heap.add({ priority: 7, value: 7 })
      heap.add({ priority: 1, value: 1 })
      expect(heap.removeFirst()?.value).to.equal(7)

      heap.add({ priority: 9, value: 9 })
      expect(heap.removeFirst()?.value).to.equal(9)
      expect(heap.removeFirst()?.value).to.equal(3)
      expect(heap.removeFirst()?.value).to.equal(1)

      expect(heap.size()).to.equal(0)
    })

    it('should handle many elements with same priority', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      const priority = 10
      const count = 100

      for (let i = 0; i < count; i++) {
        heap.add({ priority, value: i })
      }

      expect(heap.size()).to.equal(count)

      for (let i = 0; i < count; i++) {
        const elem = heap.removeFirst()
        expect(elem?.priority).to.equal(priority)
      }

      expect(heap.size()).to.equal(0)
    })
  })

  describe('Edge Cases', () => {
    it('should handle heap with single element', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: 42, value: 42 })

      expect(heap.size()).to.equal(1)
      expect(heap.removeFirst()?.value).to.equal(42)
      expect(heap.size()).to.equal(0)
      expect(heap.removeFirst()).to.be.undefined
    })

    it('should handle zero priorities', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })
      heap.add({ priority: 0, value: 0 })
      heap.add({ priority: 0, value: 0 })
      heap.add({ priority: 1, value: 1 })
      heap.add({ priority: -1, value: -1 })

      expect(heap.removeFirst()?.value).to.equal(1)
      expect(heap.removeFirst()?.value).to.equal(0)
      expect(heap.removeFirst()?.value).to.equal(0)
      expect(heap.removeFirst()?.value).to.equal(-1)
    })

    it('should handle constructor with initial elements', () => {
      const elements = [
        { priority: 3, value: 3 },
        { priority: 1, value: 1 },
        { priority: 4, value: 4 }
      ]

      const heap = new BinaryHeap({
        score: (x) => x.priority,
        elements
      })

      expect(heap.size()).to.equal(3)
    })

    it('should handle adding multiple elements at once', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })

      heap.add(
        { priority: 3, value: 3 },
        { priority: 1, value: 1 },
        { priority: 4, value: 4 }
      )

      expect(heap.size()).to.equal(3)
      expect(heap.removeFirst()?.value).to.equal(4)
    })
  })

  describe('Heap Property Verification', () => {
    it('should maintain heap property after sequential adds', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })

      // Add in ascending order (worst case for max heap)
      for (let i = 1; i <= 100; i++) {
        heap.add({ priority: i, value: i })
      }

      // First element should be maximum
      expect(heap.removeFirst()?.value).to.equal(100)
    })

    it('should maintain heap property after descending adds', () => {
      const heap = new BinaryHeap({ score: (x) => x.priority })

      // Add in descending order (best case)
      for (let i = 100; i >= 1; i--) {
        heap.add({ priority: i, value: i })
      }

      // Should still extract in correct order
      expect(heap.removeFirst()?.value).to.equal(100)
      expect(heap.removeFirst()?.value).to.equal(99)
      expect(heap.removeFirst()?.value).to.equal(98)
    })
  })
})
