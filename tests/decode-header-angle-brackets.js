var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.decodeHeaderAngleBrackets';

function addWSP(buffer) {
  do {
    var index = Math.floor(random() * buffer.length);
    var head = buffer.slice(0, index);
    var tail = buffer.slice(index);
    buffer = Buffer.concat([
      head,
      generateMap(common.WSP),
      tail
    ]);
  } while (random() < 0.25);
  return buffer;
}
function generateIdentifier() {
  var buffers = [];
  if (random() < 0.5) buffers.push(Buffer.from('<'));
  buffers.push(generateMap(common.ALPHANUMERIC));
  buffers.push(Buffer.from('@'));
  buffers.push(generateMap(common.ALPHANUMERIC));
  if (random() < 0.5) buffers.push(Buffer.from('>'));
  var buffer = Buffer.concat(buffers);
  if (
    buffer.length >= 2 &&
    buffer[0] === 60 &&
    buffer[buffer.length - 1] === 62 &&
    random() < 0.75
  ) {
    buffer = Buffer.concat([
      buffer.slice(0, 1),
      addWSP(buffer.slice(1, -1)),
      buffer.slice(-1)
    ]);
  }
  return buffer;
}
function generateMap(map) {
  var length = Math.max(1, Math.round(random() * 20));
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = map[Math.floor(random() * map.length)];
  return buffer;
}
function generateTokens() {
  var buffers = [];
  var count = Math.floor(random() * 16);
  while (count--) {
    if (random() < 0.3) buffers.push(generateMap(common.WSP));
    buffers.push(generateIdentifier());
    if (random() < 0.3) buffers.push(generateMap(common.WSP));
  }
  return Buffer.concat(buffers);
}
function standard(source) {
  return Buffer.from(
    source.toString('binary').replace(/<[^<>;,()"]+>/g,
      function(match) {
        return match.replace(/\s+/g, '');
      }
    ),
    'binary'
  );
}

var count = 0;
var tests = 1000;
while (tests--) {
  try {
    var source = generateTokens();
    var sourceHash = common.hash(source);
    var target = MIME.decodeHeaderAngleBrackets(source);
    var targetHash = common.hash(target);
    var expect = standard(source);
    Test.equal(common.hash(source), sourceHash, namespace, 'source');
    Test.equal(targetHash, common.hash(expect), namespace, 'target');
    Test.equal(
      target === source,
      targetHash === sourceHash,
      namespace,
      'pointer'
    );
  } catch (error) {
    console.log('');
    console.log('Source: ' + JSON.stringify(source.toString('binary')));
    if (target) {
      console.log('Target: ' + JSON.stringify(target.toString('binary')));
    }
    if (expect) {
      console.log('Expect: ' + JSON.stringify(expect.toString('binary')));
    }
    throw error;
  }
}
