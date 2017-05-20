var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.slice';

function assertFlag(key, value) {
  if (typeof value !== 'number') throw key + ' must be a number';
  if (Math.floor(value) !== value) throw key + ' must be an integer';
  if (value < 1) throw key + ' must be at least 1';
  if (value === 1) return;
  if (value % 2 !== 0) throw key + ' must be divisible by 2';
  if ((value & (value - 1)) !== 0) throw key + ' must be a power of 2';
}
function generateASCII() {
  var length = Math.round(random() * 8);
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = Math.floor(random() * 128);
  return buffer;
}
function generateBuffer() {
  var buffers = [];
  buffers.push(generateWhitespace());
  buffers.push(generateQuotes());
  buffers.push(generateASCII());
  buffers.push(generateQuotes());
  buffers.push(generateWhitespace());
  return Buffer.concat(buffers);
}
function generateQuotes() {
  if (random() < 0.5) return Buffer.alloc(0);
  var length = Math.round(random() * 4);
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = random() < 0.5 ? 34 : 32;
  return buffer;
}
function generateWhitespace() {
  if (random() < 0.5) return Buffer.alloc(0);
  var map = [9, 10, 13, 32];
  var length = Math.round(random() * 8);
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = map[Math.floor(random() * map.length)];
  return buffer;
}
function slice(source, sourceStart, sourceLength, flags) {
  var string = source.toString('binary', sourceStart, sourceLength);
  if (flags & MIME.TRIM) {
    string = string.replace(/^[\t\n\r ]+|[\t\n\r ]+$/g, '');
  }
  if (flags & MIME.LOWERCASE) {
    string = string.toLowerCase();
  } else if (flags & MIME.UPPERCASE) {
    string = string.toUpperCase();
  }
  var target = Buffer.from(string, 'binary');
  if (flags & MIME.ASCII) return target.toString('ascii');
  if (sourceStart === 0 && sourceLength === source.length) {
    if (target.equals(source)) return source;
  }
  return target;
}
var tests = 1000;
while (tests--) {
  var source = generateBuffer();
  var sourceHash = common.hash(source);
  var sourceStart = 0;
  if (random() < 0.5) {
    sourceStart = Math.floor(random() * source.length);
  }
  var sourceLength = source.length;
  if (random() < 0.5) {
    var remainder = sourceLength - sourceStart;
    sourceLength -= Math.floor(random() * remainder);
  }
  if (sourceStart > sourceLength) {
    throw new Error('sourceStart > sourceLength');
  }
  if (sourceLength < 0) {
    throw new Error('sourceLength < 0');
  }
  var flags = 0;
  var ascii = false;
  if (random() < 0.4) {
    ascii = true;
    assertFlag('ASCII', MIME.ASCII);
    flags |= MIME.ASCII;
    Test.equal(
      flags & MIME.ASCII,
      MIME.ASCII,
      namespace,
      'ASCII'
    );
  }
  var lowercase = false;
  var uppercase = false;
  if (random() < 0.4) {
    lowercase = true;
    assertFlag('LOWERCASE', MIME.LOWERCASE);
    flags |= MIME.LOWERCASE;
    Test.equal(
      flags & MIME.LOWERCASE,
      MIME.LOWERCASE,
      namespace,
      'LOWERCASE'
    );
  } else if (random() < 0.4) {
    uppercase = true;
    assertFlag('UPPERCASE', MIME.UPPERCASE);
    flags |= MIME.UPPERCASE;
    Test.equal(
      flags & MIME.UPPERCASE,
      MIME.UPPERCASE,
      namespace,
      'UPPERCASE'
    );
  }
  if (random() < 0.4) {
    assertFlag('TRIM', MIME.TRIM);
    flags |= MIME.TRIM;
    Test.equal(
      flags & MIME.TRIM,
      MIME.TRIM,
      namespace,
      'TRIM'
    );
  }
  var targetActual = MIME.slice(
    source,
    sourceStart,
    sourceLength,
    flags
  );
  var targetExpected = slice(
    source,
    sourceStart,
    sourceLength,
    flags
  );
  Test.equal(common.hash(source), sourceHash, namespace, 'source');
  Test.equal(sourceStart, sourceStart, namespace, 'sourceStart');
  Test.equal(sourceLength, sourceLength, namespace, 'sourceLength');
  Test.equal(source.length, source.length, namespace, 'source.length');
  Test.equal(
    targetActual.length,
    targetExpected.length,
    namespace,
    'target.length'
  );
  Test.equal(
    common.hash(targetActual),
    common.hash(targetExpected),
    namespace,
    'target'
  );
  if (ascii) {
    Test.equal(typeof targetActual === 'string', true, namespace, 'string');
    var targetString = targetActual;
  } else {
    Test.equal(Buffer.isBuffer(targetActual), true, namespace, 'buffer');
    var targetString = targetActual.toString('binary');
    Test.equal(
      targetActual === source,
      targetActual.equals(source),
      namespace,
      'pointer'
    );
  }
  if (lowercase) {
    Test.equal(
      /[A-Z]/.test(targetString),
      false,
      namespace,
      'uppercase'
    );
  } else if (uppercase) {
    Test.equal(
      /[a-z]/.test(targetString),
      false,
      namespace,
      'lowercase'
    );
  }
}
