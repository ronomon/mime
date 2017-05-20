var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaders';
function describe(heading, headers) {
  console.log(heading + ':');
  for (var name in headers) {
    console.log(
      name + ': ' + JSON.stringify(headers[name].toString('binary'))
    );
  }
}
function execute(buffer, headersActual) {
  try {
    MIME.decodeHeaders(buffer, headersActual);
  } catch (exception) {
    return exception.message;
  }
  return undefined;
}
var length = 500;
while (length--) {
  var headersExpected = {};
  var buffer = common.generateHeaders(headersExpected, 32);
  var colonMissing = Object.keys(headersExpected).length && random() < 0.2;
  if (colonMissing) {
    var colonIndex = buffer.indexOf(':'.charCodeAt(0));
    buffer[colonIndex] = 32;
  }
  var bufferHash = common.hash(buffer);
  var headersActual = {};
  try {
    if (colonMissing) {
      var exceptionExpected = MIME.Error.HeaderColonMissing;
    } else {
      var exceptionExpected = undefined;
    }
    var exceptionActual = execute(buffer, headersActual);
    Test.equal(common.hash(buffer), bufferHash, namespace, 'source unchanged');
    Test.equal(exceptionActual, exceptionExpected, namespace, 'exception');
    if (exceptionExpected) continue;
    var names = [];
    for (var name in headersExpected) {
      names.push(name);
      Test.equal(
        headersActual.hasOwnProperty(name),
        true,
        namespace,
        'header name: ' + common.hash(name)
      );
      Test.equal(
        common.hash(Buffer.concat(headersActual[name])),
        common.hash(Buffer.concat(headersExpected[name])),
        namespace,
        'header body'
      );
    }
    Test.equal(
      common.hash(Object.keys(headersActual).sort().join(' ')),
      common.hash(names.sort().join(' ')),
      namespace,
      'headers'
    );
  } catch (exception) {
    console.log('BUFFER: ' + JSON.stringify(buffer.toString('ascii')));
    describe('EXPECTED', headersExpected);
    describe('ACTUAL', headersActual);
    throw exception;
  }
}
