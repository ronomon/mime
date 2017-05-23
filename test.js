var child = require('child_process');
var fs = require('fs');
var tests = fs.readdirSync('./tests').filter(
  function(test) {
    return /\.js$/i.test(test) && !/^_/.test(test);
  }
);
tests.forEach(
  function(test) {
    console.log('Running ' + test + '...');
    child.execSync('node ./tests/' + test, {
      stdio: ['inherit', 'inherit', 'inherit']
    });
  }
);
console.log('================');
console.log('PASSED ALL TESTS');
console.log('================');
