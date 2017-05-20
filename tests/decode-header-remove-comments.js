var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.decodeHeaderRemoveComments';

// HTEXT is our own map which excludes: '"', '(', ')', '\'
var HTEXT = [
  33,
  35, 36, 37, 38, 39,
  42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60,
  61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79,
  80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91,
  93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108,
  109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123,
  124, 125, 126
];

function generateCContent() {
  var decision = random();
  if (decision < 0.33) return generateMap(common.CTEXT);
  if (decision < 0.66) return generateQuotedPair();
  return generateComment();
}
function generateComment() {
  var buffers = [];
  buffers.push(Buffer.from('('));
  if (random() < 0.5) buffers.push(generateMap(common.WSP));
  buffers.push(generateCContent());
  if (random() < 0.5) buffers.push(generateMap(common.WSP));
  buffers.push(Buffer.from(')'));
  return Buffer.concat(buffers);
}
function generateHeaderBody(result) {
  var buffers = [];
  var length = Math.round(random() * 32);
  while (length--) buffers.push(generateToken(result));
  return Buffer.concat(buffers);
}
function generateMap(map) {
  var length = Math.max(1, Math.round(random() * 10));
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = map[Math.floor(random() * map.length)];
  return buffer;
}
function generateQuotedPair() {
  var map = [
    34, // '"'
    40, // '('
    41, // ')'
    92  // '\'
  ];
  var buffer = Buffer.alloc(2);
  buffer[0] = 92;
  if (random() < 0.5) {
    buffer[1] = map[Math.floor(random() * map.length)];
    if (map.indexOf(buffer[1]) == -1) {
      throw new Error('bad quoted-pair');
    }
  } else {
    // VCHAR = %x21-7E (33-126 inclusive)
    buffer[1] = common.VCHAR[Math.floor(random() * common.VCHAR.length)];
    if (buffer[1] < 33 || buffer[1] > 126) {
      throw new Error('bad VCHAR');
    }
  }
  return buffer;
}
function generateQContent() {
  var decision = random();
  if (decision < 0.50) return generateMap(common.QTEXT);
  return generateQuotedPair();
}
function generateQuotedString() {
  var buffers = [];
  buffers.push(Buffer.from('"'));
  if (random() < 0.5) buffers.push(generateMap(common.WSP));
  buffers.push(generateQContent());
  if (random() < 0.5) buffers.push(generateMap(common.WSP));
  buffers.push(Buffer.from('"'));
  return Buffer.concat(buffers);
}
function generateToken(result) {
  var decision = random();
  if (decision < 0.25) {
    var buffer = generateMap(HTEXT);
    result.push(buffer);
  } else if (decision < 0.5) {
    var buffer = generateQuotedString();
    result.push(buffer);
  } else if (decision < 0.9) {
    var buffer = generateComment();
  } else {
    var buffer = generateMap(common.WSP);
    result.push(buffer);
  }
  return buffer;
}
var length = 1000;
while (length--) {
  var result = [];
  var source = generateHeaderBody(result);
  var sourceHash = common.hash(source);
  var targetExpected = Buffer.concat(result);
  var targetActual = MIME.decodeHeaderRemoveComments(source);
  try {
    Test.equal(common.hash(source), sourceHash, namespace, 'source');
    Test.equal(
      common.hash(targetActual),
      common.hash(targetExpected),
      namespace,
      'target'
    );
  } catch (exception) {
    console.log('SOURCE: ' + source.toString('binary'));
    console.log('');
    console.log('ACTUAL: ' + targetActual.toString('binary'));
    console.log('');
    console.log('EXPECT: ' + targetExpected.toString('binary'));
    console.log('');
    throw exception;
  }
}
