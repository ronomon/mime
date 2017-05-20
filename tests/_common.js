var crypto = require('crypto');

var Test = {};

Test.equal = function(actual, expect, namespace, description) {
  actual = JSON.stringify(actual) + '';
  expect = JSON.stringify(expect) + '';
  if (actual === expect) {
    var message = ['PASS'];
    if (namespace) message.push(namespace);
    if (description) message.push(description);
    message.push(expect);
    message = message.join(': ');
    console.log(message);
  } else {
    var message = ['FAIL'];
    if (namespace) message.push(namespace);
    if (description) message.push(description);
    message.push(actual + ' !== ' + expect);
    message = message.join(': ');
    throw new Error(message);
  }
};

var common = {};

common.hash = function(buffer) {
  return crypto.createHash('SHA256').update(buffer).digest('hex').slice(0, 32);
};

common.generateCRLF = function() {
  if (common.random() < 0.5) {
    return Buffer.from([13, 10]);
  } else {
    return Buffer.from([10]);
  }
};

common.generateHeaderBody = function() {
  // A field body may be composed of printable US-ASCII characters
  // as well as the space (SP, ASCII value 32) and horizontal tab (HTAB,
  // ASCII value 9) characters (together known as the white space
  // characters, WSP).  A field body MUST NOT include CR and LF except
  // when used in "folding" and "unfolding", as described in section
  // 2.2.3.
  var buffers = [];
  var tokens = common.random() < 0.1 ? 0 : Math.floor(common.random() * 128);
  var size = 0;
  while (tokens--) {
    if (common.random() < 0.9) {
      buffers.push(common.generateMap(common.HEADER_BODY));
    } else if (common.random() < 0.5) {
      if (common.random() < 0.5) {
        buffers.push(Buffer.from([13, 10, 9]));
      } else {
        buffers.push(Buffer.from([13, 10, 32]));
      }
    } else {
      if (common.random() < 0.5) {
        buffers.push(Buffer.from([10, 9]));
      } else {
        buffers.push(Buffer.from([10, 32]));
      }
    }
    size += buffers[buffers.length - 1].length;
  }
  while (buffers.length > 0 && size > (998 - 100)) {
    var buffer = buffers.shift();
    size -= buffer.length;
  }
  return Buffer.concat(buffers);
};

common.generateHeaderName = function() {
  var buffer = common.generateMap(common.HEADER_NAME);
  return buffer.slice(0, 100 - 1);
};

common.generateHeaders = function(headers, max) {
  if (max === undefined) max = 32;
  var colon = Buffer.from(':');
  var buffers = [];
  var length = common.random() < 0.1 ? 0 : Math.floor(common.random() * max);
  while (length--) {
    var name = common.generateHeaderName();
    var body = common.generateHeaderBody();
    var size = name.length + colon.length + body.length;
    buffers.push(name);
    if (common.random() < 0.2) {
      var wsp = common.generateMap(common.WSP).slice(
        0,
        998 - size
      );
      buffers.push(wsp);
      size += wsp.length;
    }
    buffers.push(colon);
    buffers.push(body);
    if (length > 0) buffers.push(common.generateCRLF());
    if (headers) {
      var bodyLeftTrim = Buffer.from(
        body.toString('binary').replace(/^[ \t]/, ''),
        'binary'
      );
      name = name.toString('binary').toLowerCase();
      if (headers.hasOwnProperty(name)) {
        headers[name].push(bodyLeftTrim);
      } else {
        headers[name] = [bodyLeftTrim];
      }
    }
  }
  return Buffer.concat(buffers);
};

common.generateMap = function(map) {
  var length = Math.max(1, Math.round(common.random() * 32));
  var buffer = Buffer.alloc(length);
  while (length--) {
    buffer[length] = map[Math.floor(common.random() * map.length)];
  }
  return buffer;
};

common.generateQuotedPair = function() {
  var map = [
    34, // '"'
    40, // '('
    41, // ')'
    92  // '\'
  ];
  var buffer = Buffer.alloc(2);
  buffer[0] = 92;
  buffer[1] = map[Math.floor(common.random() * map.length)];
  if (map.indexOf(buffer[1]) == -1) {
    throw new Error('bad quoted-pair');
  }
  return buffer;
};

common.generateQContent = function() {
  if (common.random() < 0.5) return common.generateMap(common.QTEXT);
  return common.generateQuotedPair();
};

common.generateQuotedString = function() {
  var buffers = [];
  buffers.push(Buffer.from('"'));
  if (common.random() < 0.5) buffers.push(common.generateMap(common.WSP));
  buffers.push(common.generateQContent());
  if (common.random() < 0.5) buffers.push(common.generateMap(common.WSP));
  buffers.push(Buffer.from('"'));
  return Buffer.concat(buffers);
};

common.random = Math.random.bind(Math);

common.ALPHANUMERIC = [
  // 0-9
  48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
  // A-Z
  65, 66, 67, 68, 69,
  70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
  80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  90,
  // a-z
  97, 98, 99,
  100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
  110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
  120, 121, 122
];

// obs-NO-WS-CTL   =   %d1-8 /            ; US-ASCII control
//                     %d11 /             ;  characters that do not
//                     %d12 /             ;  include the carriage
//                     %d14-31 /          ;  return, line feed, and
//                     %d127              ;  white space characters
// obs-ctext       =   obs-NO-WS-CTL
// obs-qtext       =   obs-NO-WS-CTL
// ctext           =   %d33-39 /          ; Printable US-ASCII
//                     %d42-91 /          ;  characters not including
//                     %d93-126 /         ;  "(", ")", or "\"
//                     obs-ctext
common.CTEXT = [
  33, 34, 35, 36, 37, 38, 39,
  42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
  80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91,
  93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108,
  109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123,
  124, 125, 126
];

// A field body may be composed of printable US-ASCII characters
// as well as the space (SP, ASCII value 32) and horizontal tab (HTAB,
// ASCII value 9) characters (together known as the white space
// characters, WSP).  A field body MUST NOT include CR and LF except
// when used in "folding" and "unfolding", as described in section
// 2.2.3.
common.HEADER_BODY = [
   9, 32,
  33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  51, 52, 53, 54, 55, 56, 57,     59, 60, // Except 58 (":")
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
  71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
  81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
  91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
  101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
  111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
  121, 122, 123, 124, 125, 126
];

// A field name MUST be composed of printable US-ASCII characters (i.e.,
// characters that have values between 33 and 126, inclusive)
common.HEADER_NAME = [
  33, 34, 35, 36, 37, 38, 39, 40,
  41, 42, 43, 44, 45, 46, 47, 48, 49, 50,
  51, 52, 53, 54, 55, 56, 57,     59, 60, // Except 58 (":")
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70,
  71, 72, 73, 74, 75, 76, 77, 78, 79, 80,
  81, 82, 83, 84, 85, 86, 87, 88, 89, 90,
  91, 92, 93, 94, 95, 96, 97, 98, 99, 100,
  101, 102, 103, 104, 105, 106, 107, 108, 109, 110,
  111, 112, 113, 114, 115, 116, 117, 118, 119, 120,
  121, 122, 123, 124, 125, 126
];

// qtext           =   %d33 /             ; Printable US-ASCII
//                     %d35-91 /          ;  characters not including
//                     %d93-126 /         ;  "\" or the quote character
//                     obs-qtext
common.QTEXT = [
  33,
  35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53,
  54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72,
  73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91,
  93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108,
  109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123,
  124, 125, 126
];

// VCHAR           =   %x21-7E
common.VCHAR = [
  33, 34, 35, 36, 37, 38, 39,
  40, 41, 42, 43, 44, 45, 46, 47, 48, 49,
  50, 51, 52, 53, 54, 55, 56, 57, 58, 59,
  60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
  70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
  80, 81, 82, 83, 84, 85, 86, 87, 88, 89,
  90, 91, 92, 93, 94, 95, 96, 97, 98, 99,
  100, 101, 102, 103, 104, 105, 106, 107, 108, 109,
  110, 111, 112, 113, 114, 115, 116, 117, 118, 119,
  120, 121, 122, 123, 124, 125, 126
];

common.WSP = [9, 32];

common.Test = Test;

module.exports = common;
