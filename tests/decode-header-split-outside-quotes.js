var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.decodeHeaderSplitOutsideQuotes';

function generateAtom(separators) {
  var length = Math.max(1, Math.round(random() * 10));
  var buffer = Buffer.alloc(length);
  while (length--) {
    var limit = 100000;
    while (limit--) {
      var code = common.ALPHANUMERIC[
        Math.floor(random() * common.ALPHANUMERIC.length)
      ];
      if (!separators[code]) break;
    }
    if (limit === 0) throw new Error('unable to generate code');
    buffer[length] = code;
  }
  return buffer;
}
function generateHeaderBody(separators, array) {
  var buffers = [];
  var length = Math.round(random() * 16);
  while (length--) {
    if (random() < 0.1) buffers.push(generateSeparator(separators));
    if (random() < 0.1) buffers.push(generateSeparator(separators));
    var buffer = generateToken(separators);
    buffers.push(buffer);
    var separator2 = generateSeparator(separators);
    buffers.push(separator2);
    if (separators[separator2[0]] === 1) array.push(buffer);
  }
  if (random() < 0.5) {
    var buffer = generateToken(separators);
    buffers.push(buffer);
    array.push(buffer);
  }
  return Buffer.concat(buffers);
}
function generateSeparator(separators) {
  var map = mapSeparators(separators);
  var buffer = Buffer.alloc(1);
  buffer[0] = map[Math.floor(random() * map.length)];
  return buffer;
}
function generateSeparators() {
  var buffer = Buffer.alloc(256);
  var count = Math.max(1, Math.round(random() * 16));
  while (count--) {
    var index = common.QTEXT[Math.floor(random() * common.QTEXT.length)];
    buffer[index] = random() < 0.8 ? 1 : 255;
  }
  return buffer;
}
function generateToken(separators) {
  var buffers = [];
  if (random() < 0.5) buffers.push(common.generateMap(common.WSP));
  if (random() < 0.5) {
    buffers.push(generateAtom(separators));
  } else {
    buffers.push(common.generateQuotedString());
  }
  if (random() < 0.5) buffers.push(common.generateMap(common.WSP));
  return Buffer.concat(buffers);
}
function mapSeparators(separators) {
  var map = [];
  if (separators.length !== 256) throw new Error('separators.length !== 256');
  for (var index = 0, length = separators.length; index < length; index++) {
    if (
      separators[index] !== 0 &&
      separators[index] !== 1 &&
      separators[index] !== 255
    ) {
      throw new Error('bad separators value: ' + separators[index]);
    }
    if (separators[index] > 0) map.push(index);
  }
  if (map.length === 0) throw new Error('no separators');
  return map;
}
function compare(arrayActual, arrayExpected) {
  Test.equal(
    arrayActual.length,
    arrayExpected.length,
    namespace,
    'array.length'
  );
  for (var index = 0, length = arrayActual.length; index < length; index++) {
    Test.equal(
      common.hash(arrayActual[index]),
      common.hash(arrayExpected[index]),
      namespace,
      'array[' + index + ']'
    );
    Test.equal(
      arrayActual[index].length > 0,
      true,
      namespace,
      'array[' + index + '].length > 0'
    );
  }
}
var tests = 500;
while (tests--) {
  var separators = generateSeparators();
  var arrayExpected = [];
  var source = generateHeaderBody(separators, arrayExpected);
  var sourceHash = common.hash(source);
  var arrayActual = MIME.decodeHeaderSplitOutsideQuotes(
    source,
    0,
    source.length,
    separators
  );
  try {
    Test.equal(common.hash(source), sourceHash, namespace, 'source');
    compare(arrayActual, arrayExpected);
  } catch (exception) {
    var map = mapSeparators(separators);
    for (var index = 0, length = map.length; index < length; index++) {
      console.log(
        'SEPARATOR: ' +
        String.fromCharCode(map[index]) +
        ' = ' +
        separators[map[index]]
      );
    }
    console.log('');
    console.log('SOURCE: ' + JSON.stringify(source.toString('binary')));
    console.log('');
    console.log('EXPECT: length=' + arrayExpected.length);
    var index = 0;
    var length = arrayExpected.length;
    while (index < length) {
      var element = arrayExpected[index++];
      console.log(JSON.stringify(element.toString('binary')));
    }
    console.log('');
    console.log('ACTUAL: length=' + arrayActual.length);
    var index = 0;
    var length = arrayActual.length;
    while (index < length) {
      var element = arrayActual[index++];
      console.log(JSON.stringify(element.toString('binary')));
    }
    console.log('');
    throw exception;
  }
}
var source = Buffer.from('prefix<group:"<:" <address><suffix');
var separators = Buffer.alloc(256);
separators['<'.charCodeAt(0)] = 1;
separators[':'.charCodeAt(0)] = 255;
var arrayExpected = [
  Buffer.from('"<:" '),
  Buffer.from('address>')
];
var arrayActual = MIME.decodeHeaderSplitOutsideQuotes(
  source,
  6,
  source.length - 6,
  separators
);
compare(arrayActual, arrayExpected);
