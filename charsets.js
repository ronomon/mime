// We use this to generate a charset normalization table from iconv's charsets:
// `charsets.txt` is extracted from node-iconv's README.md.
var fs = require('fs');
var lines = fs.readFileSync('charsets.txt', 'utf-8').split(/\r\n|\n/);
var groups = {};
var group;
function expandCharset(charset, charsets) {
  if (/(experimental)/i.test(charset)) return;
  var open = charset.indexOf('{');
  if (open === -1) return pushCharset(charset, charsets);
  var prefix = charset.slice(0, open);
  var close = charset.indexOf('}');
  if (close !== charset.length - 1) {
    throw new Error('bad closing } position: ' + charset);
  }
  var suffixes = charset.slice(open + 1, close).replace(/\s/g, '');
  if (
    !/^(\d+,)+\d+$/.test(suffixes) &&
    !/^([a-z]+,)+[a-z]+$/i.test(suffixes)
  ) {
    throw new Error('bad suffixes: ' + charset);
  }
  suffixes.split(',').forEach(
    function(suffix) {
      pushCharset(prefix + suffix, charsets);
    }
  );
}
function pushCharset(charset, charsets) {
  charsets.push(charset);
}
function splitCharsets(line, charsets) {
  function push(charset) {
    charset = charset.trim();
    if (charset) expandCharset(charset, charsets);
  }
  var start = 0;
  var index = 0;
  var length = line.length;
  while (index < length) {
    var char = line[index];
    if (char === ',') {
      push(line.slice(start, index));
      index = start = index + 1;
    } else if (char === '{') {
      var close = line.indexOf('}', index + 1);
      if (close === -1) throw new Error('closing } not found: ' + line);
      push(line.slice(start, close + 1));
      index = start = close + 2;
    } else {
      index++;
    }
  }
  if (start < length) push(line.slice(start, length));
}
lines.forEach(
  function(line) {
    if (!line.trim()) return;
    if (/^\s/.test(line)) {
      if (!group) throw new Error('unknown group: ' + line);
      if (groups.hasOwnProperty(group)) {
        var charsets = groups[group];
      } else {
        var charsets = groups[group] = [];
      }
      splitCharsets(line.trim(), charsets);
    } else {
      group = line.trim();
    }
  }
);
var charsets = [];
for (var group in groups) {
  if (/Full Unicode, in terms of/i.test(group)) continue;
  if (/Locale dependent, in terms of/i.test(group)) continue;
  charsets = charsets.concat(groups[group]);
}
charsets.sort();
var canon = {};
for (var index = 0, length = charsets.length; index < length; index++) {
  var charset = charsets[index];
  var key = charset.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (canon.hasOwnProperty(key)) {
    throw new Error(
      'duplicate charset keys: ' + canon[key] + ' vs ' + charset
    );
  }
  canon[key] = charset;
}
// Outlook 2007 uses "automatic message encoding" and can get it wrong.
// Specifically, Microsoft uses "ks_c_5601-1987" as an alias for CP949 (Korean).
// See: http://docs.activestate.com/activeperl/5.8/lib/Encode/KR.html
canon['BKSC56011987'] = 'CP949';
canon['KSC56011987'] = 'CP949';
canon['UHC'] = 'CP949';
canon['WIN949'] = 'CP949';
canon['WINDOWS949'] = 'CP949';
canon['XUHC'] = 'CP949';
canon['XWIN949'] = 'CP949';
canon['XWINDOWS949'] = 'CP949';
// ANSI_X3.110-1983 is an ancient character set almost identical to ISO-8859-1:
canon['ANSIX31101983'] = 'ISO88591';
var string = '{\n';
Object.keys(canon).sort().forEach(
  function(key) {
    string += "  " + key + ": '" + canon[key] + "',\n";
  }
);
string = string.replace(/,(?=\n$)/, '');
string += '};';
console.log(string);
