var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaderValueParameters';
var tests = [
  [
    'message/external-body; access-type=URL; URL*0="ftp://"; ' +
    'URL*1="cs.utk.edu/pub/moore/bulk-mailer/bulk-mailer.tar"',
    {
      value: 'message/external-body',
      parameters: {
        'access-type': 'URL',
        'url': 'ftp://cs.utk.edu/pub/moore/bulk-mailer/bulk-mailer.tar'
      }
    }
  ],
  [
    'application/X-stuff ; title*0* = US-ascii ' +
    '\'en\'This%20is%20even%20more%20 ; title*1* = %2A%2A%2Afun%2A%2A%2A%20 ' +
    '; title*2 = "isn\'t it!"',
    {
      value: 'application/x-stuff',
      parameters: { title: 'This is even more ***fun*** isn\'t it!' }
    }
  ],
  [
    ' Image/* ; NAME \t= " *;.PNG " ',
    {
      value: 'image/*',
      parameters: { name: ' *;.PNG ' }
    }
  ],
  [
    'BINARY;name="Test_PDP-10";',
    {
      value: 'binary',
      parameters: { name: 'Test_PDP-10' }
    }
  ],
  [
    'text/plain;;; filename= ";;;\\""; format=flowed;',
    {
      value: 'text/plain',
      parameters: { filename: ';;;"', format: 'flowed' }
    }
  ],
  [
    'text/plain; FILENAME*1=" %c3%a9 Literal" ; FILENAME*= ' +
    '"utf-8\'en\'Caf%C3%a9%z";;;',
    {
      value: 'text/plain',
      parameters: { filename: 'Café%z %c3%a9 Literal' }
    }
  ],
  [
    'image/tiff;\r\n\t' +
    'name="=?utf-8?Q?1984_-_W=C3=B6lf_=5FCAT=5F?=\r\n\t' +
    '=?utf-8?Q?_DOG.tiff?="',
    {
      value: 'image/tiff',
      parameters: {
        'name': '1984 - Wölf _CAT_ DOG.tiff'
      }
    }
  ],
  [
    'attachment; filename*=utf-8\'\'O\'Kennedy%20Test.doc',
    {
      value: 'attachment',
      parameters: {
        'filename': 'O\'Kennedy Test.doc'
      }
    }
  ]
];
tests.forEach(
  function(test) {
    Test.equal(
      MIME.decodeHeaderValueParameters(Buffer.from(test[0], 'binary')),
      test[1],
      namespace,
      test[0]
    );
  }
);
