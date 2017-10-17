var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.encodeHeaderReceived';
var tests = [
  [
    {
      from: null
    },
    null,
    'From-domain must be a string'
  ],
  [
    {
      from: 1
    },
    null,
    'From-domain must be a string'
  ],
  [
    {
      from: ' ronomon.com'
    },
    null,
    'From-domain must be a valid domain'
  ],
  [
    {
      from: 'ronomon.com',
      ip: null
    },
    null,
    'TCP-info ip must be a string'
  ],
  [
    {
      from: 'ronomon.com',
      ip: 1
    },
    null,
    'TCP-info ip must be a string'
  ],
  [
    {
      from: 'ronomon.com',
      ip: '256.256.256.256'
    },
    null,
    'TCP-info ip must be a valid IPv4 or IPv6 address'
  ],
  [
    {
      from: 'ronomon.com',
      ip: 'fe80:95f7:a2bb:a2f9:1ec7'
    },
    null,
    'TCP-info ip must be a valid IPv4 or IPv6 address'
  ],
  [
    {
      by: undefined
    },
    null,
    'By-domain must be provided'
  ],
  [
    {
      by: null
    },
    null,
    'By-domain must be a string'
  ],
  [
    {
      by: 1
    },
    null,
    'By-domain must be a string'
  ],
  [
    {
      by: 'ronomon.com]'
    },
    null,
    'By-domain must be a valid domain'
  ],
  [
    {
      by: 'ronomon.com',
      via: null
    },
    null,
    'Via must be a string'
  ],
  [
    {
      by: 'ronomon.com',
      via: 'a.a'
    },
    null,
    'Via must be a valid atom'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: null
    },
    null,
    'Protocol must be a string'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 1
    },
    null,
    'Protocol must be a string'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 'smtp'
    },
    null,
    'Protocol must be a registered protocol type'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 'SMTP\t'
    },
    null,
    'Protocol must be a registered protocol type'
  ],
  [
    {
      by: 'ronomon.com',
      id: null
    },
    null,
    'ID must be a string'
  ],
  [
    {
      by: 'ronomon.com',
      id: ''
    },
    null,
    'ID must be a valid atom or msg-id'
  ],
  [
    {
      by: 'ronomon.com',
      id: 'a.a'
    },
    null,
    'ID must be a valid atom or msg-id'
  ],
  [
    {
      by: 'ronomon.com',
      id: '<a@>'
    },
    null,
    'ID must be a valid atom or msg-id'
  ],
  [
    {
      by: 'ronomon.com',
      ip: '255.255.255.255'
    },
    null,
    'From-domain must be provided if TCP-info is provided'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 'ESMTP'
    },
    null,
    'From-domain must be provided in an SMTP environment'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 'ESMTPS'
    },
    null,
    'From-domain must be provided in an SMTP environment'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 'ESMTPSA'
    },
    null,
    'From-domain must be provided in an SMTP environment'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 'SMTP'
    },
    null,
    'From-domain must be provided in an SMTP environment'
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 'ESMTPSA'
    },
    null,
    'From-domain must be provided in an SMTP environment'
  ],
  [
    {
      by: 'ronomon.com',
      recipient: null
    },
    null,
    'For recipient must be a string'
  ],
  [
    {
      by: 'ronomon.com',
      recipient: ''
    },
    null,
    'For recipient must be a valid path or mailbox'
  ],
  [
    {
      by: 'ronomon.com'
    },
    null,
    'timestamp must be provided'
  ],
  [
    {
      by: 'ronomon.com',
      timestamp: null
    },
    null,
    'timestamp must be a number'
  ],
  [
    {
      by: 'ronomon.com',
      timestamp: '0'
    },
    null,
    'timestamp must be a number'
  ],
  [
    {
      by: 'ronomon.com',
      timestamp: 0.1
    },
    null,
    'timestamp must be an integer'
  ],
  [
    {
      by: 'ronomon.com',
      timestamp: 0,
      offset: null
    },
    null,
    'offset in minutes must be a number'
  ],
  [
    {
      by: 'ronomon.com',
      timestamp: 0,
      offset: 1.1
    },
    null,
    'offset in minutes must be an integer'
  ],
  [
    {
      from: 'ronomon.com',
      by: 'mail-wm0-f6.google.com',
      protocol: 'SMTP',
      id: 'l10s5369711',
      recipient: '<joran@ronomon.com>',
      timestamp: 1507893500000,
      offset: -7 * 60
    },
    'Received: from ronomon.com by mail-wm0-f6.google.com with SMTP id ' +
    'l10s5369711 for <joran@ronomon.com>; Fri, 13 Oct 2017 04:18:20 -0700\r\n',
    null
  ],
  [
    {
      from: '[1.1.1.1]',
      ip: '10.3.4.5',
      by: '[]',
      via: 'TCP',
      protocol: 'HTTP',
      id: '123',
      recipient: '"Joran Greef" <joran@[]>',
      timestamp: 1507893500000,
      offset: -7 * 60
    },
    'Received: from [1.1.1.1] ([1.1.1.1] [10.3.4.5]) by [] via TCP with HTTP ' +
    'id 123 for "Joran Greef" <joran@[]>; Fri, 13 Oct 2017 04:18:20 -0700\r\n',
    null
  ],
  [
    {
      by: 'ronomon.com',
      protocol: 'HTTP',
      timestamp: 1507892486000,
      offset: -7 * 60
    },
    'Received: by ronomon.com with HTTP; Fri, 13 Oct 2017 04:01:26 -0700\r\n',
    null
  ],
  [
    {
      from: 'compute.internal',
      ip: '10.202.2.45',
      by: 'mail.nyi.internal',
      protocol: 'ESMTP',
      id: '8AF4A159',
      recipient: '<joran@ronomon.com>',
      timestamp: 1507899723000,
      offset: -4 * 60
    },
    'Received: from compute.internal (compute.internal [10.202.2.45]) by ' +
    'mail.nyi.internal with ESMTP id 8AF4A159 for <joran@ronomon.com>; ' +
    'Fri, 13 Oct 2017 09:02:03 -0400\r\n',
    null
  ],
  [
    {
      from: 'web6',
      ip: 'fe80::95f7:a2bb:a2f9:1ec7',
      by: 'compute.internal',
      id: '<0XR001000@pv37p45im401.ronomon.com>',
      timestamp: 1507893187000,
      offset: 0 * 60
    },
    'Received: from web6 (web6 [fe80::95f7:a2bb:a2f9:1ec7]) by ' +
    'compute.internal id <0XR001000@pv37p45im401.ronomon.com>; ' + 
    'Fri, 13 Oct 2017 11:13:07 +0000\r\n',
    null
  ],
];
function assertLineLengths(header) {
  var lines = header.split(/\r\n/);
  lines.forEach(
    function(line, index) {
      if (index === 0) {
        Test.equal(/^Received: /.test(line), true, namespace, 'field name');
      } else if (index < lines.length - 1) {
        Test.equal(/^ /.test(line), true, namespace, 'line starts with FWS');
      } else {
        Test.equal(line.length === 0, true, namespace, 'trailing CRLF');
      }
      Test.equal(
        line.length <= 78,
        true,
        namespace,
        'line length <= 78 excluding CRLF'
      );
    }
  );
}
tests.forEach(
  function(test) {
    try {
      var actual = MIME.encodeHeaderReceived(test[0]).toString('ascii');
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;
    }
    try {
      var expect = test[1];
      if (actual) {
        Test.equal(
          actual.replace(/\r\n(?=\s)/g, ''),
          expect,
          namespace,
          JSON.stringify(test[0])
        );
        assertLineLengths(actual);
      } else {
        Test.equal(actualError, test[2], namespace, 'error');
      }
    } catch (error) {
      console.log(JSON.stringify(test[0]));
      throw error;
    }
  }
);
