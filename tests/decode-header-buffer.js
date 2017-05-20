var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaderBuffer';
var tests = [
  [
    undefined,
    true,
    undefined,
    null
  ],
  [
    undefined,
    false,
    undefined,
    null
  ],
  [
    [],
    true,
    undefined,
    null
  ],
  [
    [],
    false,
    undefined,
    null
  ],
  [
    ['', []],
    true,
    null,
    'buffer must be a buffer'
  ],
  [
    ['', []],
    false,
    null,
    'buffer must be a buffer'
  ],
  [
    [Buffer.alloc(0), Buffer.alloc(0)],
    true,
    Buffer.from(','),
    null
  ],
  [
    [Buffer.from('1'), Buffer.from('2'), Buffer.from('3')],
    true,
    Buffer.from('1,2,3'),
    null
  ],
  [
    [Buffer.alloc(0), Buffer.alloc(0)],
    false,
    Buffer.alloc(0),
    null
  ],
  [
    [Buffer.from('1'), Buffer.from('2'), Buffer.from('3')],
    false,
    Buffer.from('1'),
    null
  ],
  [
    Buffer.from('abc'),
    true,
    Buffer.from('abc'),
    null
  ],
  [
    Buffer.from('abc'),
    false,
    Buffer.from('abc'),
    null
  ],
  [
    null,
    false,
    null,
    'buffer must be a buffer or an array of buffers'
  ],
  [
    0,
    false,
    null,
    'buffer must be a buffer or an array of buffers'
  ],
  [
    'buffer',
    false,
    null,
    'buffer must be a buffer or an array of buffers'
  ]
];
function value(object) {
  if (object === undefined || object === null) return object;
  return object.toString('binary');
}
tests.forEach(
  function(test) {
    try {
      var actual = MIME.decodeHeaderBuffer(test[0], test[1]);
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;
    }
    Test.equal(actualError, test[3], namespace, 'error');
    Test.equal(value(actual), value(test[2]), namespace, 'buffer');
  }
);
