var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.decodeHeaderQuotedStrings';

function generateAtom(result) {
  var length = Math.max(1, Math.round(random() * 10));
  var buffer = Buffer.alloc(length);
  while (length--) {
    if (random() < 0.9) {
      var code = common.ALPHANUMERIC[
        Math.floor(random() * common.ALPHANUMERIC.length)
      ];
    } else {
      var code = 92; // '\'
    }
    buffer[length] = code;
  }
  if (result) result.push(buffer);
  return buffer;
}
function generateBuffer(result) {
  var buffers = [];
  var length = Math.round(random() * 16);
  while (length--) {
    if (random() < 0.5) {
      buffers.push(generateQuotedString(result));
    } else {
      buffers.push(generateAtom(result));
    }
  }
  return Buffer.concat(buffers);
}
function generateMap(map) {
  var length = Math.max(1, Math.round(random() * 4));
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = map[Math.floor(random() * map.length)];
  return buffer;
}
function generateQuotedPair(result) {
  var map = [
    34, // '"'
    40, // '('
    41, // ')'
    92  // '\'
  ];
  var buffer = Buffer.alloc(2);
  buffer[0] = 92;
  buffer[1] = map[Math.floor(random() * map.length)];
  if (map.indexOf(buffer[1]) == -1) {
    throw new Error('bad quoted-pair');
  }
  if (result) result.push(buffer.slice(1));
  return buffer;
}
function generateQContent(result) {
  var buffers = [];
  var length = Math.round(random() * 8);
  while (length--) {
    if (random() < 0.8) {
      var buffer = generateMap(common.QTEXT);
      buffers.push(buffer);
      if (result) result.push(buffer);
    } else {
      buffers.push(generateQuotedPair(result));
    }
  }
  return Buffer.concat(buffers);
}
function generateQuotedString(result) {
  var buffers = [];
  buffers.push(Buffer.from('"'));
  if (random() < 0.5) {
    var buffer = generateMap(common.WSP);
    buffers.push(buffer);
    if (result) result.push(buffer);
  }
  buffers.push(generateQContent(result));
  if (random() < 0.5) {
    var buffer = generateMap(common.WSP);
    buffers.push(buffer);
    if (result) result.push(buffer);
  }
  buffers.push(Buffer.from('"'));
  return Buffer.concat(buffers);
}
var tests = 1000;
while (tests--) {
  var result = [];
  var source = generateBuffer(result);
  var sourceHash = common.hash(source);
  var targetActual = MIME.decodeHeaderQuotedStrings(source);
  var targetExpected = Buffer.concat(result);
  Test.equal(common.hash(source), sourceHash, namespace, 'source');
  Test.equal(
    common.hash(targetActual),
    common.hash(targetExpected),
    namespace,
    'target'
  );
  Test.equal(
    targetActual === source,
    targetActual.equals(source),
    namespace,
    'pointer'
  );
}
