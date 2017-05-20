var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaderUnfold';
function generateCRLF() {
  var decision = random();
  if (decision < 0.4) {
    return Buffer.from('\r\n');
  } else if (decision < 0.8) {
    return Buffer.from('\n');
  } else {
    return Buffer.from('\r');
  }
}
function generateFWS() {
  var buffers = [];
  buffers.push(generateCRLF());
  if (random() < 0.8) buffers.push(generateWSP());
  return Buffer.concat(buffers);
}
function generateHeaderBody() {
  var buffers = [];
  var tokens = Math.round(random() * 32);
  while (tokens--) {
    if (random() < 0.5) {
      buffers.push(generateVCHAR());
    } else {
      buffers.push(generateFWS());
    }
  }
  return Buffer.concat(buffers);
}
function generateVCHAR() {
  var length = Math.round(random() * 32);
  var buffer = Buffer.alloc(length);
  while (length--) {
    var vchar = 33 + Math.floor(random() * (126 + 1 - 33));
    if (vchar < 33 || vchar > 126) throw new Error('bad vchar: ' + vchar);
    buffer[length] = vchar;
  }
  return buffer;
}
function generateWSP() {
  var length = Math.max(1, Math.round(random() * 8));
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = (random() < 0.5) ? 9 : 32;
  return buffer;
}
function independent(buffer) {
  var index = 0;
  var length = buffer.length;
  while (index < length) {
    if (buffer[index] === 13) {
      if (index + 1 < length && buffer[index + 1] === 10) {
        if (
          (index + 2 >= length) ||
          (buffer[index + 2] !== 9 && buffer[index + 2] !== 32)
        ) {
          throw new Error(MIME.Error.HeaderCRLF);
        }
      } else {
        throw new Error(MIME.Error.HeaderCR);
      }
    } else if (buffer[index] === 10) {
      if (
        (index + 1 >= length) ||
        (buffer[index + 1] !== 9 && buffer[index + 1] !== 32)
      ) {
        throw new Error(MIME.Error.HeaderCRLF);
      }
    }
    index++;
  }
  var string = buffer.toString('binary');
  string = string.replace(/\r?\n(?=[\t ])/g, '');
  return Buffer.from(string, 'binary');
}
function execute(method) {
  try {
    return method();
  } catch (exception) {
    return exception;
  }
}
var tests = 1000;
while (tests--) {
  var source = generateHeaderBody();
  var sourceHash = common.hash(source);
  try {
    var targetExpected = independent(source);
    var targetExceptionExpected = undefined;
  } catch (exception) {
    var targetExceptionExpected = exception.message;
  }
  try {
    var targetActual = MIME.decodeHeaderUnfold(source);
    var targetExceptionActual = undefined;
  } catch (exception) {
    var targetExceptionActual = exception.message;
  }
  try {
    Test.equal(common.hash(source), sourceHash, namespace, 'source');
    Test.equal(
      targetExceptionActual,
      targetExceptionExpected,
      namespace,
      'error'
    );
    if (targetExceptionExpected) continue;
    Test.equal(
      common.hash(targetActual),
      common.hash(targetExpected),
      namespace,
      'target'
    );
  } catch (error) {
    console.log(
      'HEADER: ' + JSON.stringify(source.toString('binary'))
    );
    if (targetExpected) {
      console.log(
        'EXPECT: ' + JSON.stringify(targetExpected.toString('binary'))
      );
    }
    if (targetActual) {
      console.log(
        'ACTUAL: ' + JSON.stringify(targetActual.toString('binary'))
      );
    }
    throw error;
  }
}
