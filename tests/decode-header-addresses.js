var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaderAddresses';
var tests = [
  [
    undefined,
    [],
    null
  ],
  [
    '',
    [],
    null
  ],
  [
    [],
    [],
    null
  ],
  [
    ['test1@(comment)test.com,\t,\t', '""\r\n test2(,)@(;)(<)test.com'],
    [
      { name: '', email: 'test1@test.com' },
      { name: '', email: 'test2@test.com' }
    ],
    null
  ]
];
tests.forEach(
  function(test) {
    var key = JSON.stringify(test[0]);
    if (test[0] === undefined) {
      var buffer = test[0];
    } else if (typeof test[0] === 'string') {
      var buffer = Buffer.from(test[0], 'binary');
    } else if (Array.isArray(test[0])) {
      var buffer = test[0].map(
        function(value) {
          if (typeof value === 'string') return Buffer.from(value);
          return value;
        }
      );
    }
    try {
      var actual = MIME.decodeHeaderAddresses(buffer);
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;
    }
    Test.equal(actual, test[1], namespace, key);
    Test.equal(actualError, test[2], namespace, key + ': error');
  }
);
