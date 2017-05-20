var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaderUnstructured';
var tests = [
  [
    Buffer.from(
      '\r\n the \r\n\t =?utf-8?B?' +
      Buffer.from('café', 'utf-8').toString('base64') +
      '?= '
    ),
    ' the \t café ',
    null
  ]
];
tests.forEach(
  function(test) {
    try {
      var actual = MIME.decodeHeaderUnstructured(test[0]);
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;
    }
    Test.equal(actualError, test[2], namespace, 'error');
    Test.equal(actual, test[1], namespace, 'value');
  }
);
