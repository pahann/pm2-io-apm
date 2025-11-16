import { expect } from 'chai'
import { toZipkinSpan, _toZipkinTags, _toZipkinAnnotations } from '../../src/otel/custom-zipkin-exporter/transform'
import { ReadableSpan, TimedEvent } from '@opentelemetry/sdk-trace-base'
import { SpanKind, SpanStatusCode, TraceFlags } from '@opentelemetry/api'
import { resourceFromAttributes, type Resource, type DetectedResourceAttributes } from '@opentelemetry/resources'

// Helper to create a minimal valid Resource
const createResource = (attributes: DetectedResourceAttributes = {}): Resource => {
  return resourceFromAttributes(attributes)
}

describe('Zipkin Serialization', () => {
  describe('toZipkinSpan', () => {
    it('should serialize a basic span to Zipkin format', () => {
      const mockSpan: ReadableSpan = {
        name: 'test-span',
        kind: SpanKind.SERVER,
        spanContext: () => ({
          traceId: '1234567890abcdef1234567890abcdef',
          spanId: 'abcdef1234567890',
          traceFlags: TraceFlags.SAMPLED
        }),
        parentSpanContext: {
          traceId: '1234567890abcdef1234567890abcdef',
          spanId: '1234567890abcdef',
          traceFlags: TraceFlags.SAMPLED
        },
        startTime: [1, 0], // HrTime: [seconds, nanoseconds]
        endTime: [1, 1000000], // 1ms later
        duration: [0, 1000000], // 1ms
        status: { code: SpanStatusCode.OK },
        attributes: {
          'http.method': 'GET',
          'http.url': '/test'
        },
        events: [],
        links: [],
        ended: true,
        resource: createResource(),
        instrumentationScope: { name: 'test', version: '1.0.0' },
        droppedAttributesCount: 0,
        droppedEventsCount: 0,
        droppedLinksCount: 0
      }

      const zipkinSpan = toZipkinSpan(mockSpan, 'test-service', 'otel.status_code', 'error')

      // Validate required Zipkin fields
      expect(zipkinSpan).to.have.property('traceId', '1234567890abcdef1234567890abcdef')
      expect(zipkinSpan).to.have.property('id', 'abcdef1234567890')
      expect(zipkinSpan).to.have.property('name', 'test-span')
      expect(zipkinSpan).to.have.property('parentId', '1234567890abcdef')
      expect(zipkinSpan).to.have.property('kind', 'SERVER')
      expect(zipkinSpan).to.have.property('timestamp')
      expect(zipkinSpan).to.have.property('duration')
      expect(zipkinSpan.localEndpoint).to.deep.equal({ serviceName: 'test-service' })
      expect(zipkinSpan.tags).to.be.an('object')
    })

    it('should handle span without parent (root span)', () => {
      const mockSpan: ReadableSpan = {
        name: 'root-span',
        kind: SpanKind.CLIENT,
        spanContext: () => ({
          traceId: 'aaaa',
          spanId: 'bbbb',
          traceFlags: TraceFlags.SAMPLED
        }),
        parentSpanContext: undefined, // Root span
        startTime: [1, 0],
        endTime: [1, 1000000],
        duration: [0, 1000000],
        status: { code: SpanStatusCode.OK },
        attributes: {},
        events: [],
        links: [],
        ended: true,
        resource: createResource(),
        instrumentationScope: { name: 'test', version: '1.0.0' },
        droppedAttributesCount: 0,
        droppedEventsCount: 0,
        droppedLinksCount: 0
      }

      const zipkinSpan = toZipkinSpan(mockSpan, 'test-service', 'otel.status_code', 'error')

      expect(zipkinSpan.parentId).to.be.undefined
      expect(zipkinSpan.kind).to.equal('CLIENT')
    })

    it('should convert timestamps to microseconds', () => {
      const mockSpan: ReadableSpan = {
        name: 'time-test',
        kind: SpanKind.INTERNAL,
        spanContext: () => ({
          traceId: 'trace',
          spanId: 'span',
          traceFlags: TraceFlags.SAMPLED
        }),
        parentSpanContext: undefined,
        startTime: [1609459200, 0], // 2021-01-01 00:00:00 UTC
        endTime: [1609459200, 5000000], // 5ms later
        duration: [0, 5000000], // 5ms = 5,000,000 nanoseconds
        status: { code: SpanStatusCode.OK },
        attributes: {},
        events: [],
        links: [],
        ended: true,
        resource: createResource(),
        instrumentationScope: { name: 'test', version: '1.0.0' },
        droppedAttributesCount: 0,
        droppedEventsCount: 0,
        droppedLinksCount: 0
      }

      const zipkinSpan = toZipkinSpan(mockSpan, 'test-service', 'otel.status_code', 'error')

      // 1609459200 seconds * 1,000,000 = 1,609,459,200,000,000 microseconds
      expect(zipkinSpan.timestamp).to.equal(1609459200000000)
      // Duration: 5,000,000 nanoseconds / 1000 = 5000 microseconds
      expect(zipkinSpan.duration).to.equal(5000)
    })

    it('should handle INTERNAL spans with undefined kind', () => {
      const mockSpan: ReadableSpan = {
        name: 'internal-span',
        kind: SpanKind.INTERNAL,
        spanContext: () => ({
          traceId: 'trace',
          spanId: 'span',
          traceFlags: TraceFlags.SAMPLED
        }),
        parentSpanContext: undefined,
        startTime: [1, 0],
        endTime: [1, 1000000],
        duration: [0, 1000000],
        status: { code: SpanStatusCode.OK },
        attributes: {},
        events: [],
        links: [],
        ended: true,
        resource: createResource(),
        instrumentationScope: { name: 'test', version: '1.0.0' },
        droppedAttributesCount: 0,
        droppedEventsCount: 0,
        droppedLinksCount: 0
      }

      const zipkinSpan = toZipkinSpan(mockSpan, 'test-service', 'otel.status_code', 'error')

      // INTERNAL should map to undefined in Zipkin (local span)
      expect(zipkinSpan.kind).to.be.undefined
    })
  })

  describe('_toZipkinTags', () => {
    it('should convert span attributes to tags', () => {
      const mockSpan = {
        attributes: {
          'http.method': 'POST',
          'http.status_code': 200,
          'custom.tag': 'value'
        },
        resource: createResource(),
        status: { code: SpanStatusCode.OK },
        droppedAttributesCount: 0,
        droppedEventsCount: 0,
        droppedLinksCount: 0
      } as unknown as ReadableSpan

      const tags = _toZipkinTags(mockSpan, 'otel.status_code', 'error')

      expect(tags['http.method']).to.equal('POST')
      expect(tags['http.status_code']).to.equal('200') // Converted to string
      expect(tags['custom.tag']).to.equal('value')
    })

    it('should include status code tag when status is not UNSET', () => {
      const mockSpan = {
        attributes: {},
        resource: createResource(),
        status: { code: SpanStatusCode.ERROR, message: 'Something went wrong' },
        droppedAttributesCount: 0,
        droppedEventsCount: 0,
        droppedLinksCount: 0
      } as unknown as ReadableSpan

      const tags = _toZipkinTags(mockSpan, 'otel.status_code', 'error')

      expect(tags['otel.status_code']).to.equal('ERROR')
      expect(tags.error).to.equal('Something went wrong')
    })

    it('should not include status code tag when UNSET', () => {
      const mockSpan = {
        attributes: {},
        resource: createResource(),
        status: { code: SpanStatusCode.UNSET },
        droppedAttributesCount: 0,
        droppedEventsCount: 0,
        droppedLinksCount: 0
      } as unknown as ReadableSpan

      const tags = _toZipkinTags(mockSpan, 'otel.status_code', 'error')

      expect(tags).to.not.have.property('otel.status_code')
    })

    it('should include dropped counts as tags', () => {
      const mockSpan = {
        attributes: {},
        resource: createResource(),
        status: { code: SpanStatusCode.OK },
        droppedAttributesCount: 5,
        droppedEventsCount: 2,
        droppedLinksCount: 1
      } as unknown as ReadableSpan

      const tags = _toZipkinTags(mockSpan, 'otel.status_code', 'error')

      expect(tags['otel.dropped_attributes_count']).to.equal('5')
      expect(tags['otel.dropped_events_count']).to.equal('2')
      expect(tags['otel.dropped_links_count']).to.equal('1')
    })

    it('should include resource attributes as tags', () => {
      const resource = createResource({
        'service.name': 'my-service',
        'service.version': '1.2.3'
      })

      const mockSpan = {
        attributes: { 'http.method': 'GET' },
        resource,
        status: { code: SpanStatusCode.OK },
        droppedAttributesCount: 0,
        droppedEventsCount: 0,
        droppedLinksCount: 0
      } as unknown as ReadableSpan

      const tags = _toZipkinTags(mockSpan, 'otel.status_code', 'error')

      expect(tags['service.name']).to.equal('my-service')
      expect(tags['service.version']).to.equal('1.2.3')
      expect(tags['http.method']).to.equal('GET')
    })
  })

  describe('_toZipkinAnnotations', () => {
    it('should convert events to Zipkin annotations', () => {
      const events: TimedEvent[] = [
        {
          name: 'cache.hit',
          attributes: {},
          time: [1, 0],
          droppedAttributesCount: 0
        },
        {
          name: 'db.query.start',
          attributes: {},
          time: [1, 1000000],
          droppedAttributesCount: 0
        }
      ]

      const annotations = _toZipkinAnnotations(events)

      expect(annotations).to.have.length(2)
      expect(annotations[0]).to.deep.equal({
        timestamp: 1000000,
        value: 'cache.hit'
      })
      expect(annotations[1]).to.deep.equal({
        timestamp: 1001000,
        value: 'db.query.start'
      })
    })

    it('should handle empty events array', () => {
      const annotations = _toZipkinAnnotations([])

      expect(annotations).to.have.length(0)
    })
  })
})
