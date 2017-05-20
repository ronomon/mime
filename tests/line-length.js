var common = require('./_common.js');
var Test = common.Test;
var fs = require('fs');
var path = require('path');
var namespace = 'LineLength <= 80';
var root = path.resolve(path.dirname(module.filename), '..');
function checkfile(filename) {
  if (!/\.js$/i.test(filename)) return;
  var relative = path.relative(root, filename);
  var lines = fs.readFileSync(filename, 'utf-8').split('\n');
  lines.forEach(
    function(line) {
      if (line.length > 80) {
        if (/MIME\.decodeHeaderDateRegex/.test(line)) return;
        throw new Error(relative + ' > 80 at line: ' + line);
      }
    }
  );
  Test.equal(true, true, namespace, relative);
}
function checkdir(dirname) {
  var names = fs.readdirSync(dirname).sort();
  names.forEach(
    function(name) {
      checkfile(path.join(dirname, name));
    }
  );
}
checkdir(root);
checkdir(path.join(root, 'tests'));
