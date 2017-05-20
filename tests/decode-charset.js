var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeCharset';
var tests = [
  [
    Buffer.from('text'),
    'utf-8',
    true, // Identity
    null
  ],
  [
    Buffer.from('text'),
    '\r\n.(uTf -\t8]',
    true, // Identity
    null
  ],
  [
    Buffer.from('text'),
    'bin ary',
    true, // Identity
    null
  ],
  [
    Buffer.from('text'),
    'us-ASCII',
    true, // Identity
    null
  ],
  [
    Buffer.from('text'),
    'a s c i i',
    true, // Identity
    null
  ],
  [
    // We should have an alias to CP949 (Outlook 2007 bug).
    // Without the alias, we would get Asian characters back from Iconv.
    Buffer.from('text'),
    'ks_c_5601-1987',
    Buffer.from('text'),
    null
  ],
  [
    Buffer.from('text'),
    'thejoshuatree',
    null,
    MIME.Error.CharsetUnsupported
  ],
  [
    Buffer.from('text'),
    'utf-8' + new Array(25 - 'utf-8'.length + 1).join(' '),
    null,
    MIME.Error.CharsetUnsupported
  ],
  [
    Buffer.from('text'),
    'utf-8\u0000',
    null,
    MIME.Error.CharsetUnsupported
  ],
  [
    Buffer.from('text'),
    'win-1252',
    Buffer.from('text'),
    null
  ],
  [
    Buffer.from('text'),
    undefined,
    true,
    null
  ],
  [
    Buffer.from('text'),
    '',
    true,
    null
  ],
  [
    Buffer.from('text'),
    0,
    null,
    'charset must be a string'
  ]
];
tests.forEach(
  function(test) {
    try {
      var actual = MIME.decodeCharset(test[0], test[1]);
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;
    }
    Test.equal(test[1], test[1], namespace, 'charset');
    Test.equal(actualError, test[3], namespace, 'error');
    function value(object) {
      if (Buffer.isBuffer(object)) return object.toString('utf-8');
      return object;
    }
    if (test[2] === true) {
      Test.equal(
        value(actual),
        value(test[0]),
        namespace,
        'target'
      );
      Test.equal(actual === test[0], true, namespace, 'pointer');
    } else {
      Test.equal(
        value(actual),
        value(test[2]),
        namespace,
        'target'
      );
      Test.equal(actual === test[0], false, namespace, 'pointer');
    }
  }
);
