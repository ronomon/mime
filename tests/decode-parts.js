var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');

function decodePartsFindBoundary(buffer, pattern, index) {
  while (true) {
    index = buffer.indexOf(pattern, index);
    if (index === -1) return undefined;
    if (
      (index === 0) ||
      (index >= 2 && buffer.slice(index - 2, index).toString() === '\r\n') ||
      (index >= 1 && buffer.slice(index - 1, index).toString() === '\n')
    ) {
      var boundary = {
        begin: index,
        end: index + pattern.length,
        closing: false
      };
      if (index >= 2 && buffer.slice(index - 2, index).toString() === '\r\n') {
        boundary.begin -= 2;
      } else {
        if (index >= 1 && buffer.slice(index - 1, index).toString() === '\n') {
          boundary.begin -= 1;
        }
      }
      if (buffer.slice(boundary.end, boundary.end + 2).toString() === '--') {
        boundary.end += 2;
        boundary.closing = true;
      }
      while (
        (buffer.slice(boundary.end, boundary.end + 1).toString() === ' ') ||
        (buffer.slice(boundary.end, boundary.end + 1).toString() === '\t')
      ) {
        boundary.end++;
      }
      if (
        buffer.slice(boundary.end, boundary.end + 4).toString() === '\r\n\r\n'
      ) {
        return boundary;
      }
      if (
        buffer.slice(boundary.end, boundary.end + 2).toString() === '\r\n'
      ) {
        boundary.end += 2;
        return boundary;
      }
      if (
        buffer.slice(boundary.end, boundary.end + 2).toString() === '\n\n'
      ) {
        return boundary;
      }
      if (
        buffer.slice(boundary.end, boundary.end + 1).toString() === '\n'
      ) {
        boundary.end += 1;
        return boundary;
      }
      if (boundary.closing && boundary.end === buffer.length) {
        // This is for message transports which might strip the CRLF after the
        // closing boundary.
        return boundary;
      }
    }
    index++;
  }
}

var ASCII = '';
ASCII += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
ASCII += 'abcdefghijklmnopqrstuvwyxz';
ASCII += '0123456789';

function generateASCII(size) {
  var string = '';
  while (size--) string += ASCII[Math.floor(random() * ASCII.length)];
  return string;
}

function generateBody(crlf, boundary) {
  var body = [];
  var lines = Math.floor(random() * 7);
  while (lines--) body.push(generateLine(crlf, boundary));
  return body.join(crlf);
}

var BCHARSNOSPACE = '';
BCHARSNOSPACE += '0123456789';
BCHARSNOSPACE += 'abcdefghijklmnopqrstuvwxyz';
BCHARSNOSPACE += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
BCHARSNOSPACE += "'()+_,-./:=?";

var BCHARS = '';
BCHARS += BCHARSNOSPACE;
BCHARS += new Array(BCHARSNOSPACE.length + 1).join(' ');

function generateBoundary() {
  // Boundary delimiters must not appear within the encapsulated material,
  // and must be no longer than 70 characters, not counting the two
  // leading hyphens.

  // boundary := 0*69<bchars> bcharsnospace
  //
  // bchars := bcharsnospace / " "
  //
  // bcharsnospace := DIGIT / ALPHA / "'" / "(" / ")" /
  //                 "+" / "_" / "," / "-" / "." /
  //                 "/" / ":" / "=" / "?"
  if (random() < 0.5) {
    var string = '';
    var size = Math.min(69, 10 + Math.floor(random() * 60));
    while (size--) {
      string += BCHARS[Math.floor(random() * BCHARS.length)];
    }
    string += BCHARSNOSPACE[Math.floor(random() * BCHARSNOSPACE.length)];
    return string;
  } else {
    var size = Math.min(70, 10 + Math.floor(random() * 61));
    return generateASCII(size);
  }
}

function generateFalsePositive(crlf, boundary) {
  var string = '--' + boundary;
  if (random() < 0.2) string = string.replace('--', ' --');
  if (random() < 0.2) string = string.replace('--', '\t--');
  if (random() < 0.2) string = string.replace('--', '\r--');
  if (random() < 0.2) string = string.replace('--', '-- ');
  if (random() < 0.2) string = string.replace('--', '--' + crlf);
  if (random() < 0.2) string = string.slice(0, -1);
  if (random() < 0.2) string = string + ' \t Z';
  if (random() < 0.2) string = string + '-- \t Z';
  if (random() < 0.2 || string === ('--' + boundary)) {
    string = string + 'FALSEPOSITIVE';
  }
  return string;
}

function generateLine(crlf, boundary) {
  if (random() < 0.1) {
    return generateFalsePositive(crlf, boundary);
  } else if (random() < 0.1) {
    return '';
  } else {
    return generateASCII(Math.floor(random() * 10));
  }
}

function generateLWSP() {
  var string = '';
  var lwsp = '\t ';
  var length = Math.floor(random() * 5);
  while (length--) string += lwsp[Math.floor(random() * lwsp.length)];
  return string;
}

function generatePart(crlf, boundary) {
  var part = '';
  if (random() < 0.5) {
    part += 'Content-Type: text/ascii' + crlf + crlf;
  } else {
    part += crlf + crlf;
  }
  if (random() < 0.5) part += generateBody(crlf, boundary);
  return part;
}

function generateParts(crlf, boundary, expected) {
  var parts = [];
  if (random() < 0.5) parts.push(generateBody(crlf, boundary)); // Preamble
  var length = Math.floor(random() * 4);
  while (length--) {
    var delimiter = '--' + boundary;
    if (random() < 0.5) delimiter += generateLWSP();
    parts.push(delimiter);
    var part = generatePart(crlf, boundary);
    parts.push(part);
    if (/^(\r\n\r\n|\n\n)/.test(part)) part = crlf + part;
    expected.push(Buffer.from(part, 'ascii'));
  }
  var delimiter = '--' + boundary + '--';
  if (random() < 0.5) delimiter += generateLWSP();
  parts.push(delimiter);
  if (random() < 0.5) {
    // We do not always follow the closing boundary with a CRLF.
    // The closing boundary must be found even if the message was trimmed.
    parts.push('');
  }
  if (random() < 0.5) parts.push(generateBody(crlf, boundary)); // Epilogue
  return parts.join(crlf);
}

function generatePartsCount(count, pattern) {
  // var pattern = Buffer.from('--' + boundary, 'ascii');
  var parts = [Buffer.from('prelude\r\n', 'ascii')];
  for (var index = 0; index < count; index++) {
    parts.push(Buffer.from('--' + pattern + '\r\n', 'ascii'));
    parts.push(Buffer.from('part ' + (index + 1) + '\r\n', 'ascii'));
  }
  parts.push(Buffer.from('--' + pattern + '--\r\n', 'ascii'));
  parts.push(Buffer.from('epilogue\r\n', 'ascii'));
  return Buffer.concat(parts);
}

var samples = [];
var length = 1000;
while (length--) {
  var crlf = random() < 0.5 ? '\r\n' : '\n';
  var boundary = generateBoundary();
  var parts = [];
  var body = generateParts(crlf, boundary, parts);
  samples.push({
    crlf: crlf,
    buffer: Buffer.from(body, 'ascii'),
    boundary: boundary,
    parts: parts
  });
}

samples.push({
  crlf: '\r\n',
  buffer: Buffer.from([
    'Preamble',
    '',
    '--boundary',
    '',
    'Part without headers and without CRLF',
    '--boundarynested',
    '--boundary',
    'Headers',
    '',
    'Part with CRLF and --boundary in the middle of a line',
    '',
    '--boundary--',
    '',
    'Epilogue'
  ].join('\r\n'), 'ascii'),
  boundary: 'boundary',
  parts: [
    Buffer.from([
      '',
      '',
      'Part without headers and without CRLF',
      '--boundarynested'
    ].join('\r\n'), 'ascii'),
    Buffer.from([
      'Headers',
      '',
      'Part with CRLF and --boundary in the middle of a line',
      '',
    ].join('\r\n'), 'ascii')
  ]
});

samples.push({
  crlf: '\r\n',
  buffer: Buffer.from([
    '--boundary',
    '',
    'Part with empty preamble and epilogue, and without headers and CRLF.',
    '--boundary--'
  ].join('\r\n'), 'ascii'),
  boundary: 'boundary',
  parts: [
    Buffer.from([
      '',
      '',
      'Part with empty preamble and epilogue, and without headers and CRLF.'
    ].join('\r\n'), 'ascii')
  ]
});

samples.push({
  crlf: '\r\n',
  buffer: Buffer.from([
    'From: Joran Greef <joran@ronomon.com>',
    'To:  Joran Greef <joran@ronomon.com>',
    'Subject: Sample message',
    'MIME-Version: 1.0',
    'Content-type: multipart/mixed; boundary="simple boundary"',
    '',
    'This is the preamble.  It is to be ignored, though it',
    'is a handy place for mail composers to include an',
    'explanatory note to non-MIME conformant readers.',
    '--simple boundary',
    '',
    'This is implicitly typed plain ASCII text.',
    'It does NOT end with a linebreak.',
    '--simple boundary \t \t ',
    'Content-type: text/plain; charset=us-ascii',
    '',
    'This is explicitly typed plain ASCII text.',
    'It DOES end with a linebreak.',
    '',
    '--simple boundary--',
    'This is the epilogue.  It is also to be ignored.'
  ].join('\r\n'), 'ascii'),
  boundary: 'simple boundary',
  parts: [
    Buffer.from([
      '',
      '',
      'This is implicitly typed plain ASCII text.',
      'It does NOT end with a linebreak.'
    ].join('\r\n'), 'ascii'),
    Buffer.from([
      'Content-type: text/plain; charset=us-ascii',
      '',
      'This is explicitly typed plain ASCII text.',
      'It DOES end with a linebreak.',
      ''
    ].join('\r\n'), 'ascii')
  ]
});

samples.push({
  crlf: '\n',
  buffer: Buffer.from([
    'From: Joran Greef <joran@ronomon.com>',
    'To:  Joran Greef <joran@ronomon.com>',
    'Subject: Sample message',
    'MIME-Version: 1.0',
    'Content-type: multipart/mixed; boundary="simple boundary"',
    '',
    'This is the preamble.  It is to be ignored, though it',
    'is a handy place for mail composers to include an',
    'explanatory note to non-MIME conformant readers.',
    '--simple boundary',
    '',
    'This is implicitly typed plain ASCII text.',
    'It does NOT end with a linebreak.',
    '--simple boundary \t \t ',
    'Content-type: text/plain; charset=us-ascii',
    '',
    'This is explicitly typed plain ASCII text.',
    'It DOES end with a linebreak.',
    '',
    '--simple boundary--',
    'This is the epilogue.  It is also to be ignored.'
  ].join('\n'), 'ascii'),
  boundary: 'simple boundary',
  parts: [
    Buffer.from([
      '',
      '',
      'This is implicitly typed plain ASCII text.',
      'It does NOT end with a linebreak.'
    ].join('\n'), 'ascii'),
    Buffer.from([
      'Content-type: text/plain; charset=us-ascii',
      '',
      'This is explicitly typed plain ASCII text.',
      'It DOES end with a linebreak.',
      ''
    ].join('\n'), 'ascii')
  ]
});

function testDecodePartsFindBoundary(buffer, pattern) {
  var namespace = 'MIME.decodePartsFindBoundary';
  var offset = 0;
  while (offset < buffer.length) {
    var boundary1 = MIME.decodePartsFindBoundary(
      buffer,
      pattern,
      offset
    );
    var boundary2 = decodePartsFindBoundary(buffer, pattern, offset);
    if (boundary2) {
      if (!boundary1) {
        Test.equal(!!boundary1, !!boundary2, namespace, 'boundary');
      }
      Test.equal(
        buffer.slice(boundary1.begin, boundary1.end).toString('ascii').trim(),
        pattern.toString('ascii') + (boundary2.closing ? '--' : ''),
        namespace,
        'boundary'
      );
      Test.equal(
        buffer.slice(boundary1.begin, boundary1.end).toString('ascii'),
        buffer.slice(boundary2.begin, boundary2.end).toString('ascii'),
        namespace,
        'boundary.range'
      );
      Test.equal(boundary1.begin, boundary2.begin, namespace, 'boundary.begin');
      Test.equal(boundary1.end, boundary2.end, namespace, 'boundary.end');
      Test.equal(
        boundary1.closing,
        boundary2.closing,
        namespace,
        'boundary.closing'
      );
      offset = boundary2.end;
    } else {
      if (boundary1) {
        Test.equal(!!boundary1, !!boundary2, namespace, 'boundary');
      }
      Test.equal(boundary1, boundary2, namespace, 'boundary');
      break;
    }
  }
}

function testDecodeParts(buffer, boundary, parts2) {
  var namespace = 'MIME.decodeParts';
  var parts1 = MIME.decodeParts(buffer, boundary);
  for (var index = 0, length = parts1.length; index < length; index++) {
    if (index >= parts2.length) {
      Test.equal(parts1.length, parts2.length, namespace, 'parts.length');
    }
    var part1 = parts1[index];
    var part2 = parts2[index];
    Test.equal(
      part1.toString('ascii'),
      part2.toString('ascii'),
      namespace,
      'part ' + index
    );
  }
  Test.equal(parts1.length, parts2.length, namespace, 'parts.length');
}

samples.forEach(
  function(sample) {
    try {
      testDecodePartsFindBoundary(
        sample.buffer,
        Buffer.from('--' + sample.boundary, 'ascii')
      );
      testDecodeParts(
        sample.buffer,
        sample.boundary,
        sample.parts
      );
    } catch (error) {
      console.log('');
      console.log('BUFFER:');
      console.log(JSON.stringify(sample.buffer.toString('ascii')));
      console.log('');
      console.log('PARTS:');
      sample.parts.forEach(
        function(part) {
          console.log(JSON.stringify(part.toString('ascii')));
        }
      );
      console.log('');
      throw error;
    }
  }
);

Test.equal(
  MIME.decodeParts(generatePartsCount(10000, 'abc'), 'abc').length,
  10000,
  'MIME.decodeParts',
  'limit: 10000'
);

try {
  MIME.decodeParts(generatePartsCount(10000 + 1, 'abc'), 'abc');
  Test.equal(
    undefined,
    MIME.Error.PartLimit,
    'MIME.decodeParts',
    'limit: 10001'
  );
} catch (error) {
  Test.equal(
    error.message,
    MIME.Error.PartLimit,
    'MIME.decodeParts',
    'limit: 10001'
  );
}
