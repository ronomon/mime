var common = require('./_common.js');
var Test = common.Test;
var MIME = require('../index.js');

var namespace = 'MIME.decodeHeaderAddressesAddress';
var tests = [
  [
    ' joran@ronomon.com\t',
    { name: '', email: 'joran@ronomon.com' }
  ],
  [
    ' \'Joran\' < Joran@Ronomon.com > ',
    { name: 'Joran', email: 'Joran@Ronomon.com' }
  ],
  [
    ' \'Joran " Dirk" "" Greef\' joran@ronomon.com ',
    { name: 'Joran  Dirk Greef', email: 'joran@ronomon.com' }
  ],
  [
    ' joran@ronomon.com joran@ronomon ',
    { name: 'joran@ronomon', email: 'joran@ronomon.com' }
  ],
  [
    ' "@ronomon" <" \'joran@ronomon.com \'"> ',
    { name: '@ronomon', email: 'joran@ronomon.com' }
  ],
  [
    ' " <\' joran@ronomon.com\' >" "@ronomon" ',
    { name: '@ronomon', email: 'joran@ronomon.com' }
  ],
  [
    ' "@.ronomon" ',
    { name: '@.ronomon', email: '' }
  ],
  [
    '"Greef, J, Mnr <joran@ronomon.com>" <joran@ronomon.com>',
    { name: 'Greef, J, Mnr <joran@ronomon.com>', email: 'joran@ronomon.com' }
  ],
  [
    '"\'JORAN@RONOMON.COM\'"\t<\'JORAN@RONOMON.COM\'>',
    { name: 'JORAN@RONOMON.COM', email: 'JORAN@RONOMON.COM' }
  ],
  [
    '" \t "<"joran"@ronomon.com>',
    { name: '', email: 'joran@ronomon.com' }
  ],
  [
    'Joran<joran@ronomon.com>',
    { name: 'Joran', email: 'joran@ronomon.com' }
  ],
  [
    'Joran<"joran @ ronomon .com">',
    { name: 'Joran', email: 'joran@ronomon.com' }
  ],
  [
    '    Joran< joran\t @ ronomon \t\t  .com\t>',
    { name: 'Joran', email: 'joran@ronomon.com' }
  ],
  [
    '',
    undefined
  ],
  [
    '"" ""',
    undefined
  ],
  [
    '" "',
    undefined
  ],
  [
    '" "\t\t"a""b""c" "d"',
    { name: '  abc d', email: '' }
  ],
  [
    '"\\"\\""', // (quoted-string containing quoted-pair)
    { name: '""', email: '' }
  ],
  [
    '\'Joran <joran@ronomon.com>',
    { name: '\'Joran', email: 'joran@ronomon.com' }
  ],
  [
    '\'Joran \' <joran@ronomon.com>',
    { name: 'Joran', email: 'joran@ronomon.com' }
  ],
  [
    'joran.dirk.greef@ronomon.com',
    { name: '', email: 'joran.dirk.greef@ronomon.com' }
  ],
  [
    '\'joran@ronomon.com\'',
    { name: '', email: 'joran@ronomon.com' }
  ],
  [
    'joran@ronomon.com @ronomon.com',
    { name: '@ronomon.com', email: 'joran@ronomon.com' }
  ],
  [
    '\'@ronomon.com\'',
    { name: '@ronomon.com', email: '' }
  ],
  [
    '"@ronomon.com"',
    { name: '@ronomon.com', email: '' }
  ],
  [
    'joran@localhost',
    { name: 'joran@localhost', email: '' }
  ],
  [
    '<<<joran@ronomon.com>>>',
    { name: '', email: 'joran@ronomon.com' }
  ],
  [
    '<joran@ronomon.com>Joran',
    { name: 'Joran', email: 'joran@ronomon.com' }
  ],
  [
    '<joran@ronomon.com>"<ronomon>"',
    { name: '<ronomon>', email: 'joran@ronomon.com' }
  ],
  [
    '<joran@ronomon.com joran',
    { name: 'joran', email: 'joran@ronomon.com' }
  ],
  [
    '-',
    undefined
  ],
  [
    ' \t \t- ',
    undefined
  ],
  [
    ' \t\'-\' \t ',
    undefined
  ]
];
tests.forEach(
  function(test) {
    var source = Buffer.from(test[0], 'ascii');
    var target = MIME.decodeHeaderAddressesAddress(source);
    Test.equal(target, test[1], namespace, JSON.stringify(test[0]));
  }
);
