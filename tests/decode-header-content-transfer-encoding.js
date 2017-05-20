var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeContentTransferEncoding';
var tests = [
  [
    undefined,
    '',
    null
  ],
  [
    ' (comment) \r\n\t " \t 7-Bit "',
    '7bit',
    null
  ],
  [
    '7bit',
    '7bit',
    null
  ],
  [
    ' "8-bIt" ',
    '8bit',
    null
  ],
  [
    '8bit',
    '8bit',
    null
  ],
  [
    'base64',
    'base64',
    null
  ],
  [
    '\r\n\tbAse-()64\t',
    'base64',
    null
  ],
  [
    '\r\n\tQUOTEDprintable\t',
    'quoted-printable',
    null
  ],
  [
    'quoted-printable',
    'quoted-printable',
    null
  ],
  [
    '\r\n\t (comment)\r\n ',
    '',
    null
  ],
  [
    '\r\n\t (comment)\r\n " \t " ',
    '',
    null
  ],
  [
    '9bit',
    null,
    MIME.Error.ContentTransferEncodingUnrecognized
  ]
];
tests.forEach(
  function(test) {
    var key = JSON.stringify(test[0]);
    if (typeof test[0] === 'string') {
      var buffer = Buffer.from(test[0]);
    } else {
      var buffer = test[0];
    }
    try {
      var actual = MIME.decodeHeaderContentTransferEncoding(buffer);
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;
    }
    Test.equal(actualError, test[2], namespace, key + ': error');
    Test.equal(actual, test[1], namespace, key);
  }
);
