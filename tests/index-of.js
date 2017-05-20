var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.indexOf';

function indexOf(source, sourceIndex, sourceLength, code) {
  var index = source.indexOf(code, sourceIndex);
  if (index === -1) return index;
  if (index >= sourceLength) return -1;
  return index;
}

var tests = 1000;
while (tests--) {
  var source = common.generateMap(common.QTEXT);
  if (random() < 0.2) {
    var sourceIndex = Math.floor(random() * source.length);
    var sourceLength = Math.floor(random() * source.length);
  } else {
    var sourceIndex = 0;
    var sourceLength = source.length;
  }
  if (random() < 0.8) {
    var code = source[Math.floor(random() * source.length)];
  } else {
    var code = Math.floor(random() * 256);
  }
  Test.equal(
    MIME.indexOf(source, sourceIndex, sourceLength, code),
    indexOf(source, sourceIndex, sourceLength, code),
    namespace,
    'indexOf'
  );
}
