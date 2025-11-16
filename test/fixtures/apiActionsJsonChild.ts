
import pmx from '../../src'

// @ts-expect-error - Backward compatibility: old object API for action
pmx.action({
  name: 'testActionWithConf',
  action: function (reply) { reply({ data: 'testActionWithConfReply' }) }
})
