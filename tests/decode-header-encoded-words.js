var common = require('./_common.js');
var random = common.random;
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.decodeHeaderEncodedWords';

function generateCharset() {
  var buffers = [];
  if (random() < 0.5) buffers.push(generateMap(common.WSP));
  buffers.push(Buffer.from('utf-8'));
  if (random() < 0.5) buffers.push(generateMap(common.WSP));
  return Buffer.concat(buffers);
}
function generateEncodedText(encoding, buffer) {
  encoding = encoding.toString('ascii').trim().toUpperCase();
  if (encoding === 'Q') {
    return MIME.QuotedPrintable.encode(buffer, { qEncoding: true });
  } else if (encoding === 'B') {
    return MIME.Base64.encode(buffer);
  } else {
    return buffer;
  }
}
function generateEncodedWord(text, falsePositive) {
  var prefix = generateEncodedWordPrefix();
  var charset = generateCharset();
  var encoding = generateEncoding(falsePositive);
  var encodedText = generateEncodedText(encoding, text);
  var suffix = generateEncodedWordSuffix();
  var buffers = [
    prefix,
    charset,
    Buffer.from('?'),
    encoding,
    Buffer.from('?'),
    encodedText,
    suffix
  ];
  return Buffer.concat(buffers);
}
function generateEncodedWordPrefix() {
  return Buffer.from('=?');
}
function generateEncodedWordSuffix() {
  return Buffer.from('?=');
}
function generateEncoding(falsePositive) {
  if (falsePositive) {
    var encoding = 'F';
  } else {
    var encoding = random() < 0.5 ? 'Q' : 'B';
  }
  if (random() < 0.5) encoding = encoding.toLowerCase();
  var buffers = [];
  if (random() < 0.5) buffers.push(generateMap(common.WSP));
  buffers.push(Buffer.from(encoding, 'ascii'));
  if (random() < 0.5) buffers.push(generateMap(common.WSP));
  return Buffer.concat(buffers);
}
function generateMap(map) {
  var length = Math.max(1, Math.round(random() * 20));
  var buffer = Buffer.alloc(length);
  while (length--) buffer[length] = map[Math.floor(random() * map.length)];
  return buffer;
}
function generateText() {
  if (random() < 0.05) {
    var length = 0;
  } else {
    var length = Math.floor(random() * 512);
  }
  var buffer = Buffer.alloc(length);
  while (length--) {
    var code = Math.floor(random() * 256);
    if ((code <= 31 && code !== 9) || code === 127) code += 32;
    buffer[length] = code;
  }
  return Buffer.from(buffer.toString('utf-8'), 'utf-8');
}
function generateWords(result) {
  var words = [];
  var texts = [];
  var count = Math.floor(random() * 32);
  while (count--) {
    if (random() < 0.5) {
      var text = generateText();
      var falsePositive = random() < 0.2;
      var encodedWord = generateEncodedWord(text, falsePositive);
      words.push(encodedWord);
      texts.push(falsePositive ? encodedWord : text);
    } else if (random() < 0.1) {
      var text = generateMap([9, 10, 13, 32]);
      words.push(text);
      texts.push(text);
    } else {
      var string = generateText().toString('ascii');
      if (/=\?[^?]*\?\s*(b|q)\s*\?[^?]*\?=/i.test(string)) {
        // Do not inject an accidental encoded-word.
        count++;
        continue;
      }
      var text = Buffer.from(string, 'ascii');
      words.push(text);
      texts.push(text);
    }
  }
  var symbol = -1;
  words.forEach(
    function(word, index) {
      var text = texts[index];
      if (text === word) {
        // Not encoded (plain-text or space).
        if (!isSpace(text)) symbol = -1;
      } else {
        // Encoded-word.
        if (symbol >= 0) {
          // Erase spaces in texts between symbol and current index:
          texts.forEach(
            function(text, textIndex) {
              if (textIndex > symbol && textIndex < index) {
                if (!isSpace(text)) throw new Error('expected space');
                texts[textIndex] = Buffer.alloc(0);
              }
            }
          );
        }
        symbol = index;
      }
    }
  );
  texts.forEach(
    function(text) {
      result.push(text);
    }
  );
  return Buffer.concat(words);
}
function isSpace(buffer) {
  return buffer.toString('ascii').replace(/[\t\n\r ]+/g, '').length === 0;
}

var samples = [
  [
    '=?=?utf-8?q?test?=',
    '=?test'
  ],
  [
    '=?utf-8?F?P?= =?utf-8?q?test?=',
    '=?utf-8?F?P?= test'
  ],
  [
    '=?utf-8?F?P?==?utf-8?q?test?=',
    '=?utf-8?F?P?=test'
  ],
  [
    '=?utf-8?F?P?=?utf-8?q?test?=',
    '=?utf-8?F?P?test'
  ],
  [
    '=??Q?test?=',
    'test'
  ],
  [
    '=?utf-8?Q??=',
    ''
  ],
  [
    '=?utf-8?B??=',
    ''
  ],
  [
    '=??Q??=',
    ''
  ],
  [
    '=??Q??= \t =??Q??==??Q??= \t\r\n =??Q??==??Q??= \t =??Q??=',
    ''
  ],
  [
    '=?ISO-8859-1?Q?a_b?=',
    'a b'
  ],
  [
    '=?ISO-8859-1?Q?a?= =?ISO-8859-2?Q?_b?=',
    'a b'
  ],
  [
    '=?utf-8?B?' + Buffer.from([  9]).toString('base64') + '?=',
    '\t'
  ],
  [
    '=?utf-8?B?' + Buffer.from([ 32]).toString('base64') + '?=',
    ' '
  ],
  [
    '=?utf-8?B?' + Buffer.from([  0]).toString('base64') + '?=',
    ' ',
    MIME.Error.EncodedWordControlCharacters
  ],
  [
    '=?utf-8?B?' + Buffer.from([ 10]).toString('base64') + '?=',
    ' ',
    MIME.Error.EncodedWordControlCharacters
  ],
  [
    '=?utf-8?B?' + Buffer.from([ 13]).toString('base64') + '?=',
    ' ',
    MIME.Error.EncodedWordControlCharacters
  ],
  [
    '=?utf-8?B?' + Buffer.from([ 31]).toString('base64') + '?=',
    ' ',
    MIME.Error.EncodedWordControlCharacters
  ],
  [
    '=?utf-8?B?' + Buffer.from([127]).toString('base64') + '?=',
    ' ',
    MIME.Error.EncodedWordControlCharacters
  ]
];

samples.forEach(
  function(sample) {
    var source = Buffer.from(sample[0], 'ascii');
    var error;
    try {
      var target = MIME.decodeHeaderEncodedWords(source).toString('utf-8');
    } catch (exception) {
      error = exception.message || exception;
    }
    if (sample.length <= 2) {
      Test.equal(
        target,
        sample[1],
        namespace,
        JSON.stringify(sample[0])
      );
    } else {
      Test.equal(
        error,
        sample[2],
        namespace,
        JSON.stringify(sample[0])
      );
    }
  }
);

var tests = 1000;
while (tests--) {
  try {
    var result = [];
    var source = generateWords(result);
    var sourceHash = common.hash(source);
    var expect = Buffer.concat(result);
    var target = MIME.decodeHeaderEncodedWords(source);
    Test.equal(
      common.hash(source),
      sourceHash,
      namespace,
      'source'
    );
    Test.equal(common.hash(target), common.hash(expect), namespace, 'target');
    Test.equal(
      target === source,
      common.hash(expect) === sourceHash,
      namespace,
      'pointer'
    );
  } catch (error) {
    console.log('');
    if (source) {
      console.log('SOURCE: ' + JSON.stringify(source.toString('utf-8')));
    }
    if (expect) {
      console.log('EXPECT: ' + JSON.stringify(expect.toString('utf-8')));
    }
    if (target) {
      console.log('ACTUAL: ' + JSON.stringify(target.toString('utf-8')));
    }
    throw error;
  }
}
