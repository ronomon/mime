var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeQuotedPrintable';
var tests = [
  [
    ' \t=20_',
    ' \t _',
    true,
    null
  ],
  [
    ' \t=20_',
    ' \t  ',
    false,
    null
  ],
  // TO DO: Add option to accept/reject illegal quoted-printable:
  // [
  //   '\f',
  //   null,
  //   true,
  //   MIME.Error.QuotedPrintableBodyIllegal
  // ],
  // [
  //   '\f',
  //   null,
  //   false,
  //   MIME.Error.QuotedPrintableWordIllegal
  // ]
];
tests.forEach(
  function(test) {
    var source = Buffer.from(test[0], 'utf-8');
    var target = test[1];
    var body = test[2];
    var targetError = test[3];
    var key = JSON.stringify(test[0]) + ': body=' + (body ? 1 : 0);
    try {
      var actual = MIME.decodeQuotedPrintable(source, body).toString('utf-8');
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;

    }
    Test.equal(actual, target, namespace, key);
    Test.equal(actualError, targetError, namespace, key + ': error');
  }
);
