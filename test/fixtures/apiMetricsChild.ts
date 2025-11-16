
import io from '../../src'
import { MetricType } from '../../src/services/metrics'
import Histogram from '../../src/utils/metrics/histogram'

const [ one, two, three ] = io.metrics(
  [
    {
      name: 'metricHistogram',
      type: MetricType.histogram,
      id: 'metric/custom'
    },
    {
      name: 'metric with spaces',
      type: MetricType.histogram,
      id: 'metric/custom'
    },
    {
      name: 'metric wi!th special chars % ///',
      type: MetricType.histogram,
      id: 'metric/custom'
    }
  ]
)

;(one as Histogram).update(10)

// test inline declaration
// @ts-expect-error - Backward compatibility: old string API
const metric = io.metric('metricInline')
metric.set(11)

io.metric({
  name: 'toto',
  value: () => 42
})

// set something into event loop. Else test will exit immediately
const timer = setInterval(function () {
  return
}, 5000)

process.on('SIGINT', function () {
  clearInterval(timer)
  io.destroy()
})
