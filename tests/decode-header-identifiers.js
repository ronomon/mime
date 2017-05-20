var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.decodeHeaderIdentifiers';
var tests = [
  [
    '\r\n a@a \t b@b> <\r\n c@\t(d@d)',
    [
      'a@a',
      'b@b'
    ]
  ],
  [
    '<a@a<@b<c@c',
    [
      'a@a',
      'c@c'
    ]
  ],
  [
    'a@a>b@b>>>>>c@c',
    [
      'a@a',
      'b@b',
      'c@c'
    ]
  ],
  [
    'a@a,b@b,,,c@c',
    [
      'a@a',
      'b@b',
      'c@c'
    ]
  ],
  [
    '<19980506192030.26456@ronomon.com ' +
    '<<<19980507220459. \t 56557@\t ronomon.com>> ' +
    '<19980508103652.21462@ronomon.com> ' +
    '<  \t  ><19       \t\t\t\t980509035615.40087@ronomon.com>',
    [
      '19980506192030.26456@ronomon.com',
      '19980507220459.56557@ronomon.com',
      '19980508103652.21462@ronomon.com',
      '19980509035615.40087@ronomon.com'
    ]
  ],
  [
    '<<<<>>>>(<falsepositive>)    ',
    []
  ]
];
tests.forEach(
  function(test) {
    Test.equal(
      MIME.decodeHeaderIdentifiers(Buffer.from(test[0], 'binary')),
      test[1],
      namespace,
      JSON.stringify(test[0])
    );
  }
);
