var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeBase64';
var tests = [
  [
    'YmFzZTY0',
    'base64',
    true,
    null
  ],
  [
    'YmFzZTY0',
    'base64',
    false,
    null
  ],
  [
    'YmFzZTY0\r\n.\r\n',
    null,
    true,
    MIME.Error.Base64BodyIllegal
  ],
  [
    'YmFzZTY0\r\n.\r\n',
    null,
    false,
    MIME.Error.Base64WordIllegal
  ],
  [
    'YmFzZ',
    null,
    true,
    MIME.Error.Base64BodyTruncated
  ],
  [
    'YmFzZ',
    null,
    false,
    MIME.Error.Base64WordTruncated
  ]
];
tests.forEach(
  function(test) {
    var source = Buffer.from(test[0], 'utf-8');
    var target = test[1];
    var body = test[2];
    var targetError = test[3];
    var key = JSON.stringify(test[0]) + ': body=' + (body ? 1 : 0);
    try {
      var actual = MIME.decodeBase64(source, body).toString('utf-8');
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;

    }
    Test.equal(actual, target, namespace, key);
    Test.equal(actualError, targetError, namespace, key + ': error');
  }
);
