var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');
var namespace = 'MIME.decodeHeaderDate';
var tests = [
  [
    undefined,
    undefined,
    null
  ],
  [
    '\t WeD \t,(c)\t 17 \t MaY \t 2017\r\n \t 1:6:6 \t+ 020  \t',
    1494975966000,
    null
  ],
  [
    '\t WeD \t,(c)\t 17 \t MaY \t 117\r\n \t 1:6:6 \t+ 020  \t',
    1494975966000,
    null
  ],
  [
    '\t WeD \t,(c)\t 17 \t MaY \t 17\r\n \t 1:6:6 \t+ 020  \t',
    1494975966000,
    null
  ],
  [
    '\t WeD \t,(c)\t 17 \t MaY \t 2017\r\n \t 1:6:6 \t SAST  \t',
    1494975966000,
    null
  ],
  [
    '\t WeD \t,(c)\t 37 \t MaY \t 2017\r\n \t 1:6:6 \t+ 020  \t',
    null,
    MIME.Error.DateDay
  ],
  [
    '\t WeD \t,(c)\t 17 \t MaD \t 2017\r\n \t 1:6:6 \t+ 020  \t',
    null,
    MIME.Error.Date
  ],
  [
    '\t WeD \t,(c)\t 17 \t May \t 2017\r\n \t 1:6:6 \t ABC  \t',
    null,
    MIME.Error.DateZone
  ],
  [
    '\t WeD \t,(c)\t 17 \t May \t 2017\r\n \t 24:6:6 \t +020  \t',
    null,
    MIME.Error.DateHour
  ],
  [
    '\t WeD \t,(c)\t 17 \t May \t 2017\r\n \t 1:60:6 \t +020  \t',
    null,
    MIME.Error.DateMinute
  ],
  [
    // Leap Second:
    '\t WeD \t,(c)\t 17 \t May \t 2017\r\n \t 1:6:60 \t +020  \t',
    1494976020000,
    null
  ],
  [
    '\t WeD \t,(c)\t 17 \t May \t 2017\r\n \t 1:6:61 \t +020  \t',
    null,
    MIME.Error.DateSecond
  ],
  [
    '\t WeD \t,(c)\t 17 \t May \t 2017\r\n \t 1:6:59 \t +240  \t',
    null,
    MIME.Error.DateZone
  ],
  [
    '\t WeD \t,(c)\t 17 \t May \t 2017\r\n \t 1:6:59 \t +236  \t',
    null,
    MIME.Error.DateZone
  ]
];
tests.forEach(
  function(test) {
    if (typeof test[0] === 'string') {
      var buffer = Buffer.from(test[0]);
    } else {
      var buffer = test[0];
    }
    try {
      var actual = MIME.decodeHeaderDate(buffer);
      var actualError = null;
    } catch (error) {
      var actual = null;
      var actualError = error.message;
    }
    Test.equal(actualError, test[2], namespace, 'error');
    Test.equal(actual, test[1], namespace, 'date');
  }
);
