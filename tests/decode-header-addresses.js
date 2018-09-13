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
  ],
  [
    'Fake <trusted@sender.com> <fake@scam.com>',
    [
      {
        // Multiple angle-addr's should never occur and are suspicious:
        // We split an address on angle brackets outside quotes.
        // This means that the pseudo address which will end up part of the name
        // will lose its angle brackets, and at first glance, it might seem that
        // we are causing user data to be lost.
        // However, if angle brackets exist outside quotes, there should only
        // be a single pair in terms of the spec, because there can only be one
        // angle-addr, and a phrase atom cannot contain angle brackets.
        // Therefore, removing the extra angle brackets is not a problem, since
        // the case is already exceptional.
        // TO DO: We should probably detect and reject multiple angle-addr's.
        name: 'Fake trusted@sender.com',
        email: 'fake@scam.com'
      }
    ],
    null
  ],
  [
    '"QuotedFake <trusted@sender.com>" <fake@scam.com>',
    [
      {
        name: 'QuotedFake <trusted@sender.com>',
        email: 'fake@scam.com'
      }
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
