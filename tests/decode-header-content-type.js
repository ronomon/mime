var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaderContentType';
var tests = [
  [
    'TEXT/plain',
    { value: 'text/plain', parameters: {} },
    null
  ],
  [
    'text/plain; CHARSET=US-ascii (Plain Text)',
    { value: 'text/plain', parameters: { charset: 'US-ascii' } },
    null
  ],
  [
    ' text/plain ;  charset = " us-ascii " ',
    { value: 'text/plain', parameters: { charset: ' us-ascii ' } },
    null
  ],
  [
    ' multipart/mixed ;  boundary =  simple boundary  ',
    {
      value: 'multipart/mixed',
      parameters: { boundary: 'simple boundary' }
    },
    null
  ],
  [
    ' multipart/MIXED ;  BOUNDARY = "gc0pJq0M:08jU534c0p" ',
    {
      value: 'multipart/mixed',
      parameters: { boundary: 'gc0pJq0M:08jU534c0p' }
    },
    null
  ],
  [
    // Include "tspecials" (RFC 2045) inside quoted-string:
    'application/PDF; NAME= " ()<>@,;:\\\\/[]?=\\"multipart/alternate\\" "',
    {
      value: 'application/pdf',
      parameters: {
        name: ' ()<>@,;:\\/[]?="multipart/alternate" '
      }
    },
    null
  ],
  [
    'text/plain' +
    '; TITLE*0*=us-ascii\'en\'This%20is%20even%20more%20\r\n ' +
    '; \r\n titlE*1* = %2A%2A%2Afun%2A%2A%2A%20 \r\n\t ' +
    '; \t\t title*2 \t\r\n = \t "isn\'t it!" (;title*3=" falsepositive")',
    {
      value: 'text/plain',
      parameters: { title: 'This is even more ***fun*** isn\'t it!' }
    },
    null
  ],
  [
    undefined,
    {
      value: 'text/plain',
      parameters: {
        'charset': 'us-ascii'
      }
    },
    null
  ],
  [
    'application/(comment)pdf;\r\n\t name=\ttest.pdf',
    {
      value: 'application/pdf',
      parameters: {
        'name': 'test.pdf'
      }
    },
    null
  ],
  [
    '\tmessage/external-(comment)BODY ',
    null,
    MIME.Error.ContentTypeExternalBody
  ],
  [
    '\tmessage/(comment)partial',
    null,
    MIME.Error.ContentTypePartial
  ],
  [
    'text/ plain',
    null,
    MIME.Error.ContentType
  ],
  [
    'text/(plain)',
    null,
    MIME.Error.ContentType
  ],
  [
    'multipart/alternative',
    null,
    MIME.Error.ContentTypeBoundaryMissing
  ],
  [
    'text/plain; name==?us-ascii?Q?eicar.com?=',
    {
      value: 'text/plain',
      parameters: { name: 'eicar.com' }
    },
    null
  ],
  [
    'text/plain; name=eicar.com',
    {
      value: 'text/plain',
      parameters: { name: 'eicar.com' }
    },
    null
  ],
  [
    'text/plain; name=""eicar.com',
    {
      value: 'text/plain',
      parameters: { name: 'eicar.com' }
    },
    null
  ],
  [
    'text/plain; name="eicar.com',
    null,
    MIME.Error.QuotedStringUnterminated
  ],
  [
    'text/plain; name==?us-ascii?Q?eicar.com?=',
    {
      value: 'text/plain',
      parameters: { name: 'eicar.com' }
    },
    null
  ],
  [
    'text/plain; name==?us-ascii?Q?eicar?=.com',
    {
      value: 'text/plain',
      parameters: { name: 'eicar.com' }
    },
    null
  ],
  [
    'text/plain; name==?us-ascii?Q?eicar?= =?us-ascii?Q?.com?=',
    {
      value: 'text/plain',
      parameters: { name: 'eicar.com' }
    },
    null
  ],
  [
    'text/plain; name="eicar.=?us-ascii?Q?com?="',
    {
      value: 'text/plain',
      parameters: { name: 'eicar.com' }
    },
    null
  ],
  [
    'text/plain; name="eicar.=?us-ascii?Q?com?=',
    null,
    MIME.Error.QuotedStringUnterminated
  ],
  [
    'text/plain; name=eicar.=?us-ascii?Q?com?=',
    {
      value: 'text/plain',
      parameters: { name: 'eicar.com' }
    },
    null
  ],
  [
    'text/plain; name="safe.txt"; name="eicar.com"',
    null,
    MIME.Error.ParameterMultipleName
  ],
  [
    // Outlook Express will proceed further to strip double quotes from '"e"xe':
    'text/plain; name="trojan.\\"e\\"xe"',
    {
      value: 'text/plain',
      parameters: { name: 'trojan."e"xe' }
    },
    null
  ]
];
tests.forEach(
  function(test) {
    if (typeof test[0] === 'string') {
      var buffer = Buffer.from(test[0]);
    } else {
      var buffer = test[0];
    }
    try {
      var actual = MIME.decodeHeaderContentType(buffer);
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;
    }
    try {
      var expect = test[1];
      if (actual) {
        Test.equal(
          actual.value,
          expect.value,
          namespace,
          JSON.stringify(test[0])
        );
        for (var key in actual.parameters) {
          Test.equal(
            actual.parameters[key],
            expect.parameters[key],
            namespace,
            key
          );
        }
        for (var key in expect.parameters) {
          Test.equal(
            actual.parameters.hasOwnProperty(key),
            true,
            namespace,
            key
          );
        }
      } else {
        Test.equal(actualError, test[2], namespace, 'error');
      }
    } catch (error) {
      console.log('Header: ' + JSON.stringify(test[0]));
      throw error;
    }
  }
);
