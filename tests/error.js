var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var fs = require('fs');
var path = require('path');
var namespace = 'MIME.Error';
var internal = {
  'buffer must be a buffer': 1,
  'buffer must be a buffer or an array of buffers': 1,
  'charset must be a string': 1,
  'matched false positive encoded-word': 1,
  'sourceStart > sourceLength': 1,
  'sourceStart < 0': 1,
  'sourceLength < 0': 1
};
var used = {};
var filename = path.resolve(path.dirname(module.filename), '../index.js');
var source = fs.readFileSync(filename, 'utf-8');
var matches = source.match(/throw ([^;\r\n]+)/g);
matches.forEach(
  function(match) {
    try {
      Test.equal(match, match, namespace, 'match');
      if (/^throw error$/.test(match)) return;
      Test.equal(
        /^throw new Error\([^)]+\)$/.test(match),
        true,
        namespace,
        'new Error(...)'
      );
      var reference = match.match(/\([^)]+\)/);
      if (!reference) throw new Error('could not extract key from match');
      reference = reference[0].slice(1, -1);
      if (/^'.+'$/.test(reference)) {
        Test.equal(
          internal.hasOwnProperty(reference.slice(1, -1)),
          true,
          namespace,
          'internal'
        );
      } else {
        Test.equal(
          /^(self|MIME)\.Error\.[A-Za-z0-9]+$/.test(reference),
          true,
          namespace,
          'self.Error'
        );
        var key = reference.replace(/^(self|MIME)\.Error\./, '');
        Test.equal(
          MIME.Error.hasOwnProperty(key),
          true,
          namespace,
          key + ': defined'
        );
        Test.equal(
          MIME.Errors.hasOwnProperty(MIME.Error[key]),
          true,
          namespace,
          key + ': mapped'
        );
        used[key] = 1;
      }
    } catch (error) {
      console.log('');
      console.log('MATCH: ' + JSON.stringify(match));
      throw error;
    }
  }
);

for (var key in MIME.Error) {
  Test.equal(
    used.hasOwnProperty(key),
    true,
    namespace,
    key + ': used'
  );
}

for (var key in MIME.Error) {
  Test.equal(
    /^550 .+\.\r\n$/.test(MIME.Error[key]),
    true,
    namespace,
    'format: ' + JSON.stringify(MIME.Error[key])
  );
  // RFC 5321 4.5.3.1.5 Reply Line
  // The maximum total length of a reply line including the reply code and
  // the <CRLF> is 512 octets. More information may be conveyed through
  // multiple-line replies.
  Test.equal(
    MIME.Error[key].length <= (512 - 2),
    true,
    namespace,
    'length'
  );
}
