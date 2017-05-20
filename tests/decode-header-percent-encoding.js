var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaderPercentEncoding';
var NONHEX = 'ghijklmnopqrstuvwxyzGHIJKLMNOPQRSTUVWXYZ';
function generateBuffer(expect) {
  var buffers = [];
  var count = Math.floor(random() * 8);
  while (count--) {
    if (random() < 0.5) {
      var buffer = common.generateMap(common.ALPHANUMERIC);
      buffers.push(buffer);
      expect.push(buffer);
    } else if (random() < 0.5) {
      var buffer = generateSymbol(true);
      buffers.push(buffer);
      var value = parseInt(buffer.toString('ascii').slice(1), 16);
      expect.push(Buffer.from([value]));
    } else {
      var buffer = generateSymbol(false);
      buffers.push(buffer);
      expect.push(buffer);
    }
  }
  return Buffer.concat(buffers);
}
function generateSymbol(valid) {
  var hex = Math.floor(random() * 256).toString(16);
  if (hex.length === 1) hex = '0' + hex;
  if (random() < 0.5) {
    hex = hex.toUpperCase();
  } else {
    hex = hex.toLowerCase();
  }
  var buffer = Buffer.from('%' + hex, 'ascii');
  if (!valid) {
    buffer[random() < 0.5 ? 1 : 2] = NONHEX.charCodeAt(
      Math.floor(random() * NONHEX.length)
    );
  }
  return buffer;
}
var tests = 1000;
while (tests--) {
  try {
    var result = [];
    var source = generateBuffer(result);
    var sourceHash = common.hash(source);
    var expect = Buffer.concat(result);
    var actual = MIME.decodeHeaderPercentEncoding(source);
    Test.equal(common.hash(source), sourceHash, namespace, 'source');
    Test.equal(common.hash(actual), common.hash(expect), namespace, 'target');
    Test.equal(
      actual === source,
      common.hash(expect) === sourceHash,
      namespace,
      'pointer'
    );
  } catch (error) {
    console.log('');
    if (source) {
      console.log('SOURCE: ' + JSON.stringify(source.toString('binary')));
    }
    if (expect) {
      console.log('EXPECT: ' + JSON.stringify(expect.toString('binary')));
    }
    if (actual) {
      console.log('ACTUAL: ' + JSON.stringify(actual.toString('binary')));
    }
    throw error;
  }
}
