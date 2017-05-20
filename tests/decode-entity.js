var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeEntity';
function generateEntity(expect) {
  var headers = common.generateHeaders({}, common.random() < 0.9 ? 128 : 0);
  var crlf = common.generateCRLF();
  if (common.random() < 0.9) {
    var body = common.generateMap(common.HEADER_BODY);
  } else {
    var body = Buffer.alloc(0);
  }
  var buffers = [];
  buffers.push(headers);
  var delimited = common.random() < 0.9;
  if (delimited) {
    if (body.length === 0) {
      buffers.push(crlf);
      if (common.random() < 0.5) buffers.push(crlf);
    } else {
      buffers.push(crlf);
      buffers.push(crlf);
    }
  }
  buffers.push(body);
  if (headers.length < 262144) {
    if (delimited) {
      expect[0] = headers;
      expect[1] = body;
      expect[2] = null;
    } else {
      expect[0] = null;
      expect[1] = null;
      expect[2] = MIME.Error.HeadersCRLF;
    }
  } else {
    expect[0] = null;
    expect[1] = null;
    expect[2] = MIME.Error.HeadersLimit;
  }
  return Buffer.concat(buffers);
}
var tests = 50;
while (tests--) {
  var expect = [];
  var source = generateEntity(expect);
  var sourceHash = common.hash(source);
  try {
    var actual = MIME.decodeEntity(source);
    actual[2] = null;
  } catch (error) {
    var actual = [null, null, error.message];
  }
  Test.equal(actual[2], expect[2], namespace, 'error');
  if (!expect[2]) {
    Test.equal(
      common.hash(actual[0]),
      common.hash(expect[0]),
      namespace,
      'headers'
    );
    Test.equal(
      common.hash(actual[1]),
      common.hash(expect[1]),
      namespace,
      'body'
    );
  }
}
