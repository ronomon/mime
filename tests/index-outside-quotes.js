var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.indexOutsideQuotes';
var tests = [
  [
    '',
    '<',
    -1
  ],
  [
    '"<"',
    '<',
    -1
  ],
  [
    ' "\\"<" <',
    '<',
    7
  ],
  [
    ' "\\\\"< ',
    '<',
    5
  ],
  [
    '<',
    '<',
    -1,
    0,
    0
  ],
  [
    ' <',
    '<',
    -1,
    2,
    2
  ]
];
tests.forEach(
  function(test) {
    var source = Buffer.from(test[0]);
    var sourceIndex = test[3] === undefined ? 0 : test[3];
    var sourceLength = test[4] === undefined ? source.length : test[4];
    var code = test[1].charCodeAt(0);
    Test.equal(
      MIME.indexOutsideQuotes(source, sourceIndex, sourceLength, code),
      test[2],
      namespace,
      JSON.stringify(test[0])
    );
  }
);
