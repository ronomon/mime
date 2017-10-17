var Node = {
  net: require('net')
};

var MIME = {};

// REFERENCE SPECIFICATIONS:
//
// https://tools.ietf.org/html/rfc5322
// Internet Message Format
//
// https://tools.ietf.org/html/rfc5321
// Simple Mail Transfer Protocol
//
// https://tools.ietf.org/html/rfc822
// ARPA Internet Text Messages
//
// https://tools.ietf.org/html/rfc2045
// Multipurpose Internet Mail Extensions (MIME) Part One:
// Format of Internet Message Bodies
//
// https://tools.ietf.org/html/rfc2046
// Multipurpose Internet Mail Extensions (MIME) Part Two:
// Media Types
//
// https://tools.ietf.org/html/rfc2047
// MIME (Multipurpose Internet Mail Extensions) Part Three:
// Message Header Extensions for Non-ASCII Text
//
// https://tools.ietf.org/html/rfc2183
// The Content-Disposition Header Field
//
// https://tools.ietf.org/html/rfc2231
// MIME Parameter Value and Encoded Word Extensions:
// Character Sets, Languages, and Continuations
//
// https://tools.ietf.org/html/rfc3848
// ESMTP and LMTP Transmission Types Registration
//
// https://tools.ietf.org/html/rfc7103
// Advice for Safe Handling of Malformed Messages

MIME.ASCII = 1;
MIME.LOWERCASE = 2;
MIME.UPPERCASE = 4;
MIME.TRIM = 8;
MIME.FWS = Buffer.alloc(256);
MIME.FWS[9] = 1;
MIME.FWS[10] = 1;
MIME.FWS[13] = 1;
MIME.FWS[32] = 1;

MIME.ATEXT = (function() {
  // RFC 5322 3.2.3 Atom
  // atext           =   ALPHA / DIGIT /    ; Printable US-ASCII
  //                     "!" / "#" /        ; characters not including
  //                     "$" / "%" /        ; specials. Used for atoms.
  //                     "&" / "'" /
  //                     "*" / "+" /
  //                     "-" / "/" /
  //                     "=" / "?" /
  //                     "^" / "_" /
  //                     "`" / "{" /
  //                     "|" / "}" /
  //                     "~"
  // atom            =   [CFWS] 1*atext [CFWS]
  var table = Buffer.alloc(256);
  for (var index = 48; index <= 57; index++) table[index] = 1; // [0-9]
  for (var index = 65; index <= 90; index++) table[index] = 1; // [A-Z]
  for (var index = 97; index <= 122; index++) table[index] = 1; // [a-z]
  var map = "!#$%&'*+-/=?^_`{|}~";
  for (var index = 0, length = map.length; index < length; index++) {
    table[map.charCodeAt(index)] = 1;
  }
  return table;
})();

MIME.DTEXT = (function() {
  // RFC 5322 3.4.1 Addr-Spec Specification
  // dtext           =   %d33-90 /          ; Printable US-ASCII
  //                     %d94-126 /         ;  characters not including
  //                     obs-dtext          ;  "[", "]", or "\"
  var table = Buffer.alloc(256);
  for (var index = 33; index <= 90; index++) table[index] = 1;
  for (var index = 94; index <= 126; index++) table[index] = 1;
  return table;
})();

MIME.QTEXT = (function() {
  // RFC 5322 3.2.4 Quoted Strings
  // qtext           =   %d33 /             ; Printable US-ASCII
  //                     %d35-91 /          ;  characters not including
  //                     %d93-126 /         ;  "\" or the quote character
  //                     obs-qtext
  var table = Buffer.alloc(256);
  table[33] = 1;
  for (var index = 35; index <= 91; index++) table[index] = 1;
  for (var index = 93; index <= 126; index++) table[index] = 1;
  return table;
})();

MIME.decodeBase64 = function(buffer, body) {
  var self = this;
  try {
    return self.Base64.decode(buffer);
  } catch (error) {
    // RFC 2045 6.8 Base64 Content-Transfer-Encoding
    //
    // Any characters outside of the base64 alphabet are to be ignored in
    // base64-encoded data.

    // RFC 4648 3.3 Interpretation of Non-Alphabet Characters in Encoded Data
    //
    // Base encodings use a specific, reduced alphabet to encode binary
    // data.  Non-alphabet characters could exist within base-encoded data,
    // caused by data corruption or by design.  Non-alphabet characters may
    // be exploited as a "covert channel", where non-protocol data can be
    // sent for nefarious purposes.  Non-alphabet characters might also be
    // sent in order to exploit implementation errors leading to, e.g.,
    // buffer overflow attacks.
    //
    // Implementations MUST reject the encoded data if it contains
    // characters outside the base alphabet when interpreting base-encoded
    // data, unless the specification referring to this document explicitly
    // states otherwise.  Such specifications may instead state, as MIME
    // does, that characters outside the base encoding alphabet should
    // simply be ignored when interpreting data ("be liberal in what you
    // accept").  Note that this means that any adjacent carriage return/
    // line feed (CRLF) characters constitute "non-alphabet characters" and
    // are ignored.  Furthermore, such specifications MAY ignore the pad
    // character, "=", treating it as non-alphabet data, if it is present
    // before the end of the encoded data.  If more than the allowed number
    // of pad characters is found at the end of the string (e.g., a base 64
    // string terminated with "==="), the excess pad characters MAY also be
    // ignored.

    // Non-Spec: We reject illegal and truncated Base64.
    switch (error.message) {
      case 'source is corrupt':
        if (body) {
          throw new Error(self.Error.Base64BodyIllegal);
        } else {
          throw new Error(self.Error.Base64WordIllegal);
        }
        break;
      case 'source is truncated':
        if (body) {
          throw new Error(self.Error.Base64BodyTruncated);
        } else {
          throw new Error(self.Error.Base64WordTruncated);
        }
        break;
    }
    throw error;
  }
};

MIME.decodeBody = function(buffer, contentType, contentTransferEncoding) {
  var self = this;
  if (contentTransferEncoding) {
    // RFC 2045 6.2 Content-Transfer-Encodings Semantics
    // The Content-Transfer-Encoding values "7bit", "8bit", and "binary" all
    // mean that the identity (i.e. NO) encoding transformation has been
    // performed. As such, they serve simply as indicators of the domain of
    // the body data, and provide useful information about the sort of
    // encoding that might be needed for transmission in a given transport
    // system.

    // RFC 2045 6.4 Interpretation and Use
    // If an entity is of type "multipart" the Content-Transfer-Encoding is not
    // permitted to have any value other than "7bit", "8bit" or "binary".

    // RFC 2045 6.4 Interpretation and Use
    // Certain Content-Transfer-Encoding values may only be used on certain
    // media types. In particular, it is EXPRESSLY FORBIDDEN to use any
    // encodings other than "7bit", "8bit", or "binary" with any composite
    // media type, i.e. one that recursively includes other Content-Type
    // fields. Currently the only composite media types are "multipart" and
    // "message". All encodings that are desired for bodies of type
    // multipart or message must be done at the innermost level, by encoding
    // the actual body that needs to be encoded.

    // RFC 2045 6.4 Interpretation and Use
    // NOTE ON ENCODING RESTRICTIONS: Though the prohibition against using
    // content-transfer-encodings on composite body data may seem overly
    // restrictive, it is necessary to prevent nested encodings, in which
    // data are passed through an encoding algorithm multiple times, and
    // must be decoded multiple times in order to be properly viewed.
    // Nested encodings add considerable complexity to user agents: Aside
    // from the obvious efficiency problems with such multiple encodings,
    // they can obscure the basic structure of a message. In particular,
    // they can imply that several decoding operations are necessary simply
    // to find out what types of bodies a message contains. Banning nested
    // encodings may complicate the job of certain mail gateways, but this
    // seems less of a problem than the effect of nested encodings on user
    // agents.

    // RFC 5335 1.2 Relation to Other Standards
    // This document updates Section 6.4 of RFC 2045. It removes the
    // blanket ban on applying a content-transfer-encoding to all subtypes
    // of message/, and instead specifies that a composite subtype MAY
    // specify whether or not a content-transfer-encoding can be used for
    // that subtype, with "cannot be used" as the default.

    // For detail on these relaxations see RFC 6532 and RFC 6533.
    // We do not ban nested encodings as a result.

    if (contentTransferEncoding === 'base64') {
      // RFC 2045 6.8 Base64 Content-Transfer-Encoding
      // All line breaks or other characters not
      // found in Table 1 must be ignored by decoding software. In base64
      // data, characters other than those in Table 1, line breaks, and other
      // white space probably indicate a transmission error, about which a
      // warning message or even a message rejection might be appropriate
      // under some circumstances.
      buffer = self.decodeBase64(buffer, true);
    } else if (contentTransferEncoding === 'quoted-printable') {
      buffer = self.decodeQuotedPrintable(buffer, true);
    }
  }
  if (contentType.parameters.hasOwnProperty('charset')) {
    // RFC 2045 5 Content-Type Header Field
    // ...the "charset" parameter is applicable to any subtype of "text"...

    // RFC 2046 4.1 Text Media Type
    // A "charset" parameter may be used to
    // indicate the character set of the body text for "text" subtypes,
    // notably including the subtype "text/plain", which is a generic
    // subtype for plain text.

    // RFC 2046 4.1.2 Charset Parameter
    // A critical parameter that may be specified in the Content-Type field
    // for "text/plain" data is the character set.

    // RFC 2046 4.1.2 Charset Parameter
    // Other media types than subtypes of "text" might choose to employ the
    // charset parameter as defined here, but with the CRLF/line break
    // restriction removed.

    // We understand the above to mean that the charset parameter can in fact be
    // used by non-text media types e.g. application/json.
    buffer = self.decodeCharset(buffer, contentType.parameters.charset);
  }
  return buffer;
};

MIME.decodeCharset = function(source, charset) {
  var self = this;
  if (charset === undefined || charset === '') return source;
  if (typeof charset !== 'string') {
    throw new Error('charset must be a string');
  }
  if (charset.length > 24 || !/^[\s\x21-\x7E]+$/.test(charset)) {
    // Guard against malicious charsets being passed to iconv.
    // We allow whitespace and any printable character (33-126).
    throw new Error(self.Error.CharsetUnsupported);
  }
  var key = self.decodeCharsetKey(charset);
  if (self.decodeCharsetIdentity.hasOwnProperty(key)) return source;
  if (self.decodeCharsetCanon.hasOwnProperty(key)) {
    charset = self.decodeCharsetCanon[key];
  } else {
    var match = key.match(/^X?WIN(DOWS)?(\d+)$/);
    if (match) charset = 'WINDOWS-' + match[2];
  }
  try {
    var iconv = new self.Iconv(charset, 'UTF-8//TRANSLIT//IGNORE');
    var target = iconv.convert(source);
  } catch (error) {
    if (error.code === 'EILSEQ') {
      // Illegal character sequence.
      throw new Error(self.Error.CharsetIllegal);
    } else if (error.code === 'EINVAL') {
      // Incomplete character sequence.
      throw new Error(self.Error.CharsetTruncated);
    } else if (/^Conversion from /i.test(error.message)) {
      // Encoding not supported.
      throw new Error(self.Error.CharsetUnsupported);
    } else {
      // Unexpected error.
      throw error;
    }
  }
  return target;
};

MIME.decodeCharsetCanon = {
  ANSIX31101983: 'ISO88591',
  ARMSCII8: 'ARMSCII-8',
  ASCII: 'ASCII',
  ATARIST: 'ATARIST',
  BIG5: 'BIG5',
  BIG5HKSCS: 'BIG5-HKSCS',
  BIG5HKSCS1999: 'BIG5-HKSCS:1999',
  BIG5HKSCS2001: 'BIG5-HKSCS:2001',
  BIG5HKSCS2004: 'BIG5-HKSCS:2004',
  BKSC56011987: 'CP949',
  C99: 'C99',
  CP1125: 'CP1125',
  CP1133: 'CP1133',
  CP1250: 'CP1250',
  CP1251: 'CP1251',
  CP1252: 'CP1252',
  CP1253: 'CP1253',
  CP1254: 'CP1254',
  CP1255: 'CP1255',
  CP1256: 'CP1256',
  CP1257: 'CP1257',
  CP1258: 'CP1258',
  CP437: 'CP437',
  CP737: 'CP737',
  CP775: 'CP775',
  CP850: 'CP850',
  CP852: 'CP852',
  CP853: 'CP853',
  CP855: 'CP855',
  CP857: 'CP857',
  CP858: 'CP858',
  CP860: 'CP860',
  CP861: 'CP861',
  CP862: 'CP862',
  CP863: 'CP863',
  CP864: 'CP864',
  CP865: 'CP865',
  CP866: 'CP866',
  CP869: 'CP869',
  CP874: 'CP874',
  CP932: 'CP932',
  CP936: 'CP936',
  CP949: 'CP949',
  CP950: 'CP950',
  EUCCN: 'EUC-CN',
  EUCJISX0213: 'EUC-JISX0213',
  EUCJP: 'EUC-JP',
  EUCKR: 'EUC-KR',
  EUCTW: 'EUC-TW',
  GB18030: 'GB18030',
  GBK: 'GBK',
  GEORGIANACADEMY: 'Georgian-Academy',
  GEORGIANPS: 'Georgian-PS',
  HPROMAN8: 'HP-ROMAN8',
  HZ: 'HZ',
  ISO2022CN: 'ISO-2022-CN',
  ISO2022CNEXT: 'ISO-2022-CN-EXT',
  ISO2022JP: 'ISO-2022-JP',
  ISO2022JP1: 'ISO-2022-JP-1',
  ISO2022JP2: 'ISO-2022-JP-2',
  ISO2022JP3: 'ISO-2022-JP-3',
  ISO2022KR: 'ISO-2022-KR',
  ISO88591: 'ISO-8859-1',
  ISO885910: 'ISO-8859-10',
  ISO885911: 'ISO-8859-11',
  ISO885913: 'ISO-8859-13',
  ISO885914: 'ISO-8859-14',
  ISO885915: 'ISO-8859-15',
  ISO885916: 'ISO-8859-16',
  ISO88592: 'ISO-8859-2',
  ISO88593: 'ISO-8859-3',
  ISO88594: 'ISO-8859-4',
  ISO88595: 'ISO-8859-5',
  ISO88596: 'ISO-8859-6',
  ISO88597: 'ISO-8859-7',
  ISO88598: 'ISO-8859-8',
  ISO88599: 'ISO-8859-9',
  JAVA: 'JAVA',
  JOHAB: 'JOHAB',
  KOI8R: 'KOI8-R',
  KOI8RU: 'KOI8-RU',
  KOI8T: 'KOI8-T',
  KOI8U: 'KOI8-U',
  KSC56011987: 'CP949',
  MACARABIC: 'MacArabic',
  MACCENTRALEUROPE: 'MacCentralEurope',
  MACCROATIAN: 'MacCroatian',
  MACCYRILLIC: 'MacCyrillic',
  MACGREEK: 'MacGreek',
  MACHEBREW: 'MacHebrew',
  MACICELAND: 'MacIceland',
  MACINTOSH: 'Macintosh',
  MACROMAN: 'MacRoman',
  MACROMANIA: 'MacRomania',
  MACTHAI: 'MacThai',
  MACTURKISH: 'MacTurkish',
  MACUKRAINE: 'MacUkraine',
  MULELAO1: 'MuleLao-1',
  NEXTSTEP: 'NEXTSTEP',
  PT154: 'PT154',
  RISCOSLATIN1: 'RISCOS-LATIN1',
  RK1048: 'RK1048',
  SHIFTJIS: 'SHIFT_JIS',
  SHIFTJISX0213: 'Shift_JISX0213',
  TCVN: 'TCVN',
  TDS565: 'TDS565',
  TIS620: 'TIS-620',
  UCS2: 'UCS-2',
  UCS2BE: 'UCS-2BE',
  UCS2LE: 'UCS-2LE',
  UCS4: 'UCS-4',
  UCS4BE: 'UCS-4BE',
  UCS4LE: 'UCS-4LE',
  UHC: 'CP949',
  UTF16: 'UTF-16',
  UTF16BE: 'UTF-16BE',
  UTF16LE: 'UTF-16LE',
  UTF32: 'UTF-32',
  UTF32BE: 'UTF-32BE',
  UTF32LE: 'UTF-32LE',
  UTF7: 'UTF-7',
  UTF8: 'UTF-8',
  VISCII: 'VISCII',
  WIN949: 'CP949',
  WINDOWS949: 'CP949',
  XUHC: 'CP949',
  XWIN949: 'CP949',
  XWINDOWS949: 'CP949'
};

MIME.decodeCharsetIdentity = {
  ASCII: true,
  BINARY: true,
  USASCII: true,
  UTF8: true
};

MIME.decodeCharsetKey = function(charset) {
  var self = this;
  return charset.toUpperCase().replace(/[^A-Z0-9]/g, '');
};

MIME.decodeEntity = function(buffer) {
  var self = this;
  // An adversary can submit a few megabytes of data without any headers.
  // We want to limit the amount of time we spend searching for the delimiters.
  // We allow a limit of 256 KB (Exchange has 64 KB, Sendmail has 32 KB).
  // Some folded header lines (together more than 1000 characters) may have many
  // addresses and we want to allow these.

  // We have seen instances of headers joined to the body with only a single
  // CRLF followed immediately by a multipart opening boundary. While we could
  // detect the "--" as the start of the body, this would lead to multiple
  // renderings among clients, i.e. some clients would treat the first part as a
  // preamble instead.
  var limit = 262144;
  var index = 0;
  var length = Math.min(limit, buffer.length);
  while (index < length) {
    if (buffer[index] === 13) {
      if (
        index + 3 < length &&
        buffer[index + 1] === 10 &&
        buffer[index + 2] === 13 &&
        buffer[index + 3] === 10
      ) {
        return [ buffer.slice(0, index), buffer.slice(index + 4) ];
      }
    } else if (buffer[index] === 10) {
      if (index + 1 < length && buffer[index + 1] === 10) {
        return [ buffer.slice(0, index), buffer.slice(index + 2) ];
      }
    }
    index++;
  }
  if (index >= limit) {
    throw new Error(self.Error.HeadersLimit);
  }
  if (length >= 2 && buffer[length - 2] === 13 && buffer[length - 1] === 10) {
    // Message ends with a single CRLF and only has headers.
    return [ buffer.slice(0, length - 2), buffer.slice(length) ];
  }
  if (length >= 1 && buffer[length - 1] === 10) {
    // Message ends with a single LF and only has headers.
    return [ buffer.slice(0, length - 1), buffer.slice(length) ];
  }
  throw new Error(self.Error.HeadersCRLF);
};

MIME.decodeHeaderAddresses = function(buffer) {
  var self = this;
  var header = [];
  buffer = self.decodeHeaderBuffer(buffer, true);
  if (!buffer) return header;
  buffer = self.decodeHeaderUnfold(buffer);
  buffer = self.decodeHeaderRemoveComments(buffer);
  var addresses = self.decodeHeaderSplitOutsideQuotes(
    buffer,
    0,
    buffer.length,
    self.decodeHeaderAddressesSeparators
  );
  for (var index = 0, length = addresses.length; index < length; index++) {
    var address = self.decodeHeaderAddressesAddress(addresses[index]);
    if (address) header.push(address);
  }
  return header;
};

MIME.decodeHeaderAddressesSeparators = Buffer.alloc(256);
MIME.decodeHeaderAddressesSeparators[44] = 1; // ','
MIME.decodeHeaderAddressesSeparators[59] = 1; // ';'
MIME.decodeHeaderAddressesSeparators[58] = 255; // ':'

MIME.decodeHeaderAddressesAddress = function(buffer) {
  var self = this;
  buffer = self.decodeHeaderAngleBrackets(buffer);
  var parts = self.decodeHeaderSplitOutsideQuotes(
    buffer,
    0,
    buffer.length,
    self.decodeHeaderAddressesAddressSeparators
  );
  if (parts.length === 0) return;
  // Find part containing email (regardless of display-name and addr order):
  var max = parts.length - 1;
  var scores = new Uint8Array(parts.length);
  for (var index = 0, length = parts.length; index < length; index++) {
    var part = parts[index];
    // At its meeting on 13 August 2013, the ICANN Board New gTLD Program
    // Committee (NGPC) adopted a resolution affirming that
    // "dotless domain names" are prohibited. Dotless domain names are those
    // that consist of a single label (e.g., http://example, or mail@example).
    // See: https://www.icann.org/news/announcement-2013-08-30-en

    // We therefore score part if part has at least an '@' followed by a '.':
    var index64 = self.indexOf(part, 0, part.length, 64); // '@'
    if (index64 >= 1) {
      var index46 = self.indexOf(part, index64, part.length, 46); // '.'
      if (index46 >= index64 + 2) {
        scores[index] += 2;
        // We use >= to prefer parts to the right:
        if (scores[index] >= scores[max]) max = index;
      }
    }
  }
  var email = '';
  if (scores[max] > 0) {
    email = self.decodeHeaderQuotedStrings(parts[max]).toString('ascii');
    // Non-Spec: Remove all whitespace (including around '@'):
    email = email.replace(/\s+/g, '');
    // Remove any angle brackets (those shielded by quoted strings):
    email = email.replace(/^<+|>+$/g, '');
    // Non-Spec: Remove multiple balanced single quotes:
    while (/^'.*'$/.test(email)) email = email.slice(1, -1);
    // Ensure that local-part exists:
    if (email.indexOf('@') > 0) {
      parts.splice(max, 1);
    } else {
      email = '';
    }
  }
  var nameBuffers = [];
  for (var index = 0, length = parts.length; index < length; index++) {
    var part = parts[index];
    if ((part = self.decodeHeaderQuotedStrings(part)).length > 0) {
      // RFC 5322 3.2.2 Folding White Space and Comments
      // Runs of FWS, comment or CFWS that occur between lexical tokens in a
      // structured field header are semantically interpreted as a single
      // space character.
      if (nameBuffers.length > 0) {
        nameBuffers.push(self.decodeHeaderAddressesAddressSpace);
      }
      nameBuffers.push(part);
    }
  }
  // Non-Spec: We decode any encoded words found in quoted-strings.
  var nameBuffer = Buffer.concat(nameBuffers);
  var name = self.decodeHeaderEncodedWords(nameBuffer).toString('utf-8');
  // Non-Spec: Remove single quotes sometimes added by Outlook:
  if (/^'.*'$/.test(name)) name = name.slice(1, -1).trim();
  // Non-Spec: Remove whitespace from name if name is otherwise empty:
  if (/^\s+$/.test(name)) name = '';
  // Do not add an empty name and empty email to the addresses list:
  if (name.length === 0 && email.length === 0) return;
  if (email.length === 0 && /^[^A-Z0-9]$/i.test(name)) return;
  return new self.Address(name, email);
};

MIME.decodeHeaderAddressesAddressSeparators = Buffer.alloc(256);
// We split on WSP in case display-name exists but addr has no angle brackets:
MIME.decodeHeaderAddressesAddressSeparators[9] = 1; // '\t'
MIME.decodeHeaderAddressesAddressSeparators[32] = 1; // ' '
// We split on angle brackets in case there is no WSP between tokens:
MIME.decodeHeaderAddressesAddressSeparators[60] = 1; // '<'
MIME.decodeHeaderAddressesAddressSeparators[62] = 1; // '>'

MIME.decodeHeaderAddressesAddressSpace = Buffer.from([32]);

MIME.decodeHeaderAngleBrackets = function(source) {
  var self = this;
  // Remove any spaces in tokens surrounded by angle brackets.
  // Ignore angle brackets in quoted-strings.
  var range = new Array(2);
  range[0] = 0;
  range[1] = 0;
  var target;
  var targetIndex = 0;
  var sourceIndex = 0;
  var sourceLength = source.length;
  while (sourceIndex < sourceLength) {
    var match = self.decodeHeaderAngleBracketsMatch(
      source,
      sourceIndex,
      sourceLength,
      range
    );
    if (!match) break;
    var matchIndex = match[0];
    var matchLength = match[1];
    if (target) {
      targetIndex += source.copy(target, targetIndex, sourceIndex, matchIndex);
    }
    while (matchIndex < matchLength) {
      if (source[matchIndex] === 9 || source[matchIndex] === 32) {
        if (!target) {
          target = Buffer.alloc(sourceLength);
          targetIndex += source.copy(target, targetIndex, 0, matchIndex);
        }
      } else if (target) {
        target[targetIndex++] = source[matchIndex];
      }
      matchIndex++;
    }
    sourceIndex = matchLength;
  }
  if (target) {
    targetIndex += source.copy(target, targetIndex, sourceIndex, sourceLength);
    return target.slice(0, targetIndex);
  } else {
    return source;
  }
};

MIME.decodeHeaderAngleBracketsMatch = function(
  source,
  sourceIndex,
  sourceLength,
  range
) {
  var self = this;
  var opening = self.indexOutsideQuotes(source, sourceIndex, sourceLength, 60);
  if (opening === -1) return;
  var index = opening + 1;
  while (index < sourceLength) {
    if (source[index] === 62) {
      range[0] = opening;
      range[1] = index + 1;
      return range;
    } else if (source[index] === 60) {
      opening = index;
    } else if (!self.decodeHeaderAngleBracketsMatchTable[source[index]]) {
      return;
    }
    index++;
  }
};

MIME.decodeHeaderAngleBracketsMatchTable = (function() {
  // RFC 5322 3.2.3 Atom
  // atext           =   ALPHA / DIGIT /    ; Printable US-ASCII
  //                     "!" / "#" /        ;  characters not including
  //                     "$" / "%" /        ;  specials.  Used for atoms.
  //                     "&" / "'" /
  //                     "*" / "+" /
  //                     "-" / "/" /
  //                     "=" / "?" /
  //                     "^" / "_" /
  //                     "`" / "{" /
  //                     "|" / "}" /
  //                     "~"
  // atom            =   [CFWS] 1*atext [CFWS]
  // dot-atom-text   =   1*atext *("." 1*atext)
  // dot-atom        =   [CFWS] dot-atom-text [CFWS]
  var table = Buffer.alloc(256);
  for (var index = 48; index <= 57; index++) table[index] = 1; // [0-9]
  for (var index = 65; index <= 90; index++) table[index] = 1; // [A-Z]
  for (var index = 97; index <= 122; index++) table[index] = 1; // [a-z]
  var map = "!#$%&'*+-/=?^_`{|}~.";
  for (var index = 0, length = map.length; index < length; index++) {
    table[map.charCodeAt(index)] = 1;
  }
  table[9] = 1;
  table[32] = 1;
  table['@'.charCodeAt(0)] = 1;
  return table;
})();

MIME.decodeHeaderBuffer = function(buffer, addresses) {
  var self = this;
  if (buffer === undefined) {
    return undefined;
  } else if (Array.isArray(buffer)) {
    if (buffer.length === 0) return undefined;
    for (var index = 0, length = buffer.length; index < length; index++) {
      if (!Buffer.isBuffer(buffer[index])) {
        throw new Error('buffer must be a buffer');
      }
    }
    // RFC 5322 4.5 Obsolete Header Fields
    // Except for destination address fields (described in section 4.5.3),
    // the interpretation of multiple occurrences of fields is unspecified.
    //
    // RFC 5322 4.5.3 Obsolete Destination Address Fields
    // When multiple occurrences of destination address fields occur in a
    // message, they SHOULD be treated as if the address list in the first
    // occurrence of the field is combined with the address lists of the
    // subsequent occurrences by adding a comma and concatenating.
    if (addresses) {
      var buffers = [];
      for (var index = 0, length = buffer.length; index < length; index++) {
        buffers.push(buffer[index]);
        if (index < length - 1) buffers.push(self.decodeHeaderBufferComma);
      }
      return Buffer.concat(buffers);
    } else {
      return buffer[0];
    }
  } else if (Buffer.isBuffer(buffer)) {
    return buffer;
  } else {
    throw new Error('buffer must be a buffer or an array of buffers');
  }
};

MIME.decodeHeaderBufferComma = Buffer.from(',');

MIME.decodeHeaderContentDisposition = function(buffer) {
  var self = this;
  buffer = self.decodeHeaderBuffer(buffer, false);
  if (!buffer) return new self.HeaderValueParameters('', {});
  var header = self.decodeHeaderValueParameters(
    self.decodeHeaderRemoveComments(
      self.decodeHeaderUnfold(buffer)
    )
  );
  return header;
};

MIME.decodeHeaderContentTransferEncoding = function(buffer) {
  var self = this;
  // RFC 2045 6.1 Content-Transfer-Encoding Syntax
  //
  // The Content-Transfer-Encoding field's value is a single token
  // specifying the type of encoding, as enumerated below.  Formally:
  //
  // encoding := "Content-Transfer-Encoding" ":" mechanism
  //
  // mechanism := "7bit" / "8bit" / "binary" /
  //             "quoted-printable" / "base64" /
  //             ietf-token / x-token
  //
  // These values are not case sensitive -- Base64 and BASE64 and bAsE64
  // are all equivalent.
  buffer = self.decodeHeaderBuffer(buffer, false);
  if (!buffer) return '';
  buffer = self.decodeHeaderRemoveComments(self.decodeHeaderUnfold(buffer));
  var mechanism = self.slice(
    buffer,
    0,
    buffer.length,
    self.TRIM | self.LOWERCASE | self.ASCII
  );
  if (/^".*"$/.test(mechanism)) mechanism = mechanism.slice(1, -1).trim();
  if (mechanism.length === 0) return '';
  if (mechanism === '7-bit') {
    mechanism = '7bit';
  } else if (mechanism === '8-bit') {
    mechanism = '8bit';
  } else if (mechanism === 'base-64') {
    mechanism = 'base64';
  } else if (mechanism === 'quotedprintable') {
    mechanism = 'quoted-printable';
  }
  // RFC 2045 6.4 Interpretation and Use
  // Any entity with an unrecognized Content-Transfer-Encoding must be
  // treated as if it has a Content-Type of "application/octet-stream",
  // regardless of what the Content-Type header field actually says.

  // Non-Spec: We rather raise an exception for unknown mechanisms:
  if (!/(7bit|8bit|binary|base64|quoted-printable)/.test(mechanism)) {
    throw new Error(self.Error.ContentTransferEncodingUnrecognized);
  }
  return mechanism;
};

MIME.decodeHeaderContentType = function(buffer) {
  var self = this;
  buffer = self.decodeHeaderBuffer(buffer, false);
  if (!buffer) {
    // RFC 2045 5.2 Content-Type Defaults
    //
    // Default RFC 822 messages without a MIME Content-Type header are taken
    // by this protocol to be plain text in the US-ASCII character set,
    // which can be explicitly specified as:
    //
    // Content-type: text/plain; charset=us-ascii
    //
    // This default is assumed if no Content-Type header field is specified.
    // It is also recommend that this default be assumed when a
    // syntactically invalid Content-Type header field is encountered. In
    // the presence of a MIME-Version header field and the absence of any
    // Content-Type header field, a receiving User Agent can also assume
    // that plain US-ASCII text was the sender's intent. Plain US-ASCII
    // text may still be assumed in the absence of a MIME-Version or the
    // presence of an syntactically invalid Content-Type header field, but
    // the sender's intent might have been otherwise.
    buffer = Buffer.from('text/plain;charset=us-ascii');
  }
  var header = self.decodeHeaderValueParameters(
    self.decodeHeaderRemoveComments(
      self.decodeHeaderUnfold(buffer)
    )
  );
  if (!/^\S+\/\S+$/.test(header.value)) {
    throw new Error(self.Error.ContentType);
  }
  if (/^message\/external-body$/i.test(header.value)) {
    // Presents several security risks.
    // https://technet.microsoft.com/en-us/library/hh547013(v=exchg.141).aspx
    throw new Error(self.Error.ContentTypeExternalBody);
  } else if (/^message\/partial$/i.test(header.value)) {
    // Prevent anti-virus from being defeated by split attachment content.
    // https://technet.microsoft.com/en-us/library/hh547013(v=exchg.141).aspx
    throw new Error(self.Error.ContentTypePartial);
  }
  if (/^multipart\//i.test(header.value)) {
    // RFC 2045 5 Content-Type Header Field
    // ...the "boundary" parameter is required for any subtype of
    // the "multipart" media type.
    if (!header.parameters.hasOwnProperty('boundary')) {
      throw new Error(self.Error.ContentTypeBoundaryMissing);
    }
  }
  return header;
};

MIME.decodeHeaderDate = function(buffer) {
  var self = this;
  buffer = self.decodeHeaderBuffer(buffer, false);
  if (!buffer) return undefined;
  buffer = self.decodeHeaderUnfold(buffer);
  buffer = self.decodeHeaderRemoveComments(buffer);
  var string = self.slice(
    buffer,
    0,
    buffer.length,
    self.TRIM | self.UPPERCASE | self.ASCII
  );
  var match = string.match(self.decodeHeaderDateRegex);
  if (!match) throw new Error(self.Error.Date);
  var dayname = match[1] || '';
  var day = parseInt(match[2], 10);
  if (self.decodeHeaderDateMonth.hasOwnProperty(match[3])) {
    var month = self.decodeHeaderDateMonth[match[3]];
  } else {
    throw new Error(self.Error.DateMonth);
  }
  // RFC 5322 4.3 Obsolete Date and Time
  // Where a two or three digit year occurs in a date, the year is to be
  // interpreted as follows: If a two digit year is encountered whose
  // value is between 00 and 49, the year is interpreted by adding 2000,
  // ending up with a value between 2000 and 2049.  If a two digit year is
  // encountered with a value between 50 and 99, or any three digit year
  // is encountered, the year is interpreted by adding 1900.
  var year = parseInt(match[4], 10);
  if (match[4].length === 2) {
    year += (year < 50) ? 2000 : 1900;
  } else if (match[4].length === 3) {
    year += 1900;
  }
  var hour = parseInt(match[5], 10);
  var minute = parseInt(match[6], 10);
  var second = parseInt((match[7] || '0').replace(/:/, ''), 10);
  // RFC 5322 3.3 Date and Time Specification
  // The form "+0000" SHOULD be used to indicate a time zone at
  // Universal Time.

  // Some BlackBerry clients (e.g. version 10.0.10.738) do not supply the zone.
  // The date-time they provide is in UTC.

  // Non-Spec: We accept a missing time zone and assume UTC.
  var zone = (match[8] || '').replace(/\s/g, '') || '+0000';
  if (/^[A-Z]+$/.test(zone)) {
    if (self.decodeHeaderDateZones.hasOwnProperty(zone)) {
      zone = self.decodeHeaderDateZones[zone];
    } else {
      throw new Error(self.Error.DateZone);
    }
  }
  while (zone.length < 5) zone += '0';
  var zoneHour = parseInt(zone.slice(1, 3), 10);
  var zoneMinute = parseInt(zone.slice(-2), 10);
  // RFC 5322 3.3 Date and Time Specification
  // A date-time specification MUST be semantically valid.  That is, the
  // day-of-week (if included) MUST be the day implied by the date, the
  // numeric day-of-month MUST be between 1 and the number of days allowed
  // for the specified month (in the specified year), the time-of-day MUST
  // be in the range 00:00:00 through 23:59:60 (the number of seconds
  // allowing for a leap second; see [RFC1305]), and the last two digits
  // of the zone MUST be within the range 00 through 59.
  if (day === 0 || day > 31) throw new Error(self.Error.DateDay);
  if (month === 0 || month > 12) throw new Error(self.Error.DateMonth);
  if (hour > 23) throw new Error(self.Error.DateHour);
  if (minute > 59) throw new Error(self.Error.DateMinute);
  if (second > 60) throw new Error(self.Error.DateSecond);
  if (zoneHour > 23) throw new Error(self.Error.DateZone);
  if (zoneMinute > 59) throw new Error(self.Error.DateZone);
  // RFC 5322 3.3 Date and Time Specification
  // The date and time-of-day SHOULD express local time.

  // The variables we have express local time (ahead or behind) UTC.
  // Date.UTC() uses universal time instead of the local time.
  // If the local date-time we provide to Date.UTC() is ahead of UTC, Date.UTC()
  // will return a timestamp ahead of UTC. We should subtract the zone offset.
  // If the local date-time we provide to Date.UTC() is behind UTC, Date.UTC()
  // will return a timestamp behind UTC. We should add the zone offset.
  var offset = ((zoneHour * 60) + zoneMinute) * 60 * 1000;
  var timestamp = Date.UTC(year, month - 1, day, hour, minute, second);
  if (zone[0] === '+') {
    timestamp -= offset;
  } else {
    timestamp += offset;
  }
  return timestamp;
};

MIME.decodeHeaderDateMonth = {
  JAN: 1,
  FEB: 2,
  MAR: 3,
  APR: 4,
  MAY: 5,
  JUN: 6,
  JUL: 7,
  AUG: 8,
  SEP: 9,
  OCT: 10,
  NOV: 11,
  DEC: 12
};

MIME.decodeHeaderDateRegex = /^(MON|TUE|WED|THU|FRI|SAT|SUN)?\s*,?\s*(\d{1,2})\s*(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)\s*(\d{2,4})\s+(\d{1,2}):(\d{1,2})(:\d{1,2})?\s*([+-]\s*\d{2,4}|[A-Z]{1,5})?\s*$/;

MIME.decodeHeaderDateZones = {
  ACDT: '+1030',
  ACST: '+0930',
  ACT: '+0800',
  ADT: '-0300',
  AEDT: '+1100',
  AEST: '+1000',
  AFT: '+0430',
  AKDT: '-0800',
  AKST: '-0900',
  AMST: '-0300',
  AMT: '+0400',
  ART: '-0300',
  AST: '+0300',
  AWDT: '+0900',
  AWST: '+0800',
  AZOST: '-0100',
  AZT: '+0400',
  BDT: '+0800',
  BIOT: '+0600',
  BIT: '-1200',
  BOT: '-0400',
  BRT: '-0300',
  BST: '+0600',
  BTT: '+0600',
  CAT: '+0200',
  CCT: '+0630',
  CDT: '-0500',
  CEDT: '+0200',
  CEST: '+0200',
  CET: '+0100',
  CHADT: '+1345',
  CHAST: '+1245',
  CHOT: '+0800',
  CHST: '+1000',
  CHUT: '+1000',
  CIST: '-0800',
  CIT: '+0800',
  CKT: '-1000',
  CLST: '-0300',
  CLT: '-0400',
  COST: '-0400',
  COT: '-0500',
  CST: '-0600',
  CT: '+0800',
  CVT: '-0100',
  CWST: '+0845',
  CXT: '+0700',
  DAVT: '+0700',
  DDUT: '+1000',
  DFT: '+0100',
  EASST: '-0500',
  EAST: '-0600',
  EAT: '+0300',
  ECT: '-0500',
  EDT: '-0400',
  EEDT: '+0300',
  EEST: '+0300',
  EET: '+0200',
  EGST: '+0000',
  EGT: '-0100',
  EIT: '+0900',
  EST: '-0500',
  FET: '+0300',
  FJT: '+1200',
  FKST: '-0300',
  FKT: '-0400',
  FNT: '-0200',
  GALT: '-0600',
  GAMT: '-0900',
  GET: '+0400',
  GFT: '-0300',
  GILT: '+1200',
  GIT: '-0900',
  GMT: '+0000',
  GST: '+0400',
  GYT: '-0400',
  HADT: '-0900',
  HAEC: '+0200',
  HAST: '-1000',
  HKT: '+0800',
  HMT: '+0500',
  HOVT: '+0700',
  HST: '-1000',
  ICT: '+0700',
  IDT: '+0300',
  IOT: '+0300',
  IRDT: '+0430',
  IRKT: '+0900',
  IRST: '+0330',
  IST: '+0530',
  JST: '+0900',
  KGT: '+0600',
  KOST: '+1100',
  KRAT: '+0700',
  KST: '+0900',
  LHST: '+1030',
  LINT: '+1400',
  MAGT: '+1200',
  MART: '-0930',
  MAWT: '+0500',
  MDT: '-0600',
  MET: '+0100',
  MEST: '+0200',
  MHT: '+1200',
  MIST: '+1100',
  MIT: '-0930',
  MMT: '+0630',
  MSK: '+0400',
  MST: '-0700',
  MUT: '+0400',
  MVT: '+0500',
  MYT: '+0800',
  NCT: '+1100',
  NDT: '-0230',
  NFT: '+1130',
  NPT: '+0545',
  NST: '-0330',
  NT: '-0330',
  NUT: '-1100',
  NZDT: '+1300',
  NZST: '+1200',
  OMST: '+0700',
  ORAT: '+0500',
  PDT: '-0700',
  PET: '-0500',
  PETT: '+1200',
  PGT: '+1000',
  PHOT: '+1300',
  PHT: '+0800',
  PKT: '+0500',
  PMDT: '-0200',
  PMST: '-0300',
  PONT: '+1100',
  PST: '-0800',
  PYST: '-0300',
  PYT: '-0400',
  RET: '+0400',
  ROTT: '-0300',
  SAKT: '+1100',
  SAMT: '+0400',
  SAST: '+0200',
  SBT: '+1100',
  SCT: '+0400',
  SGT: '+0800',
  SLST: '+0530',
  SRT: '-0300',
  SST: '+0800',
  SYOT: '+0300',
  TAHT: '-1000',
  THA: '+0700',
  TFT: '+0500',
  TJT: '+0500',
  TKT: '+1300',
  TLT: '+0900',
  TMT: '+0500',
  TOT: '+1300',
  TVT: '+1200',
  UCT: '+0000',
  ULAT: '+0800',
  UT: '+0000',
  UTC: '+0000',
  UYST: '-0200',
  UYT: '-0300',
  UZT: '+0500',
  VET: '-0430',
  VLAT: '+1000',
  VOLT: '+0400',
  VOST: '+0600',
  VUT: '+1100',
  WAKT: '+1200',
  WAST: '+0200',
  WAT: '+0100',
  WEDT: '+0100',
  WEST: '+0100',
  WET: '+0000',
  WST: '+0800',
  YAKT: '+1000',
  YEKT: '+0600'
};

MIME.decodeHeaderEncodedWord = function(source) {
  var self = this;
  // RFC 2047 2 Syntax of encoded-words
  //
  // An 'encoded-word' is defined by the following ABNF grammar.  The
  // notation of RFC 822 is used, with the exception that white space
  // characters MUST NOT appear between components of an 'encoded-word'.
  //
  // encoded-word = "=?" charset "?" encoding "?" encoded-text "?="
  //
  // charset = token    ; see section 3
  //
  // encoding = token   ; see section 4
  //
  // token = 1*<Any CHAR except SPACE, CTLs, and especials>
  //
  // especials = "(" / ")" / "<" / ">" / "@" / "," / ";" / ":" / "\"
  //            <"> / "/" / "[" / "]" / "?" / "." / "="
  //
  // encoded-text = 1*<Any printable ASCII character other than "?"
  //                  or SPACE>
  //               ; (but see "Use of encoded-words in message
  //               ; headers", section 5)
  //
  // Both 'encoding' and 'charset' names are case-independent.  Thus the
  // charset name "ISO-8859-1" is equivalent to "iso-8859-1", and the
  // encoding named "Q" may be spelled either "Q" or "q".

  // RFC 822:
  // CHAR        =  <any ASCII character>        ; (  0-177,  0.-127.)
  // SPACE       =  <ASCII SP, space>            ; (     40,      32.)
  // CTL         =  <any ASCII control           ; (  0- 37,  0.- 31.)
  //                 character and DEL>          ; (    177,     127.)
  // [...]printable ASCII characters
  // (i.e., characters that  have  values  between  33.  and  126.,
  // decimal, except colon)

  // RFC 2047 5 Use of encoded-words in message headers
  //
  // An 'encoded-word' may appear in a message header or body part header
  // according to the following rules:
  //
  // (1) An 'encoded-word' may replace a 'text' token (as defined by RFC 822)
  //     in any Subject or Comments header field, any extension message
  //     header field, or any MIME body part field for which the field body
  //     is defined as '*text'.  An 'encoded-word' may also appear in any
  //     user-defined ("X-") message or body part header field.
  //
  //     Ordinary ASCII text and 'encoded-word's may appear together in the
  //     same header field.  However, an 'encoded-word' that appears in a
  //     header field defined as '*text' MUST be separated from any adjacent
  //     'encoded-word' or 'text' by 'linear-white-space'.
  //
  // (2) An 'encoded-word' may appear within a 'comment...
  //
  // (3) As a replacement for a 'word' entity within a 'phrase', for example,
  //     one that precedes an address in a From, To, or Cc header.  The ABNF
  //     definition for 'phrase' from RFC 822 thus becomes:
  //
  //     phrase = 1*( encoded-word / word )
  //
  //     In this case the set of characters that may be used in a "Q"-encoded
  //     'encoded-word' is restricted to: <upper and lower case ASCII
  //     letters, decimal digits, "!", "*", "+", "-", "/", "=", and "_"
  //     (underscore, ASCII 95.)>.  An 'encoded-word' that appears within a
  //     'phrase' MUST be separated from any adjacent 'word', 'text' or
  //     'special' by 'linear-white-space'.
  //
  // These are the ONLY locations where an 'encoded-word' may appear. In
  // particular:
  //
  // + An 'encoded-word' MUST NOT appear in any portion of an 'addr-spec'.
  //
  // + An 'encoded-word' MUST NOT appear within a 'quoted-string'.

  // Non-Spec: We support white space between components of an encoded-word.
  var minimum = 6; // '=????='
  var sourceLength = source.length;
  if (
    sourceLength < minimum ||
    source[0] !== 61 || // '='
    source[1] !== 63 || // '?'
    source[sourceLength - 1] !== 61 || // '='
    source[sourceLength - 2] !== 63    // '?'
  ) {
    return source;
  }
  var indexEncoding = self.indexOf(source, 2, sourceLength, 63); // '?'
  if (indexEncoding === -1 || indexEncoding === sourceLength - 2 - 1) {
    // Do not match second-last or last '?'.
    return source;
  }
  var indexEncodedText = self.indexOf(
    source,
    indexEncoding + 1,
    sourceLength,
    63 // '?'
  );
  if (indexEncodedText === -1 || indexEncodedText === sourceLength - 2) {
    // Do not match last '?'.
    return source;
  }
  var indexEnd = self.indexOf(
    source,
    indexEncodedText + 1,
    sourceLength,
    63 // '?'
  );
  if (indexEnd === -1) return source;
  var charset = self.slice(
    source,
    2,
    indexEncoding,
    self.TRIM | self.LOWERCASE | self.ASCII
  );
  var asterisk = charset.indexOf('*');
  if (asterisk >= 0) charset = charset.slice(0, asterisk);
  var encoding = self.slice(
    source,
    indexEncoding + 1,
    indexEncodedText,
    self.TRIM | self.LOWERCASE | self.ASCII
  );
  var encodedText = self.slice(
    source,
    indexEncodedText + 1,
    indexEnd,
    self.TRIM
  );
  if (encoding === 'b') {
    return self.decodeCharset(
      self.decodeBase64(encodedText, false),
      charset
    );
  } else if (encoding === 'q') {
    return self.decodeCharset(
      self.decodeQuotedPrintable(encodedText, false),
      charset
    );
  } else {
    return source;
  }
};

MIME.decodeHeaderEncodedWordBeforeParsingStructure = function(source) {
  var self = this;
  // RFC 2047 6.2 Display of 'encoded-word's
  // NOTE: Decoding and display of encoded-words occurs *after* a
  // structured field body is parsed into tokens. It is therefore
  // possible to hide 'special' characters in encoded-words which, when
  // displayed, will be indistinguishable from 'special' characters in the
  // surrounding text. For this and other reasons, it is NOT generally
  // possible to translate a message header containing 'encoded-word's to
  // an unencoded form which can be parsed by an RFC 822 mail reader.

  // Non-Spec: If header is an encoded word, this can decode before parsing.
  // This method is not activated but is here to support LibPST imports.
  // LibPST encodes a header as an encoded word if UTF-8 characters are present.
  // LibPST or Outlook also appears to treat single quotes as quoted strings.
  var sourceStart = 0;
  var sourceLength = source.length;
  // Adjust sourceStart to remove leading whitespace:
  while (sourceStart < sourceLength && self.FWS[source[sourceStart]]) {
    sourceStart++;
  }
  // Adjust sourceLength to remove trailing whitespace:
  while (sourceLength > 0 && self.FWS[source[sourceLength - 1]]) {
    sourceLength--;
  }
  if (
    sourceLength > 0 &&
    source[sourceStart] === 61 &&
    source[sourceLength - 1] === 61
  ) {
    var word = self.decodeHeaderEncodedWordsMatch(
      source,
      sourceStart,
      sourceLength
    );
    if (word[0] === sourceStart && word[1] === sourceLength) {
      return self.decodeHeaderEncodedWord(
        source.slice(sourceStart, sourceLength)
      );
    }
  } else {
    return source;
  }
};

MIME.decodeHeaderEncodedWords = function(source) {
  var self = this;
  // Non-Spec: We support encoded-words not separated by WSP.
  var buffers = [];
  var sourceStart = 0;
  var sourceIndex = 0;
  var sourceLength = source.length;
  if (sourceLength === 0) return source;
  while (sourceIndex < sourceLength) {
    var range = self.decodeHeaderEncodedWordsMatch(
      source,
      sourceIndex,
      sourceLength
    );
    if (!range) break;
    if (sourceStart < range[0]) {
      // RFC 2047 6.2 Display of 'encoded-word's
      // When displaying a particular header field that contains multiple
      // 'encoded-word's, any 'linear-white-space' that separates a pair of
      // adjacent 'encoded-word's is ignored. (This is to allow the use of
      // multiple 'encoded-word's to represent long strings of unencoded text,
      // without having to separate 'encoded-word's where spaces occur in the
      // unencoded text.)
      if (
        sourceStart === 0 ||
        !self.decodeHeaderEncodedWordsWSP(source, sourceStart, range[0])
      ) {
        buffers.push(source.slice(sourceStart, range[0]));
      }
    }
    var word = source.slice(range[0], range[1]);
    var text = self.decodeHeaderEncodedWord(word);
    if (text === word) {
      // We should never be here, this is an algorithmic error:
      throw new Error('matched false positive encoded-word');
    }
    buffers.push(text);
    sourceStart = sourceIndex = range[1];
  }
  if (sourceStart === 0) return source;
  if (sourceStart < sourceLength) {
    buffers.push(source.slice(sourceStart, sourceLength));
  }
  return Buffer.concat(buffers);
};

MIME.decodeHeaderEncodedWordsMatch = function(
  source,
  sourceIndex,
  sourceLength
) {
  var self = this;
  while (sourceIndex < sourceLength) {
    var index0 = self.indexOf(source, sourceIndex, sourceLength, 61); // '='
    if (index0 === -1 || index0 + 1 >= sourceLength) return;
    if (source[index0 + 1] !== 63) { // '?'
      sourceIndex = index0 + 1;
      continue;
    }
    var index1 = self.indexOf(source, index0 + 2, sourceLength, 63); // '?'
    if (index1 === -1) return;
    var index2 = self.indexOf(source, index1 + 1, sourceLength, 63); // '?'
    if (index2 === -1) return;
    var index3 = self.indexOf(source, index2 + 1, sourceLength, 63); // '?'
    if (index3 === -1 || index3 + 1 >= sourceLength) return;
    if (source[index3 + 1] !== 61) { // '='
      sourceIndex = index0 + 1;
      continue;
    }
    // encoded-word = "=?" charset "?" encoding "?" encoded-text "?="
    // charset = token
    // encoding = token
    if (
      !self.decodeHeaderEncodedWordsMatchToken(source, index0 + 2, index1) ||
      !self.decodeHeaderEncodedWordsMatchToken(source, index1 + 1, index2) ||
      !self.decodeHeaderEncodedWordsMatchText(source, index2 + 1, index3)
    ) {
      sourceIndex = index0 + 1;
      continue;
    }
    var encoding = self.slice(
      source,
      index1 + 1,
      index2,
      self.TRIM | self.LOWERCASE | self.ASCII
    );
    if (encoding.length !== 1 || !/^(b|q)$/.test(encoding)) {
      sourceIndex = index0 + 1;
      continue;
    }
    return [index0, index3 + 1 + 1];
  }
};

MIME.decodeHeaderEncodedWordsMatchText = function(
  source,
  sourceIndex,
  sourceLength
) {
  var self = this;
  // encoded-text = 1*<Any printable ASCII character other than "?"
  //                  or SPACE>
  //               ; (but see "Use of encoded-words in message
  //               ; headers", section 5)
  while (sourceIndex < sourceLength) {
    if (
      // Non-Spec: We allow text to contain TAB and SPACE:
      source[sourceIndex] === 9 ||
      (
        source[sourceIndex] >= 32 &&
        source[sourceIndex] <= 126 &&
        source[sourceIndex] !== 63
      )
    ) {
      sourceIndex++;
    } else {
      return false;
    }
  }
  return true;
};

MIME.decodeHeaderEncodedWordsMatchToken = function(
  source,
  sourceIndex,
  sourceLength
) {
  var self = this;
  while (sourceIndex < sourceLength) {
    if (!self.decodeHeaderEncodedWordsMatchTokenTable[source[sourceIndex++]]) {
      return false;
    }
  }
  return true;
};

MIME.decodeHeaderEncodedWordsMatchTokenTable = (function() {
  // CHAR = <any ASCII character> (0-127)
  // token = 1*<Any CHAR except SPACE, CTLs, and especials>
  // CTL = <any ASCII control           ; (  0- 37,  0.- 31.)
  //        character and DEL>          ; (    177,     127.)
  // especials = "(" / ")" / "<" / ">" / "@" / "," / ";" / ":" / "\"
  //            <"> / "/" / "[" / "]" / "?" / "." / "="
  var table = Buffer.alloc(256);
  for (var index = 0; index <= 127; index++) table[index] = 1;
  // Non-Spec: We allow token to contain TAB and SPACE:
  for (var index = 0; index <= 31; index++) table[index] = 0;
  table[9] = 1;
  table[127] = 0;
  var especials = '()<>@,;:\\"/[]?.=';
  for (var index = 0, length = especials.length; index < length; index++) {
    table[especials.charCodeAt(index)] = 0;
  }
  return table;
})();

MIME.decodeHeaderEncodedWordsWSP = function(
  source,
  sourceIndex,
  sourceLength
) {
  var self = this;
  while (sourceIndex < sourceLength) {
    if (self.FWS[source[sourceIndex]]) {
      sourceIndex++;
    } else {
      return false;
    }
  }
  return true;
};

MIME.decodeHeaderIdentifier = function(buffer) {
  var self = this;
  buffer = self.decodeHeaderBuffer(buffer, false);
  if (!buffer) return undefined;
  buffer = self.decodeHeaderUnfold(buffer);
  buffer = self.decodeHeaderRemoveComments(buffer);
  buffer = self.decodeHeaderAngleBrackets(buffer);
  return buffer.toString('ascii').trim().replace(
    /^\s*<\s*|\s*>\s*$/g,
    ''
  );
};

MIME.decodeHeaderIdentifiers = function(buffer) {
  var self = this;
  buffer = self.decodeHeaderBuffer(buffer, false);
  if (!buffer) return [];
  buffer = self.decodeHeaderUnfold(buffer);
  buffer = self.decodeHeaderRemoveComments(buffer);
  buffer = self.decodeHeaderAngleBrackets(buffer);
  // RFC 5322 3.6.4. Identification Fields

  // The "Message-ID:" field contains a single unique message identifier.
  // The "References:" and "In-Reply-To:" fields each contain one or more
  // unique message identifiers, optionally separated by CFWS.

  // The message identifier (msg-id) syntax is a limited version of the
  // addr-spec construct enclosed in the angle bracket characters, "<" and
  // ">".  Unlike addr-spec, this syntax only permits the dot-atom-text
  // form on the left-hand side of the "@" and does not have internal CFWS
  // anywhere in the message identifier.

  // Semantically, the angle bracket characters are not part of the
  // msg-id; the msg-id is what is contained between the two angle bracket
  // characters.

  // We do not support the obsolete syntax which allows spaces and phrases.
  var identifiers = self.decodeHeaderSplitOutsideQuotes(
    buffer,
    0,
    buffer.length,
    self.decodeHeaderIdentifiersSeparators
  );
  var index = 0;
  while (index < identifiers.length) {
    var identifier = identifiers[index].toString('ascii');
    var at = identifier.indexOf('@');
    if (at > 0 && at < identifier.length - 1) {
      identifiers[index++] = identifier;
    } else {
      identifiers.splice(index, 1);
    }
  }
  return identifiers;
};

MIME.decodeHeaderIdentifiersSeparators = Buffer.alloc(256);
MIME.decodeHeaderIdentifiersSeparators[9] = 1;
MIME.decodeHeaderIdentifiersSeparators[32] = 1;
MIME.decodeHeaderIdentifiersSeparators[44] = 1; // ','
MIME.decodeHeaderIdentifiersSeparators[60] = 1; // '<'
MIME.decodeHeaderIdentifiersSeparators[62] = 1; // '>'

MIME.decodeHeaderPercentEncoding = function(source) {
  var self = this;
  var table = self.decodeHeaderPercentEncodingTable;
  var target;
  var targetIndex;
  var sourceIndex = 0;
  var sourceLength = source.length;
  while (sourceIndex < sourceLength) {
    if (
      source[sourceIndex] === 37 &&
      sourceIndex + 2 < sourceLength &&
      table[source[sourceIndex + 1]] &&
      table[source[sourceIndex + 2]]
    ) {
      if (!target) {
        target = Buffer.alloc(sourceLength);
        targetIndex = source.copy(target, 0, 0, sourceIndex);
      }
      target[targetIndex++] = (
        ((table[source[sourceIndex + 1]] - 1) << 4) +
        ((table[source[sourceIndex + 2]] - 1))
      );
      sourceIndex += 3;
    } else if (target) {
      target[targetIndex++] = source[sourceIndex++];
    } else {
      sourceIndex++;
    }
  }
  if (target) {
    return target.slice(0, targetIndex);
  } else {
    return source;
  }
};

MIME.decodeHeaderPercentEncodingTable = Buffer.alloc(256);
MIME.decodeHeaderPercentEncodingTable[48] = 0 + 1; // '0'
MIME.decodeHeaderPercentEncodingTable[49] = 1 + 1; // '1'
MIME.decodeHeaderPercentEncodingTable[50] = 2 + 1; // '2'
MIME.decodeHeaderPercentEncodingTable[51] = 3 + 1; // '3'
MIME.decodeHeaderPercentEncodingTable[52] = 4 + 1; // '4'
MIME.decodeHeaderPercentEncodingTable[53] = 5 + 1; // '5'
MIME.decodeHeaderPercentEncodingTable[54] = 6 + 1; // '6'
MIME.decodeHeaderPercentEncodingTable[55] = 7 + 1; // '7'
MIME.decodeHeaderPercentEncodingTable[56] = 8 + 1; // '8'
MIME.decodeHeaderPercentEncodingTable[57] = 9 + 1; // '9'
MIME.decodeHeaderPercentEncodingTable[65] = 10 + 1; // 'A'
MIME.decodeHeaderPercentEncodingTable[66] = 11 + 1; // 'B'
MIME.decodeHeaderPercentEncodingTable[67] = 12 + 1; // 'C'
MIME.decodeHeaderPercentEncodingTable[68] = 13 + 1; // 'D'
MIME.decodeHeaderPercentEncodingTable[69] = 14 + 1; // 'E'
MIME.decodeHeaderPercentEncodingTable[70] = 15 + 1; // 'F'
MIME.decodeHeaderPercentEncodingTable[97] = 10 + 1; // 'a'
MIME.decodeHeaderPercentEncodingTable[98] = 11 + 1; // 'b'
MIME.decodeHeaderPercentEncodingTable[99] = 12 + 1; // 'c'
MIME.decodeHeaderPercentEncodingTable[100] = 13 + 1; // 'd'
MIME.decodeHeaderPercentEncodingTable[101] = 14 + 1; // 'e'
MIME.decodeHeaderPercentEncodingTable[102] = 15 + 1; // 'f'

MIME.decodeHeaderQuotedStrings = function(source) {
  var self = this;
  var quote = 0;
  var target;
  var targetIndex;
  var sourceStart = 0;
  var sourceIndex = 0;
  var sourceLength = source.length;
  while (sourceIndex < sourceLength) {
    if (source[sourceIndex] === 34) {
      if (!target) {
        target = Buffer.alloc(sourceLength);
        targetIndex = source.copy(target, 0, sourceStart, sourceIndex);
      }
      quote = (quote === 1) ? 0 : 1;
      sourceIndex++;
    } else {
      if (quote === 1 && source[sourceIndex] === 92) {
        if (++sourceIndex === sourceLength) break;
      }
      if (target) target[targetIndex++] = source[sourceIndex];
      sourceIndex++;
    }
  }
  if (quote === 1) {
    throw new Error(self.Error.QuotedStringUnterminated);
  }
  if (target) {
    return target.slice(0, targetIndex);
  } else {
    return source;
  }
};

MIME.decodeHeaderRemoveComments = function(source) {
  var self = this;
  var quote = 0;
  var depth = 0;
  var target;
  var targetIndex = 0;
  var sourceStart = 0;
  var sourceIndex = 0;
  var sourceLength = source.length;
  while (sourceIndex < sourceLength) {
    if (self.decodeHeaderRemoveCommentsTable[source[sourceIndex]]) {
      if (source[sourceIndex] === 34) {
        if (quote === 1) {
          quote = 0;
        } else if (depth === 0) {
          quote = 1;
        }
      } else if (source[sourceIndex] === 40) {
        if (quote === 0 && depth++ === 0) {
          if (!target) target = Buffer.alloc(sourceLength);
          targetIndex += source.copy(
            target,
            targetIndex,
            sourceStart,
            sourceIndex
          );
          sourceStart = sourceIndex;
        }
      } else if (source[sourceIndex] === 41) {
        if (quote === 0 && depth > 0) {
          if (--depth === 0) sourceStart = sourceIndex + 1;
        }
      } else if (source[sourceIndex] === 92) {
        // RFC 5322 3.2.1 Quoted Characters
        //
        // quoted-pair    =   ("\" (VCHAR / WSP)) / obs-qp
        //
        // Where any quoted-pair appears, it is to be interpreted as the
        // character alone.  That is to say, the "\" character that appears as
        // part of a quoted-pair is semantically "invisible".
        //
        // Note: The "\" character may appear in a message where it is not
        // part of a quoted-pair.  A "\" character that does not appear in a
        // quoted-pair is not semantically invisible.  The only places in
        // this specification where quoted-pair currently appears are
        // ccontent, qcontent, and in obs-dtext in section 4.

        // RFC 5322 4.1. Miscellaneous Obsolete Tokens
        // obs-qp         =   "\" (%d0 / obs-NO-WS-CTL / LF / CR)
        // obs-NO-WS-CTL  =   %d1-8 /            ; US-ASCII control
        //                    %d11 /             ; characters that do not
        //                    %d12 /             ; include the carriage
        //                    %d14-31 /          ; return, line feed, and
        //                    %d127              ; white space characters

        // RFC 5234 B.1 Core Rules
        // VCHAR          =   %x21-7E
        // WSP            =   SP / HTAB

        // A quoted-pair can only exist within ccontent or qcontent.
        if (quote === 1 || depth > 0) {
          // We are concerned only with codes 34, 40, 41, 92 in a quoted-pair.
          // These codes are all considered VCHARs (33-126 inclusive).
          if (sourceIndex + 1 < sourceLength) {
            if (self.decodeHeaderRemoveCommentsTable[source[sourceIndex + 1]]) {
              sourceIndex++;
            }
          }
        }
      }
    }
    sourceIndex++;
  }
  if (quote === 1) {
    throw new Error(self.Error.QuotedStringUnterminated);
  }
  if (depth > 0) {
    throw new Error(self.Error.CommentUnterminated);
  }
  if (target) {
    targetIndex += source.copy(
      target,
      targetIndex,
      sourceStart,
      sourceIndex
    );
    return target.slice(0, targetIndex);
  }
  return source;
};

MIME.decodeHeaderRemoveCommentsTable = new Uint8Array(256);
MIME.decodeHeaderRemoveCommentsTable[34] = 1; // '"'
MIME.decodeHeaderRemoveCommentsTable[40] = 1; // '('
MIME.decodeHeaderRemoveCommentsTable[41] = 1; // ')'
MIME.decodeHeaderRemoveCommentsTable[92] = 1; // '\'

MIME.decodeHeaderSplitOutsideQuotes = function(
  source,
  sourceIndex,
  sourceLength,
  separators
) {
  var self = this;
  var array = [];
  var quote = 0;
  var sourceStart = sourceIndex;
  while (sourceIndex < sourceLength) {
    if (source[sourceIndex] === 34) {
      quote = (quote === 1) ? 0 : 1;
    } else if (source[sourceIndex] === 92) {
      if (quote === 1 && sourceIndex + 1 < sourceLength) {
        // We are concerned only with codes 34, 92 in a quoted-pair.
        if (
          source[sourceIndex + 1] === 34 ||
          source[sourceIndex + 1] === 92
        ) {
          sourceIndex++;
        }
      }
    } else if (separators[source[sourceIndex]] > 0) {
      if (quote === 0) {
        if (
          separators[source[sourceIndex]] !== 255 &&
          sourceStart < sourceIndex
        ) {
          array.push(source.slice(sourceStart, sourceIndex));
        }
        sourceStart = sourceIndex + 1;
      }
    }
    sourceIndex++;
  }
  if (quote === 1) {
    throw new Error(self.Error.QuotedStringUnterminated);
  }
  if (sourceStart < sourceLength) {
    array.push(source.slice(sourceStart, sourceLength));
  }
  return array;
};

MIME.decodeHeaderUnfold = function(source) {
  var self = this;
  // RFC 5322 2.1.1 Line Length Limits
  //
  // There are two limits that this specification places on the number of
  // characters in a line. Each line of characters MUST be no more than
  // 998 characters, and SHOULD be no more than 78 characters, excluding
  // the CRLF.
  //
  // The 998 character limit is due to limitations in many implementations
  // that send, receive, or store IMF messages which simply cannot handle
  // more than 998 characters on a line. Receiving implementations would
  // do well to handle an arbitrarily large number of characters in a line
  // for robustness sake. However, there are so many implementations that
  // (in compliance with the transport requirements of [RFC5321]) do not
  // accept messages containing more than 1000 characters including the CR
  // and LF per line, it is important for implementations not to create
  // such messages.

  // We add a 100 character grace for Outlook.com which folds References a few
  // characters over the limit. Outlook.com appears to exclude the field name,
  // colon and space from the count, and also uses a count of 1000 instead of
  // 998, so that it folds too late.
  var lineLimit = 998 + 100;
  function check(length) {
    if (length > lineLimit) {
      throw new Error(self.Error.LineLimit);
    }
  }

  // RFC 5322 2.2 Header Fields
  // A field body MUST NOT include CR and LF except when used in "folding" and
  // "unfolding", as described in section 2.2.3.

  // RFC 5322 2.2.3 Long Header Fields
  // Unfolding is accomplished by simply removing any CRLF that is immediately
  // followed by WSP. Each header field should be treated in its unfolded form
  // for further syntactic and semantic evaluation. An unfolded header field has
  // no length restriction and therefore may be indeterminately long.

  // RFC 5322 3.2.2 Folding White Space and Comments
  // Wherever folding appears in a message (that is, a header field body
  // containing a CRLF followed by any WSP), unfolding (removal of the CRLF) is
  // performed before any further semantic analysis is performed on that header
  // field according to this specification. That is to say, any CRLF that
  // appears in FWS is semantically "invisible".

  function copy(crlf) {
    if (
      (sourceIndex < sourceLength) &&
      (source[sourceIndex] === 9 || source[sourceIndex] === 32)
    ) {
      check(sourceIndex - crlf - sourceStart);
      if (!target) target = Buffer.alloc(sourceLength);
      targetIndex += source.copy(
        target,
        targetIndex,
        sourceStart,
        sourceIndex - crlf
      );
      sourceStart = sourceIndex;
    } else {
      throw new Error(self.Error.HeaderCRLF);
    }
  }

  var target;
  var targetIndex = 0;
  var sourceStart = 0;
  var sourceIndex = 0;
  var sourceLength = source.length;
  while (sourceIndex < sourceLength) {
    if (source[sourceIndex] === 13) {
      sourceIndex++;
      if (sourceIndex < sourceLength && source[sourceIndex] === 10) {
        sourceIndex++;
        copy(2);
      } else {
        throw new Error(self.Error.HeaderCR);
      }
    } else if (source[sourceIndex] === 10) {
      sourceIndex++;
      copy(1);
    } else {
      sourceIndex++;
    }
  }
  if (target) {
    if (sourceStart < sourceLength) {
      check(sourceLength - sourceStart);
      targetIndex += source.copy(
        target,
        targetIndex,
        sourceStart,
        sourceLength
      );
    }
    return target.slice(0, targetIndex);
  } else {
    return source;
  }
};

MIME.decodeHeaderUnstructured = function(buffer) {
  var self = this;
  buffer = self.decodeHeaderBuffer(buffer, false);
  if (!buffer) return '';
  // RFC 5322 2.2.1 Unstructured Header Field Bodies
  //
  // Some field bodies in this specification are defined simply as
  // "unstructured" (which is specified in section 3.2.5 as any printable
  // US-ASCII characters plus white space characters) with no further
  // restrictions. These are referred to as unstructured field bodies.
  // Semantically, unstructured field bodies are simply to be treated as a
  // single line of characters with no further processing (except for
  // "folding" and "unfolding" as described in section 2.2.3).

  // RFC 2047 5 Use of encoded-words in message headers
  //
  // (1) An 'encoded-word' may replace a 'text' token (as defined by RFC 822)
  //     in any Subject or Comments header field, any extension message
  //     header field, or any MIME body part field for which the field body
  //     is defined as '*text'.  An 'encoded-word' may also appear in any
  //     user-defined ("X-") message or body part header field.
  return self.decodeHeaderEncodedWords(
    self.decodeHeaderUnfold(buffer)
  ).toString('utf-8');
};

MIME.decodeHeaderValueParameters = function(buffer) {
  var self = this;
  var length = buffer.length;
  var semicolon = self.indexOf(buffer, 0, length, 59); // ';'
  if (semicolon === -1) semicolon = length;
  var header = new self.HeaderValueParameters(
    self.slice(buffer, 0, semicolon, self.ASCII | self.LOWERCASE | self.TRIM),
    {}
  );
  var parts = self.decodeHeaderSplitOutsideQuotes(
    buffer,
    semicolon + 1,
    length,
    self.decodeHeaderValueParametersSeparators
  );
  var continuations = {};
  for (var index = 0, length = parts.length; index < length; index++) {
    var part = parts[index];
    var equal = self.indexOf(part, 0, part.length, 61); // '='
    var name = self.slice(
      part,
      0,
      equal === -1 ? part.length : equal,
      self.ASCII | self.LOWERCASE | self.TRIM
    );
    if (equal === -1) {
      if (name.length === 0) continue;
      throw new Error(self.Error.ParameterValueMissing);
    }
    if (name.length === 0) {
      throw new Error(self.Error.ParameterAttributeMissing);
    }
    var value = self.decodeHeaderQuotedStrings(self.slice(
      part,
      equal + 1,
      part.length,
      self.TRIM
    ));
    if (!self.decodeHeaderValueParametersSegment(name, value, continuations)) {
      self.decodeHeaderValueParametersAssert(header.parameters, name);
      // RFC 2047 5 Use of encoded-words in message headers
      //
      // An 'encoded-word' MUST NOT be used in parameter of a MIME
      // Content-Type or Content-Disposition field, or in any structured
      // field body except within a 'comment' or 'phrase'.

      // Outlook encodes name and filename parameters using encoded words.
      // Gmail does the same as of testing on 2017-05-20 and according to:
      // http://lists.gnu.org/archive/html/nmh-workers/2016-09/msg00174.html

      // Non-Spec: We therefore decode any encoded words found in parameters.
      // We only do this for parameters not encoded using RFC 2231.

      // See Keith Moore's comment on this:
      // http://www.thewildbeast.co.uk/claws-mail/bugzilla/show_bug.cgi?id=1776

      // > You are correct - what the standards say differs from widespread
      // > practice.
      // >
      // > Another thing that some MUAs do is encode the name in the
      // > Content-Disposition filename parameter using RFC 2047. I like this
      // > better than using the name parameter of the Content-Type field,
      // > because strictly speaking, the name parameter is only available for
      // > application/octet-stream - and it's better to use a more specific
      // > Content-Type when one is known.
      // >
      // > My feeling is that using RFC 2047 for filenames while it's not within
      // > the letter of the standard, is mostly harmless.  The reason is that
      // > the filename is just advisory anyway.  The receiving system isn't
      // > expected to use the filename exactly as supplied by the sender, both
      // > for security reasons and because different operating systems have
      // > different limitations on how a filename can be spelled (how long it
      // > can be, what characters can be used, that sort of thing).  So if the
      // > receiving system recognizes RFC 2047 and tries to decode it before
      // > treating the result as a filename, that's just another way of
      // > interpreting the filename to make it acceptable to local convention.
      // >
      // > Keith
      // >
      // > Colin Leroy wrote:
      // > >
      // > > We send out MIME headers resembling:
      // > >
      // > >  Content-Type: application/octet-stream; name="t_st"
      // > >  Content-Transfer-Encoding: base64
      // > >  Content-Disposition: attachment; filename*=UTF-8''t%C3%A9st
      // > >
      // > > The reasoning being that the correct parameter for the filename is
      // > > Content-Disposition's filename, and that receiving MUAs that don't
      // > > handle RFC2231 will fallback to Content-Type's name parameter.
      // > >
      // > > Now, the bug report asks us to use Q or B encoding in the name
      // > > parameter, like most MUAs do, apparently:
      // > >
      // > >  Content-Type: application/octet-stream;
      // > > name="=?UTF-8?Q?t=C3=A9st?=" Content-Transfer-Encoding: base64
      // > >  Content-Disposition: attachment; filename*=UTF-8''t%C3%A9st
      // > >
      // > > This would fix displaying of the filename in some MUAs like Outlook
      // > > or GMail. However, from my understanding of RFC 2047, it's a MUST
      // > > NOT:
      // > >
      // > >   + An 'encoded-word' MUST NOT be used in parameter of a MIME
      // > >     Content-Type or Content-Disposition field, or in any structured
      // > >     field body except within a 'comment' or 'phrase'.
      // > >
      // > > My understanding is that non-ASCII filenames are unrepresentable if
      // > > not using RFC 2231, and Q or B encoding there is RFC-uncompliant.
      // > > Am I correct?
      // > >
      // > > Thanks a lot in advance - RFC reading is a tricky mind exercise :-)
      header.parameters[name] = self.decodeHeaderEncodedWords(
        value
      ).toString('utf-8');
    }
  }
  for (var name in continuations) {
    self.decodeHeaderValueParametersAssert(header.parameters, name);
    header.parameters[name] = self.decodeHeaderValueParametersSegments(
      continuations[name]
    ).toString('utf-8');
  }
  return header;
};

MIME.decodeHeaderValueParametersAssert = function(parameters, name) {
  var self = this;
  // Duplicate parameters can be a security risk.
  // Some clients (e.g. anti-virus) may use the first parameter.
  // Other clients (e.g. MUA) may use the second parameter.
  // https://noxxi.de/research/mime-conflicting-boundary.html
  // https://securityvulns.com/advisories/content.asp
  if (name === 'boundary') {
    if (parameters.hasOwnProperty(name)) {
      throw new Error(self.Error.ParameterMultipleBoundary);
    }
  } else if (name === 'charset') {
    if (parameters.hasOwnProperty(name)) {
      throw new Error(self.Error.ParameterMultipleCharset);
    }
  } else if (name === 'filename') {
    if (parameters.hasOwnProperty(name)) {
      throw new Error(self.Error.ParameterMultipleFilename);
    }
  } else if (name === 'name') {
    if (parameters.hasOwnProperty(name)) {
      throw new Error(self.Error.ParameterMultipleName);
    }
  }
};

MIME.decodeHeaderValueParametersSegment = function(
  key,
  value,
  continuations
) {
  var self = this;
  var match = key.match(self.decodeHeaderValueParametersSegmentRegex);
  if (!match) return false;
  if (!match[2] && !match[3]) return false;
  var name = match[1];
  var index = parseInt((match[2] || '*0').slice(1), 10);
  if (index > 1000) {
    throw new Error(self.Error.ContinuationLimit);
  }
  var encoded = match[3] === '*';
  if (!continuations.hasOwnProperty(name)) {
    continuations[name] = [];
  }
  if (continuations[name][index] !== undefined) {
    throw new Error(self.Error.ContinuationDuplicate);
  }
  var charset;
  if (encoded) {
    var valueLength = value.length;
    var indexCharset = self.indexOf(value, 0, valueLength, 39);
    if (indexCharset >= 0) {
      var indexLang = self.indexOf(value, indexCharset + 1, valueLength, 39);
      if (indexLang >= 0) {
        charset = self.slice(
          value,
          0,
          indexCharset,
          self.TRIM | self.LOWERCASE | self.ASCII
        );
        value = value.slice(indexLang + 1);
      }
    }
  }
  continuations[name][index] = {
    encoded: encoded,
    charset: charset,
    value: value
  };
  return true;
};

MIME.decodeHeaderValueParametersSegmentRegex = /^([^*]+)(\*\d+)?(\*)?$/;

MIME.decodeHeaderValueParametersSegments = function(segments) {
  var self = this;
  var buffers = [];
  var charset;
  for (var index = 0, length = segments.length; index < length; index++) {
    var segment = segments[index];
    // RFC 2231 3 Parameter Value Continuations
    // Decimal values are used and neither leading zeroes
    // nor gaps in the sequence are allowed.
    // Non-Spec: We tolerate gaps.
    if (!segment) continue;
    if (segment.encoded) {
      if (!charset && segment.charset) charset = segment.charset;
      buffers.push(
        self.decodeCharset(
          self.decodeHeaderPercentEncoding(segment.value),
          segment.charset || charset
        )
      );
    } else {
      buffers.push(segment.value);
    }
  }
  return Buffer.concat(buffers);
};

MIME.decodeHeaderValueParametersSeparators = Buffer.alloc(256);
MIME.decodeHeaderValueParametersSeparators[59] = 1; // ';'

MIME.decodeHeaders = function(buffer, headers) {
  var self = this;
  var start = 0;
  var index = 0;
  var length = buffer.length;
  while (index < length) {
    if (buffer[index] === 13) {
      index++;
      if (index < length && buffer[index] === 10) {
        index++;
        if (index < length && (buffer[index] === 9 || buffer[index] === 32)) {
          index++;
        } else {
          self.decodeHeadersHeader(buffer, start, index - 2, headers);
          start = index;
        }
      }
    } else if (buffer[index] === 10) {
      index++;
      if (index < length && (buffer[index] === 9 || buffer[index] === 32)) {
        index++;
      } else {
        self.decodeHeadersHeader(buffer, start, index - 1, headers);
        start = index;
      }
    } else {
      index++;
    }
  }
  if (start < length) {
    self.decodeHeadersHeader(buffer, start, length, headers);
  }
  return headers;
};

MIME.decodeHeadersHeader = function(
  source,
  sourceStart,
  sourceEnd,
  headers
) {
  var self = this;
  var sourceBody = self.indexOf(source, sourceStart, sourceEnd, 58); // ':'
  if (sourceBody === -1) {
    throw new Error(self.Error.HeaderColonMissing);
  }
  self.decodeHeadersHeaderAssertCharacters(source, sourceStart, sourceEnd);
  var name = self.slice(
    source,
    sourceStart,
    sourceBody,
    self.TRIM | self.LOWERCASE | self.ASCII
  );
  self.decodeHeadersHeaderAssertUnique(headers, name);
  if (
    (sourceBody + 1 < sourceEnd) &&
    (source[sourceBody + 1] === 9 || source[sourceBody + 1] === 32)
  ) {
    sourceBody++;
  }
  var body = source.slice(sourceBody + 1, sourceEnd);
  if (headers.hasOwnProperty(name)) {
    headers[name].push(body);
  } else {
    headers[name] = [body];
  }
};

MIME.decodeHeadersHeaderAssertCharacters = function(
  source,
  sourceStart,
  sourceEnd
) {
  var self = this;
  // RFC 5322 Section 2.2. Header Fields
  //
  // Header fields are lines beginning with a field name, followed by a
  // colon (":"), followed by a field body, and terminated by CRLF. A
  // field name MUST be composed of printable US-ASCII characters (i.e.,
  // characters that have values between 33 and 126, inclusive), except
  // colon. A field body may be composed of printable US-ASCII characters
  // as well as the space (SP, ASCII value 32) and horizontal tab (HTAB,
  // ASCII value 9) characters (together known as the white space
  // characters, WSP). A field body MUST NOT include CR and LF except
  // when used in "folding" and "unfolding", as described in section
  // 2.2.3. All field bodies MUST conform to the syntax described in
  // sections 3 and 4 of this specification.

  // RFC 2046 5.1.1 Common Syntax
  // However, in no event are headers (either message headers or body part
  // headers) allowed to contain anything other than US-ASCII characters.
  while (sourceStart < sourceEnd) {
    if (!self.decodeHeadersHeaderAssertCharactersTable[source[sourceStart]]) {
      throw new Error(self.Error.HeaderCharactersForbidden);
    }
    sourceStart++;
  }
};

MIME.decodeHeadersHeaderAssertCharactersTable = (function() {
  var table = Buffer.alloc(256);
  var index = 33;
  var length = 127;
  while (index < length) table[index++] = 1;
  table[9] = 1;
  table[10] = 1;
  table[13] = 1;
  table[32] = 1;
  return table;
})();

MIME.decodeHeadersHeaderAssertUnique = function(headers, name) {
  var self = this;
  // RFC 5322 3.6 Field Definitions
  if (headers.hasOwnProperty(name)) {
    switch (name) {
      // Multiple content-* headers are a security risk.
      // https://noxxi.de/research/mime-conflicting-boundary.html
      // https://noxxi.de/research/content-transfer-encoding.html
      case 'content-disposition':
        throw new Error(self.Error.MultipleContentDisposition);
      case 'content-id':
        throw new Error(self.Error.MultipleContentID);
      case 'content-transfer-encoding':
        throw new Error(self.Error.MultipleContentTransferEncoding);
      case 'content-type':
        throw new Error(self.Error.MultipleContentType);
      case 'date':
        throw new Error(self.Error.MultipleDate);
      case 'from':
        throw new Error(self.Error.MultipleFrom);
      case 'in-reply-to':
        throw new Error(self.Error.MultipleInReplyTo);
      // case 'message-id':
      //   throw new Error(self.Error.MultipleMessageID);
      case 'references':
        throw new Error(self.Error.MultipleReferences);
      case 'reply-to':
        throw new Error(self.Error.MultipleReplyTo);
      case 'sender':
        throw new Error(self.Error.MultipleSender);
      case 'subject':
        throw new Error(self.Error.MultipleSubject);
    }
  }
};

MIME.decodeParts = function(buffer, boundary) {
  var self = this;
  self.decodePartsValidateBoundary(boundary);
  var parts = [];
  var pattern = Buffer.from('--' + boundary, 'ascii');
  var preamble = true;
  var index = 0;
  var limit = 10000 + 1; // Allow at most 10000 parts.
  while (limit--) {
    var boundary = self.decodePartsFindBoundary(buffer, pattern, index);
    if (boundary) {
      if (preamble) {
        preamble = false;
      } else if (boundary.begin - index > 0) {
        parts.push(buffer.slice(index, boundary.begin));
      }
      if (boundary.closing) {
        break;
      } else {
        index = boundary.end;
      }
    } else {
      throw new Error(self.Error.PartMissing);
    }
  }
  if (limit < 0) throw new Error(self.Error.PartLimit);
  return parts;
};

MIME.decodePartsFindBoundary = function(buffer, pattern, index) {
  var self = this;
  // RFC 2046 5.1

  // Parameter values are normally case sensitive, but sometimes
  // are interpreted in a case-insensitive fashion, depending on the
  // intended use.  (For example, multipart boundaries are case-sensitive,
  // but the "access-type" parameter for message/External-body is not
  // case-sensitive.)

  // RFC 2046 5.1.1

  // The boundary delimiter line is then defined as a line
  // consisting entirely of two hyphen characters ("-", decimal value 45)
  // followed by the boundary parameter value from the Content-Type header
  // field, optional linear whitespace, and a terminating CRLF.

  // The boundary delimiter MUST occur at the beginning of a line, i.e.,
  // following a CRLF, and the initial CRLF is considered to be attached
  // to the boundary delimiter line rather than part of the preceding
  // part. The boundary may be followed by zero or more characters of
  // linear whitespace. It is then terminated by either another CRLF and
  // the header fields for the next part, or by two CRLFs, in which case
  // there are no header fields for the next part.

  // The CRLF preceding the boundary delimiter line is conceptually
  // attached to the boundary so that it is possible to have a part that
  // does not end with a CRLF (line break). Body parts that must be
  // considered to end with line breaks, therefore, must have two CRLFs
  // preceding the boundary delimiter line, the first of which is part of
  // the preceding body part, and the second of which is part of the
  // encapsulation boundary.

  // If a boundary delimiter line appears to end with white space, the white
  // space must be presumed to have been added by a gateway, and must be
  // deleted.

  // LWSP-char := SPACE / HTAB (RFC 822 3.3)

  // dash-boundary := "--" boundary
  //                  ; boundary taken from the value of
  //                  ; boundary parameter of the
  //                  ; Content-Type field.

  // multipart-body := [preamble CRLF]
  //                   dash-boundary transport-padding CRLF
  //                   body-part *encapsulation
  //                   close-delimiter transport-padding
  //                   [CRLF epilogue]

  // transport-padding := *LWSP-char
  //                      ; Composers MUST NOT generate
  //                      ; non-zero length transport
  //                      ; padding, but receivers MUST
  //                      ; be able to handle padding
  //                      ; added by message transports.

  // encapsulation := delimiter transport-padding
  //                  CRLF body-part

  // delimiter := CRLF dash-boundary

  // close-delimiter := delimiter "--"

  var limit = 10000;
  while (limit--) {
    index = buffer.indexOf(pattern, index);
    if (index === -1) return undefined;
    if (index === 0 || self.LF(buffer, index - 1)) {
      var boundary = {
        begin: index,
        end: index + pattern.length,
        closing: false
      };
      if (self.LF(buffer, index - 1)) boundary.begin--;
      if (self.CR(buffer, index - 2)) boundary.begin--;
      if (
        self.MATCH(buffer, boundary.end, 45) &&
        self.MATCH(buffer, boundary.end, 45)
      ) {
        boundary.end += 2;
        boundary.closing = true;
      }
      while (
        // TAB or SPACE:
        self.MATCH(buffer, boundary.end, 9) ||
        self.MATCH(buffer, boundary.end, 32)
      ) {
        boundary.end++;
      }
      // Only remove CRLF or LF if boundary is followed by explicit headers.
      if (self.CRLF(buffer, boundary.end)) {
        if (!self.CRLF(buffer, boundary.end + 2)) boundary.end += 2;
        return boundary;
      } else if (self.LF(buffer, boundary.end)) {
        if (!self.LF(buffer, boundary.end + 1)) boundary.end += 1;
        return boundary;
      } else if (boundary.closing && boundary.end === buffer.length) {
        // This is not part of the specification.
        // If there is no CRLF but we have seen the closing boundary and are at
        // the end of the buffer, then consider the boundary to have been found.
        // The trailing CRLF may have been stripped by message transports.
        return boundary;
      }
    }
    index++;
  }
  throw new Error(self.Error.PartBoundaryFalsePositiveLimit);
};

MIME.decodePartsValidateBoundary = function(string) {
  var self = this;
  // RFC 2046 5.1.1
  // The only mandatory global parameter for the "multipart" media type is
  // the boundary parameter, which consists of 1 to 70 characters from a
  // set of characters known to be very robust through mail gateways, and
  // NOT ending with white space.

  // boundary := 0*69<bchars> bcharsnospace
  //
  // bchars := bcharsnospace / " "
  //
  // bcharsnospace := DIGIT / ALPHA / "'" / "(" / ")" /
  //                 "+" / "_" / "," / "-" / "." /
  //                 "/" / ":" / "=" / "?"

  if (typeof string !== 'string') {
    throw new Error(self.Error.PartBoundaryMissing);
  }
  if (string.length === 0) {
    throw new Error(self.Error.PartBoundaryEmpty);
  }
  if (string.trim().length === 0) {
    throw new Error(self.Error.PartBoundaryWSP);
  }
  if (string.length > 70) {
    throw new Error(self.Error.PartBoundaryLimit);
  }
  // Non-Spec: "@" is not part of `bcharsnospace` but is commonly used.
  if (!/^[0-9a-zA-Z'()+_,\-.\/:=?@ ]+$/.test(string)) {
    throw new Error(self.Error.PartBoundaryCharactersForbidden);
  }
  if (/\s$/.test(string)) {
    throw new Error(self.Error.PartBoundaryWSP);
  }
};

MIME.decodeQuotedPrintable = function(buffer, body) {
  var self = this;
  try {
    // TO DO: Add option to correct/reject illegal characters:
    return self.QuotedPrintable.decode(buffer, { qEncoding: !body });
  } catch (error) {
    if (error.message === 'illegal character') {
      // RFC 2045 6.7 Quoted-Printable Content-Transfer-Encoding
      // (4)  Control characters other than TAB, or CR and LF as
      //      parts of CRLF pairs, must not appear. The same is true
      //      for octets with decimal values greater than 126.  If
      //      found in incoming quoted-printable data by a decoder, a
      //      robust implementation might exclude them from the
      //      decoded data and warn the user that illegal characters
      //      were discovered.
      if (body) {
        throw new Error(self.Error.QuotedPrintableBodyIllegal);
      } else {
        throw new Error(self.Error.QuotedPrintableWordIllegal);
      }
    }
    throw error;
  }
};

MIME.encodeHeaderFold = function(line) {
  var self = this;
  // RFC 5322 2.1.1 Line Length Limits
  // There are two limits that this specification places on the number of
  // characters in a line. Each line of characters MUST be no more than
  // 998 characters, and SHOULD be no more than 78 characters, excluding
  // the CRLF.

  // RFC 5322 2.2.3 Long Header Fields
  // Each header field is logically a single line of characters comprising
  // the field name, the colon, and the field body. For convenience
  // however, and to deal with the 998/78 character limitations per line,
  // the field body portion of a header field can be split into a
  // multiple-line representation; this is called "folding". The general
  // rule is that wherever this specification allows for folding white
  // space (not simply WSP characters), a CRLF may be inserted before any
  // WSP.
  var lineLength = line.length;
  var crlf = (
    lineLength >= 2 &&
    line[lineLength - 2] === 13 &&
    line[lineLength - 1] === 10
  ) ? 2 : 0;

  // TO DO: Work in progress.
};

MIME.encodeHeaderReceived = function(received) {
  var self = this;
  // RFC 5321 3.7.2 Received Lines in Gatewaying
  // 
  // When forwarding a message into or out of the Internet environment, a
  // gateway MUST prepend a Received: line, but it MUST NOT alter in any
  // way a Received: line that is already in the header section.
  //
  // "Received:" header fields of messages originating from other
  // environments may not conform exactly to this specification.  However,
  // the most important use of Received: lines is for debugging mail
  // faults, and this debugging can be severely hampered by well-meaning
  // gateways that try to "fix" a Received: line.  As another consequence
  // of trace header fields arising in non-SMTP environments, receiving
  // systems MUST NOT reject mail based on the format of a trace header
  // field and SHOULD be extremely robust in the light of unexpected
  // information or formats in those header fields.

  // RFC 5321 4.4 Trace Information
  //
  // When an SMTP server receives a message for delivery or further
  // processing, it MUST insert trace ("time stamp" or "Received")
  // information at the beginning of the message content, as discussed in
  // Section 4.1.1.4.
  //
  // This line MUST be structured as follows:
  // 
  // o  The FROM clause, which MUST be supplied in an SMTP environment,
  //    SHOULD contain both (1) the name of the source host as presented
  //    in the EHLO command and (2) an address literal containing the IP
  //    address of the source, determined from the TCP connection.
  //
  // o  The ID clause MAY contain an "@" as suggested in RFC 822, but this
  //    is not required.
  //
  // o  If the FOR clause appears, it MUST contain exactly one <path>
  //    entry, even when multiple RCPT commands have been given. Multiple
  //    <path>s raise some security issues and have been deprecated, see
  //    Section 7.2.
  //
  // An Internet mail program MUST NOT change or delete a Received: line
  // that was previously added to the message header section. SMTP
  // servers MUST prepend Received lines to messages; they MUST NOT change
  // the order of existing lines or insert Received lines in any other
  // location.
  //
  // As the Internet grows, comparability of Received header fields is
  // important for detecting problems, especially slow relays. SMTP
  // servers that create Received header fields SHOULD use explicit
  // offsets in the dates (e.g., -0800), rather than time zone names of
  // any type. Local time (with an offset) SHOULD be used rather than UT
  // when feasible. This formulation allows slightly more information
  // about local circumstances to be specified. If UT is needed, the
  // receiver need merely do some simple arithmetic to convert the values.
  // Use of UT loses information about the time zone-location of the
  // server. If it is desired to supply a time zone name, it SHOULD be
  // included in a comment.

  // RFC 5321 4.4 Trace Information
  // Time-stamp-line  = "Received:" FWS Stamp <CRLF>
  //
  // Stamp          = From-domain By-domain Opt-info [CFWS] ";"
  //                FWS date-time
  //                ; where "date-time" is as defined in RFC 5322 [4]
  //                ; but the "obs-" forms, especially two-digit
  //                ; years, are prohibited in SMTP and MUST NOT be used.
  //
  // From-domain    = "FROM" FWS Extended-Domain
  //
  // By-domain      = CFWS "BY" FWS Extended-Domain
  //
  // Extended-Domain  = Domain /
  //                  ( Domain FWS "(" TCP-info ")" ) /
  //                  ( address-literal FWS "(" TCP-info ")" )
  //
  // TCP-info       = address-literal / ( Domain FWS address-literal )
  //                ; Information derived by server from TCP connection
  //                ; not client EHLO.
  //
  // Opt-info       = [Via] [With] [ID] [For]
  //                [Additional-Registered-Clauses]
  //
  // Via            = CFWS "VIA" FWS Link
  //
  // With           = CFWS "WITH" FWS Protocol
  //
  // ID             = CFWS "ID" FWS ( Atom / msg-id )
  //                ; msg-id is defined in RFC 5322 [4]
  //
  // For            = CFWS "FOR" FWS ( Path / Mailbox )
  //
  // Additional-Registered-Clauses  = CFWS Atom FWS String
  //                                ; Additional standard clauses may be
  //                                added in this
  //                                ; location by future standards and
  //                                registration with
  //                                ; IANA. SMTP servers SHOULD NOT use
  //                                unregistered
  //                                ; names. See Section 8.
  //
  // Link           = "TCP" / Addtl-Link
  //
  // Addtl-Link     = Atom
  //                ; Additional standard names for links are
  //                ; registered with the Internet Assigned Numbers
  //                ; Authority (IANA).  "Via" is primarily of value
  //                ; with non-Internet transports.  SMTP servers
  //                ; SHOULD NOT use unregistered names.
  //
  // Protocol       = "ESMTP" / "SMTP" / Attdl-Protocol
  //
  // Attdl-Protocol = Atom
  //                ; Additional standard names for protocols are
  //                ; registered with the Internet Assigned Numbers
  //                ; Authority (IANA) in the "mail parameters"
  //                ; registry [9].  SMTP servers SHOULD NOT
  //                ; use unregistered names.

  // RFC 5321 7.2 "Blind" Copies
  // Especially when more than one RCPT command is present, and in order
  // to avoid defeating some of the purpose of these mechanisms, SMTP
  // clients and servers SHOULD NOT copy the full set of RCPT command
  // arguments into the header section, either as part of trace header
  // fields or as informational or private-extension header fields.

  // RFC 3848 1 IANA Considerations
  //
  // As directed by SMTP [2], IANA maintains a registry [7] of "WITH
  // protocol types" for use in the "with" clause of the Received header
  // in an Internet message. This registry presently includes SMTP [6],
  // and ESMTP [2]. This specification updates the registry as follows:
  //
  // o  The new keyword "ESMTPA" indicates the use of ESMTP when the SMTP
  //    AUTH [3] extension is also used and authentication is successfully
  //    achieved.
  //
  // o  The new keyword "ESMTPS" indicates the use of ESMTP when STARTTLS
  //    [1] is also successfully negotiated to provide a strong transport
  //    encryption layer.
  //
  // o  The new keyword "ESMTPSA" indicates the use of ESMTP when both
  //    STARTTLS and SMTP AUTH are successfully negotiated (the
  //    combination of ESMTPS and ESMTPA).
  //
  // o  The new keyword "LMTP" indicates the use of LMTP [4].
  //
  // o  The new keyword "LMTPA" indicates the use of LMTP when the SMTP
  //    AUTH extension is also used and authentication is successfully
  //    achieved.
  //
  // o  The new keyword "LMTPS" indicates the use of LMTP when STARTTLS is
  //    also successfully negotiated to provide a strong transport
  //    encryption layer.
  //
  // o  The new keyword "LMTPSA" indicates the use of LMTP when both
  //    STARTTLS and SMTP AUTH are successfully negotiated (the
  //    combination of LSMTPS and LSMTPA).
  
  if (received.from !== undefined) {
    if (typeof received.from !== 'string') {
      throw new Error('From-domain must be a string');
    }
    if (!self.isDomain(Buffer.from(received.from))) {
      throw new Error('From-domain must be a valid domain');
    }
  }
  if (received.ip !== undefined) {
    if (typeof received.ip !== 'string') {
      throw new Error('TCP-info ip must be a string');
    }
    if (!Node.net.isIP(received.ip)) {
      throw new Error('TCP-info ip must be a valid IPv4 or IPv6 address');
    }
  }
  if (received.by === undefined) {
    throw new Error('By-domain must be provided');
  }
  if (typeof received.by !== 'string') {
    throw new Error('By-domain must be a string');
  }
  if (!self.isDomain(Buffer.from(received.by))) {
    throw new Error('By-domain must be a valid domain');
  }
  if (received.via !== undefined) {
    if (typeof received.via !== 'string') {
      throw new Error('Via must be a string');
    }
    if (!self.isAtom(Buffer.from(received.via))) {
      throw new Error('Via must be a valid atom');
    }
  }
  if (received.protocol !== undefined) {
    if (typeof received.protocol !== 'string') {
      throw new Error('Protocol must be a string');
    }
    if (
      !/^(ESMTP|ESMTPS|ESMTPSA|HTTP|LMTP|LMTPA|LMTPS|LMTPSA|SMTP)$/.test(
        received.protocol
      )
    ) {
      throw new Error('Protocol must be a registered protocol type');
    }
  }
  if (received.id !== undefined) {
    if (typeof received.id !== 'string') {
      throw new Error('ID must be a string');
    }
    // RFC 5322 is less restrictive: word / angle-addr / addr-spec / domain
    // But RFC 5322 specifically indicates that RFC 5321 is more restrictive.
    // We follow the more restrictive specification for encoding:
    var receivedIDBuffer = Buffer.from(received.id);
    if (
      !self.isAtom(receivedIDBuffer) &&
      !self.isMsgID(receivedIDBuffer)
    ) {
      throw new Error('ID must be a valid atom or msg-id');
    }
  }
  if (!received.from) {
    if (received.ip) {
      throw new Error('From-domain must be provided if TCP-info is provided');
    }
    if (/SMTP/.test(received.protocol)) {
      throw new Error('From-domain must be provided in an SMTP environment');
    }
  }
  if (received.recipient !== undefined) {
    if (typeof received.recipient !== 'string') {
      throw new Error('For recipient must be a string');
    }
    var receivedRecipientBuffer = Buffer.from(received.recipient);
    if (
      !self.isPath(receivedRecipientBuffer) &&
      !self.isMailbox(receivedRecipientBuffer)
    ) {
      throw new Error('For recipient must be a valid path or mailbox');
    }
  }
  if (received.timestamp === undefined) {
    throw new Error('timestamp must be provided');
  }
  if (typeof received.timestamp !== 'number') {
    throw new Error('timestamp must be a number');
  }
  if (Math.floor(received.timestamp) !== received.timestamp) {
    throw new Error('timestamp must be an integer');
  }
  if (received.offset !== undefined) {
    if (typeof received.offset !== 'number') {
      throw new Error('offset in minutes must be a number');
    }
    if (Math.floor(received.offset) !== received.offset) {
      throw new Error('offset in minutes must be an integer');
    }
  }

  var stamp = [];
  if (received.from) {
    stamp.push('from');
    stamp.push(received.from);
    if (received.ip) {
      stamp.push('(' + received.from + ' [' + received.ip + '])');
    }
  }
  stamp.push('by');
  stamp.push(received.by);
  if (received.via) {
    stamp.push('via');
    stamp.push(received.via);
  }
  if (received.protocol) {
    stamp.push('with');
    stamp.push(received.protocol);
  }
  if (received.id) {
    stamp.push('id');
    stamp.push(received.id);
  }
  if (received.recipient) {
    stamp.push('for');
    stamp.push(received.recipient);
  }
  if (stamp.length === 0) {
    throw new Error('at least one non-empty clause must be provided');
  }
  // Add semicolon to penultimate clause:
  stamp[stamp.length - 1] = stamp[stamp.length - 1] + ';';
  // Fri, 13 Oct 2017 09:08:14 -0400 (EDT)
  if (received.offset === undefined) {
    // The getTimezoneOffset() method returns the time zone difference,
    // in minutes, from UTC to current locale (host system settings).
    var minutes = -new Date().getTimezoneOffset();
  } else {
    var minutes = received.offset;
  }
  var date = new Date(received.timestamp + (minutes * 60 * 1000)).toUTCString();
  // Remove " GMT" and add local offset (hhmm):
  date = date.slice(0, -4);
  var negative = minutes < 0;
  if (negative) minutes = -minutes;
  var hours = 0;
  while (minutes >= 60) {
    hours++;
    minutes -= 60;
  }
  hours = hours.toString();
  while (hours.length < 2) hours = '0' + hours;
  minutes = minutes.toString();
  while (minutes.length < 2) minutes = '0' + minutes;
  date = date + ' ' + (negative ? '-' : '+') + hours + minutes;
  stamp.push(date);

  // We fold at a higher syntactic level by folding between clauses rather than
  // within clauses (a simple fold algorithm might fold between date fields):
  var lines = 'Received:';
  var lineLength = lines.length;
  for (var index = 0, length = stamp.length; index < length; index++) {
    var clause = stamp[index];
    if (lineLength + 1 + clause.length > 78) {
      lines += '\r\n';
      lineLength = 0;
    }
    lines += ' ' + clause;
    lineLength += 1 + clause.length;
  }
  lines += '\r\n';
  return Buffer.from(lines, 'utf-8');
};

MIME.indexOf = function(source, sourceStart, sourceEnd, code) {
  var self = this;
  while (sourceStart < sourceEnd) {
    if (source[sourceStart] === code) return sourceStart;
    sourceStart++;
  }
  return -1;
};

MIME.indexOutsideQuotes = function(source, sourceIndex, sourceLength, code) {
  var self = this;
  var quote = 0;
  while (sourceIndex < sourceLength) {
    if (source[sourceIndex] === 34) {
      quote = (quote === 1) ? 0 : 1;
    } else if (source[sourceIndex] === 92) {
      if (quote === 1 && sourceIndex + 1 < sourceLength) {
        // We are concerned only with codes 34, 92 in a quoted-pair.
        if (
          source[sourceIndex + 1] === 34 ||
          source[sourceIndex + 1] === 92
        ) {
          sourceIndex++;
        }
      }
    } else if (quote === 0 && source[sourceIndex] === code) {
      return sourceIndex;
    }
    sourceIndex++;
  }
  return -1;
};

MIME.isAText = MIME.isAtom = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  if (sourceIndex >= sourceLength) return false;
  while (sourceIndex < sourceLength) {
    if (!self.ATEXT[source[sourceIndex]]) return false;
    sourceIndex++;
  }
  return true;
};

MIME.isAddrSpec = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.4.1 Addr-Spec Specification
  // addr-spec       =   local-part "@" domain
  if (sourceIndex >= sourceLength) return false;
  var index = self.indexOutsideQuotes(source, sourceIndex, sourceLength, 64);
  if (index === -1) return false;
  return (
    self.isLocalPart(source, sourceIndex, index) &&
    self.isDomain(source, index + 1, sourceLength)
  );
};

MIME.isAngleAddr = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.4 Address Specification
  // angle-addr      =   [CFWS] "<" addr-spec ">" [CFWS] / obs-angle-addr
  if (sourceLength - sourceIndex < 2) return false;
  if (source[sourceIndex] !== 60) return false; // <
  if (source[sourceLength - 1] !== 62) return false; // >
  sourceIndex++;
  sourceLength--;
  return self.isAddrSpec(source, sourceIndex, sourceLength);
};

MIME.isDText = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  if (sourceIndex >= sourceLength) return false;
  while (sourceIndex < sourceLength) {
    if (!self.DTEXT[source[sourceIndex]]) return false;
    sourceIndex++;
  }
  return true;
};

MIME.isDomain = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.4.1 Addr-Spec Specification
  // domain          =   dot-atom / domain-literal / obs-domain
  return (
    self.isDotAtom(source, sourceIndex, sourceLength) ||
    self.isDomainLiteral(source, sourceIndex, sourceLength)
  );
};

MIME.isDomainLiteral = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.4.1 Addr-Spec Specification
  // domain-literal  =   [CFWS] "[" *([FWS] dtext) [FWS] "]" [CFWS]

  // N.B.: We do not enforce valid IPv4 or IPv6 addresses here.
  if (sourceLength - sourceIndex < 2) return false;
  if (source[sourceIndex] !== 91) return false; // [
  if (source[sourceLength - 1] !== 93) return false; // ]
  if (sourceLength - sourceIndex === 2) return true;
  sourceIndex++;
  sourceLength--;
  while (sourceIndex < sourceLength) {
    if (
      !self.DTEXT[source[sourceIndex]] &&
      !self.FWS[source[sourceIndex]]
    ) {
      return false;
    }
    sourceIndex++;
  }
  return true;
};

MIME.isDotAtom = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.2.3 Atom
  // dot-atom-text   =   1*atext *("." 1*atext)
  // dot-atom        =   [CFWS] dot-atom-text [CFWS]
  if (sourceIndex >= sourceLength) return false;
  while (sourceIndex < sourceLength) {
    if (!self.ATEXT[source[sourceIndex]]) {
      // Must be a dot (46) if not atext:
      if (source[sourceIndex] !== 46) return false;
      // Dot must be between atext:
      // Do not allow two consecutive dots:
      if (
        sourceIndex - 1 < 0 ||
        sourceIndex + 1 >= sourceLength ||
        source[sourceIndex - 1] === 46 ||
        source[sourceIndex + 1] === 46
      ) {
        return false;
      }
    }
    sourceIndex++;
  }
  return true;
};

MIME.isLocalPart = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.4.1 Addr-Spec Specification
  // local-part      =   dot-atom / quoted-string / obs-local-part

  // RFC 5321 4.1.2 Command Argument Syntax
  // While the above definition for Local-part is relatively permissive,
  // for maximum interoperability, a host that expects to receive mail
  // SHOULD avoid defining mailboxes where the Local-part requires (or
  // uses) the Quoted-string form or where the Local-part is case-
  // sensitive.

  // Note: Gmail rejects a quoted-string local-part in a MAIL FROM: return-path.
  return (
    self.isDotAtom(source, sourceIndex, sourceLength) ||
    self.isQuotedString(source, sourceIndex, sourceLength)
  );
};

MIME.isMailbox = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.4 Address Specification
  // mailbox         =   name-addr / addr-spec
  return (
    self.isNameAddr(source, sourceIndex, sourceLength) ||
    self.isAddrSpec(source, sourceIndex, sourceLength)
  );
};

MIME.isMsgID = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.6.4 Identification Fields
  // msg-id          =   [CFWS] "<" id-left "@" id-right ">" [CFWS]
  // id-left         =   dot-atom-text / obs-id-left
  // id-right        =   dot-atom-text / no-fold-literal / obs-id-right
  // no-fold-literal =   "[" *dtext "]"
  if (sourceLength - sourceIndex < 2) return false;
  if (source[sourceIndex] !== 60) return false; // <
  if (source[sourceLength - 1] !== 62) return false; // >
  sourceIndex++;
  sourceLength--;
  var index = self.indexOf(source, sourceIndex, sourceLength, 64); // @
  if (index === -1) return false;
  if (index === sourceIndex) return false;
  if (index === sourceLength - 1) return false;
  // id-left:
  if (!self.isDotAtom(source, sourceIndex, index)) return false;
  // id-right:
  return (
    self.isDotAtom(source, index + 1, sourceLength) ||
    self.isNoFoldLiteral(source, index + 1, sourceLength)
  );
};

MIME.isNameAddr = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.4 Address Specification
  // name-addr       =   [display-name] angle-addr
  // angle-addr      =   [CFWS] "<" addr-spec ">" [CFWS] / obs-angle-addr
  // display-name    =   phrase
  var index = self.indexOutsideQuotes(source, sourceIndex, sourceLength, 60);
  if (index === -1) return false;
  if (!self.isAngleAddr(source, index, sourceLength)) return false;
  if (index === sourceIndex) return true;
  index--;
  while (index > sourceIndex) {
    if (!self.FWS[source[index]]) break;
    index--;
  }
  return self.isPhrase(source, sourceIndex, index + 1);
};

MIME.isNoFoldLiteral = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.6.4 Identification Fields
  // no-fold-literal =   "[" *dtext "]"
  if (sourceLength - sourceIndex < 2) return false;
  if (source[sourceIndex] !== 91) return false; // [
  if (source[sourceLength - 1] !== 93) return false; // ]
  sourceIndex++;
  sourceLength--;
  return (
    sourceIndex === sourceLength ||
    self.isDText(source, sourceIndex, sourceLength)
  );
};

MIME.isPath = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.6.7 Trace Fields
  // path            =   angle-addr / ([CFWS] "<" [CFWS] ">" [CFWS])
  if (self.isAngleAddr(source, sourceIndex, sourceLength)) return true;
  return (
    sourceLength - sourceIndex === 2 &&
    source[sourceIndex] === 60 &&
    source[sourceLength - 1] === 62
  );
};

MIME.isPhrase = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.2.5 Miscellaneous Tokens
  // word            =   atom / quoted-string
  // phrase          =   1*word / obs-phrase
  return (
    self.isAtom(source, sourceIndex, sourceLength) ||
    self.isQuotedString(source, sourceIndex, sourceLength)
  );
};

MIME.isQContent = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.2.4 Quoted Strings
  // qcontent        =   qtext / quoted-pair
  //
  // quoted-string   =   [CFWS]
  //                     DQUOTE *([FWS] qcontent) [FWS] DQUOTE
  //                     [CFWS]
  if (sourceIndex >= sourceLength) return false;
  while (sourceIndex < sourceLength) {
    // We consider FWS as part of qcontent since FWS is considered part of a
    // quoted-string ([FWS] qcontent).
    if (
      !self.QTEXT[source[sourceIndex]] &&
      !self.FWS[source[sourceIndex]]
    ) {
      if (
        self.isQuotedPair(
          source,
          sourceIndex,
          Math.min(sourceIndex + 2, sourceLength)
        )
      ) {
        sourceIndex++; // Consume second character in quoted-pair.
      } else {
        return false;
      }
    }
    sourceIndex++;
  }
  return true;
};

MIME.isQText = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  if (sourceIndex >= sourceLength) return false;
  while (sourceIndex < sourceLength) {
    if (!self.QTEXT[source[sourceIndex]]) return false;
    sourceIndex++;
  }
  return true;
};

MIME.isQuotedPair = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.2.1 Quoted characters
  // quoted-pair     =   ("\" (VCHAR / WSP)) / obs-qp

  // RFC 5234 B.1 Core Rules
  // VCHAR          =   %x21-7E (33-126 inclusive)
  // WSP            =   SP / HTAB
  if (sourceLength - sourceIndex != 2) return false;
  if (source[sourceIndex] !== 92) return false; // "\"
  return (
    source[sourceIndex + 1] === 9 ||
    source[sourceIndex + 1] === 32 ||
    (source[sourceIndex + 1] >= 33 && source[sourceIndex + 1] <= 126)
  );
};

MIME.isQuotedString = function(
  source,
  sourceIndex = 0,
  sourceLength = source.length
) {
  var self = this;
  // RFC 5322 3.2.4 Quoted Strings
  // quoted-string   =   [CFWS]
  //                     DQUOTE *([FWS] qcontent) [FWS] DQUOTE
  //                     [CFWS]
  if (sourceLength - sourceIndex < 2) return false;
  if (source[sourceIndex] !== 34) return false; // "
  if (source[sourceLength - 1] !== 34) return false; // "
  return (
    sourceLength - sourceIndex === 2 ||
    self.isQContent(source, sourceIndex + 1, sourceLength - 1)
  );
};

MIME.slice = function(source, sourceStart, sourceLength, flags) {
  var self = this;
  // These are algorithmic errors:
  if (sourceStart > sourceLength) throw new Error('sourceStart > sourceLength');
  if (sourceStart < 0) throw new Error('sourceStart < 0');
  if (sourceLength < 0) throw new Error('sourceLength < 0');
  if (flags & self.TRIM) {
    // Adjust sourceStart to remove leading whitespace:
    while (sourceStart < sourceLength && self.FWS[source[sourceStart]]) {
      sourceStart++;
    }
    // Adjust sourceLength to remove trailing whitespace:
    while (sourceLength > 0 && self.FWS[source[sourceLength - 1]]) {
      sourceLength--;
    }
  }
  if (flags & (self.LOWERCASE | self.UPPERCASE)) {
    if (flags & self.LOWERCASE) {
      var range0 = 65;
      var range1 = 90;
      var adjustment = 32;
    } else {
      var range0 = 97;
      var range1 = 122;
      var adjustment = -32;
    }
    var target;
    var targetIndex;
    var targetLength;
    var sourceIndex = sourceStart;
    while (sourceIndex < sourceLength) {
      if (source[sourceIndex] >= range0 && source[sourceIndex] <= range1) {
        if (!target) {
          target = Buffer.alloc(sourceLength - sourceStart);
          targetIndex = source.copy(target, 0, sourceStart, sourceIndex);
          targetLength = target.length;
        }
        target[targetIndex++] = source[sourceIndex] + adjustment;
      } else if (target) {
        target[targetIndex++] = source[sourceIndex];
      }
      sourceIndex++;
    }
    if (target) {
      if (flags & self.ASCII) {
        return target.toString('ascii', 0, targetLength);
      } else {
        return target.slice(0, targetLength);
      }
    }
  }
  if (flags & self.ASCII) {
    return source.toString('ascii', sourceStart, sourceLength);
  } else {
    if (sourceStart === 0 && sourceLength === source.length) return source;
    return source.slice(sourceStart, sourceLength);
  }
};

MIME.CR = function(buffer, index) {
  return index >= 0 && index < buffer.length && buffer[index] === 13;
};

MIME.CRLF = function(buffer, index) {
  var self = this;
  return self.CR(buffer, index) && self.LF(buffer, index + 1);
};

MIME.LF = function(buffer, index) {
  return index >= 0 && index < buffer.length && buffer[index] === 10;
};

MIME.MATCH = function(buffer, index, code) {
  return index >= 0 && index < buffer.length && buffer[index] === code;
};

MIME.Address = function(name, email) {
  var self = this;
  self.name = name;
  self.email = email;
};

MIME.Base64 = require('@ronomon/base64');

MIME.Error = {
  Base64BodyIllegal: "550 Your email had a base64 body containing illegal " +
    "characters (see RFC 2045 6.8 and RFC 4648 3.3).\r\n",
  Base64BodyTruncated: "550 Your email had a base64 body which was " +
    "truncated (see RFC 2045 6.8 and RFC 4648 3.3).\r\n",
  Base64WordIllegal: "550 Your email had a base64 encoded word containing " +
    "illegal characters (see RFC 2045 6.8 and RFC 4648 3.3).\r\n",
  Base64WordTruncated: "550 Your email had a base64 encoded word which was " +
    "truncated (see RFC 2045 6.8 and RFC 4648 3.3).\r\n",
  CharsetIllegal: "550 Your email had an illegal character sequence " +
    "(see RFC 2045 2.2, RFC 2046 4.1.2, RFC 2047 3 and RFC 2231).\r\n",
  CharsetTruncated: "550 Your email had an incomplete character sequence " +
    "(see RFC 2045 2.2, RFC 2046 4.1.2, RFC 2047 3 and RFC 2231).\r\n",
  CharsetUnsupported: "550 Your email had an unsupported character set " +
    "(see RFC 2045 2.2, RFC 2046 4.1.2, RFC 2047 3 and RFC 2231).\r\n",
  CommentUnterminated: "550 Your email had a header with an unterminated " +
    "comment (see RFC 5322 3.2.2).\r\n",
  ContentTransferEncodingUnrecognized: "550 Your email had an unrecognized " +
    "'Content-Transfer-Encoding' mechanism (see RFC 2045 6.1 and 6.4).\r\n",
  ContentType: "550 Your email had an invalid 'Content-Type' header syntax " +
    "(see RFC 2045 5.1).\r\n",
  ContentTypeBoundaryMissing: "550 Your email had a multipart media type " +
    "with a required boundary parameter missing (see RFC 2045 5).\r\n",
  ContentTypeExternalBody: "550 Your email had a 'Content-Type' of " +
    "'message/external-body' (unsupported).\r\n",
  ContentTypePartial: "550 Your email had a 'Content-Type' of " +
    "'message/partial' (unsupported).\r\n",
  ContinuationDuplicate: "550 Your email had a header with a duplicate " +
    "parameter continuation (see RFC 2231).\r\n",
  ContinuationLimit: "550 Your email had a header with too many parameter " +
    "continuations (see RFC 2231).\r\n",
  Date: "550 Your email had an invalid 'Date' header syntax " +
    "(see RFC 5322 3.3).\r\n",
  DateDay: "550 Your email had an invalid 'Date' header 'day' " +
    "(see RFC 5322 3.3).\r\n",
  DateHour: "550 Your email had an invalid 'Date' header 'hour' " +
    "(see RFC 5322 3.3).\r\n",
  DateMinute: "550 Your email had an invalid 'Date' header 'minute' " +
    "(see RFC 5322 3.3).\r\n",
  DateMonth: "550 Your email had an invalid 'Date' header 'month' " +
    "(see RFC 5322 3.3).\r\n",
  DateSecond: "550 Your email had an invalid 'Date' header 'second' " +
    "(see RFC 5322 3.3).\r\n",
  DateZone: "550 Your email had an invalid 'Date' header 'zone' " +
    "(see RFC 5322 3.3).\r\n",
  FromMissing: "550 Your email had a required 'From' header missing " +
    "(see RFC 5322 3.6).\r\n",
  HeaderColonMissing: "550 Your email had a header with a required colon " +
    "between the field name and field body missing (see RFC 5322 2.2).\r\n",
  HeaderCharactersForbidden: "550 Your email had a header containing " +
    "forbidden characters (see RFC 5322 2.2).\r\n",
  HeaderCR: "550 Your email had a header with a CR not followed by a LF " +
    "(see RFC 5322 2.2).\r\n",
  HeaderCRLF: "550 Your email had a header with a CRLF not followed by WSP " +
    "(see RFC 5322 2.2).\r\n",
  HeadersCRLF: "550 Your email had no CRLF between headers and body " +
    "(see RFC 5322 3.5).\r\n",
  HeadersLimit: "550 Your email had headers exceeding the limit of 256 KB.\r\n",
  LineLimit: "550 Your email had a line exceeding the line length limit of " +
    "998 characters excluding CRLF (see RFC 5322 2.1.1).\r\n",
  MultipleContentDisposition: "550 Your email had multiple " +
    "'Content-Disposition' headers (see RFC 5322 3.6).\r\n",
  MultipleContentID: "550 Your email had multiple 'Content-ID' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleContentTransferEncoding: "550 Your email had multiple " +
    "'Content-Transfer-Encoding' headers (see RFC 5322 3.6).\r\n",
  MultipleContentType: "550 Your email had multiple 'Content-Type' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleDate: "550 Your email had multiple 'Date' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleFrom: "550 Your email had multiple 'From' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleInReplyTo: "550 Your email had multiple 'In-Reply-To' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleMessageID: "550 Your email had multiple 'Message-ID' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleReferences: "550 Your email had multiple 'References' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleReplyTo: "550 Your email had multiple 'Reply-To' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleSender: "550 Your email had multiple 'Sender' headers " +
    "(see RFC 5322 3.6).\r\n",
  MultipleSubject: "550 Your email had multiple 'Subject' headers " +
    "(see RFC 5322 3.6).\r\n",
  ParameterAttributeMissing: "550 Your email had a header with a missing " +
    "parameter attribute (see RFC 2045 5.1 and RFC 2183 2).\r\n",
  ParameterMultipleBoundary: "550 Your email had a header with multiple " +
    "boundary parameters (see RFC 2046 5.1.1).\r\n",
  ParameterMultipleCharset: "550 Your email had a header with multiple " +
    "charset parameters (see RFC 2046 4.1.2).\r\n",
  ParameterMultipleFilename: "550 Your email had a header with multiple " +
    "filename parameters (see RFC 2183 2.3).\r\n",
  ParameterMultipleName: "550 Your email had a header with multiple " +
    "name parameters (see RFC 2046 4.5.1).\r\n",
  ParameterValueMissing: "550 Your email had a header with a missing " +
    "parameter value (see RFC 2045 5.1 and RFC 2183 2).\r\n",
  PartBoundaryCharactersForbidden: "550 Your email had a multipart " +
    "boundary parameter containing forbidden characters (see RFC 2046 " +
    "5.1.1).\r\n",
  PartBoundaryEmpty: "550 Your email had an empty multipart boundary " +
    "parameter (see RFC 2046 5.1.1).\r\n",
  PartBoundaryFalsePositiveLimit: "550 Your email had too many false " +
    "positive multipart boundaries (see RFC 2046).\r\n",
  PartBoundaryLimit: "550 Your email had a multipart boundary parameter " +
    "exceeding the limit of 70 characters (see RFC 2046 5.1.1).\r\n",
  PartBoundaryMissing: "550 Your email had a required multipart boundary " +
    "parameter missing (see RFC 2046 5.1.1).\r\n",
  PartBoundaryWSP: "550 Your email had a multipart boundary parameter ending " +
    "with whitespace (see RFC 2046 5.1.1).\r\n",
  PartLimit: "550 Your email had too many multipart parts (see RFC 2046).\r\n",
  PartMissing: "550 Your email had missing multipart parts (see RFC 2046).\r\n",
  QuotedPrintableBodyIllegal: "550 Your email had a quoted-printable body " +
    "containing illegal characters (see RFC 2045 6.7).\r\n",
  QuotedPrintableWordIllegal: "550 Your email had a quoted-printable encoded " +
    "word containing illegal characters (see RFC 2045 6.7).\r\n",
  QuotedStringUnterminated: "550 Your email had a header with an " +
    "unterminated quoted-string (see RFC 5322 3.2.4).\r\n",
  SenderMissing: "550 Your email had multiple 'From' addresses and a " +
    "required 'Sender' header missing (see RFC 5322 3.6.2).\r\n",
  SenderMultipleAddresses: "550 Your email had multiple 'Sender' addresses " +
    "(see RFC 5322 3.6.2).\r\n"
};

MIME.Errors = (function() {
  var errors = {};
  for (var key in MIME.Error) {
    var value = MIME.Error[key];
    errors[value] = key;
  }
  return errors;
})();

MIME.HeaderValueParameters = function(value, parameters) {
  var self = this;
  self.value = value;
  self.parameters = parameters;
};

MIME.Iconv = require('iconv').Iconv;

MIME.Message = function(buffer) {
  var self = this;
  self.buffer = buffer;
  self._body = undefined;
  self._bcc = undefined;
  self._cc = undefined;
  self._contentDisposition = undefined;
  self._contentID = undefined;
  self._contentTransferEncoding = undefined;
  self._contentType = undefined;
  self._date = undefined;
  self._entity = undefined;
  self._filename = undefined;
  self._from = undefined;
  self._headers = undefined;
  self._inReplyTo = undefined;
  self._messageID = undefined;
  self._parts = undefined;
  self._references = undefined;
  self._replyTo = undefined;
  self._sender = undefined;
  self._subject = undefined;
  self._to = undefined;
};

Object.defineProperty(MIME.Message.prototype, 'bcc', {
  get: function() {
    var self = this;
    if (self._bcc) return self._bcc;
    self._bcc = MIME.decodeHeaderAddresses(self.headers['bcc']);
    return self._bcc;
  }
});

Object.defineProperty(MIME.Message.prototype, 'body', {
  get: function() {
    var self = this;
    if (self._body) return self._body;
    self._body = MIME.decodeBody(
      self.entity[1],
      self.contentType,
      self.contentTransferEncoding
    );
    return self._body;
  }
});

Object.defineProperty(MIME.Message.prototype, 'cc', {
  get: function() {
    var self = this;
    if (self._cc) return self._cc;
    self._cc = MIME.decodeHeaderAddresses(self.headers['cc']);
    return self._cc;
  }
});

Object.defineProperty(MIME.Message.prototype, 'contentDisposition', {
  get: function() {
    var self = this;
    if (self._contentDisposition) return self._contentDisposition;
    self._contentDisposition = MIME.decodeHeaderContentDisposition(
      self.headers['content-disposition']
    );
    return self._contentDisposition;
  }
});

Object.defineProperty(MIME.Message.prototype, 'contentID', {
  get: function() {
    var self = this;
    if (self._contentID !== undefined) return self._contentID;
    self._contentID = MIME.decodeHeaderIdentifier(self.headers['content-id']);
    return self._contentID;
  }
});

Object.defineProperty(MIME.Message.prototype, 'contentTransferEncoding', {
  get: function() {
    var self = this;
    if (self._contentTransferEncoding) return self._contentTransferEncoding;
    self._contentTransferEncoding = MIME.decodeHeaderContentTransferEncoding(
      self.headers['content-transfer-encoding']
    );
    return self._contentTransferEncoding;
  }
});

Object.defineProperty(MIME.Message.prototype, 'contentType', {
  get: function() {
    var self = this;
    if (self._contentType) return self._contentType;
    self._contentType = MIME.decodeHeaderContentType(
      self.headers['content-type']
    );
    return self._contentType;
  }
});

Object.defineProperty(MIME.Message.prototype, 'date', {
  get: function() {
    var self = this;
    if (self._date) return self._date;
    self._date = MIME.decodeHeaderDate(self.headers['date']);
    // RFC 5322 3.6 Field Definitions
    // The only required header fields are the origination date field and
    // the originator address field(s).

    // RFC 5321 6.4 Compensating for Irregularities
    // The following changes to a message being processed MAY be applied
    // when necessary by an originating SMTP server, or one used as the
    // target of SMTP as an initial posting (message submission) protocol:
    //
    // o  Addition of a message-id field when none appears
    // o  Addition of a date, time, or time zone when none appears
    // o  Correction of addresses to proper FQDN format
    //
    // The less information the server has about the client, the less likely
    // these changes are to be correct and the more caution and conservatism
    // should be applied when considering whether or not to perform fixes
    // and how. These changes MUST NOT be applied by an SMTP server that
    // provides an intermediate relay function.

    // We do not enforce a Date. We leave this policy decision to higher layers.
    return self._date;
  }
});

Object.defineProperty(MIME.Message.prototype, 'entity', {
  get: function() {
    var self = this;
    if (self._entity) return self._entity;
    self._entity = MIME.decodeEntity(self.buffer);
    return self._entity;
  }
});

Object.defineProperty(MIME.Message.prototype, 'filename', {
  get: function() {
    var self = this;
    if (self._filename !== undefined) return self._filename;
    // RFC 2046 - 4.5.1 Octet-Stream Subtype
    // RFC 1341 also defined the use of a "NAME"
    // parameter which gave a suggested file name to be used if the data
    // were to be written to a file. This has been deprecated in
    // anticipation of a separate Content-Disposition header field, to be
    // defined in a subsequent RFC.

    // For a thorough discussion see:
    // https://mailarchive.ietf.org/
    //   arch/msg/ietf-smtp/KtN0TdoHDayKvKycNbsFD-GB-e4
    self._filename = (
      self.contentDisposition.parameters.filename ||
      self.contentType.parameters.name
    );
    // RFC 2183 2.3 The Filename Parameter
    // The receiving MUA SHOULD NOT respect any directory path information
    // that may seem to be present in the filename parameter. The filename
    // should be treated as a terminal component only.
    if (self._filename !== undefined) {
      self._filename = self._filename.replace(/.*[\/\\]+/g, '').trim();
    }
    return self._filename;
  }
});

Object.defineProperty(MIME.Message.prototype, 'from', {
  get: function() {
    var self = this;
    if (self._from) return self._from;
    self._from = MIME.decodeHeaderAddresses(self.headers['from']);
    // RFC 5322 3.6 Field Definitions
    // The only required header fields are the origination date field and
    // the originator address field(s).
    if (self._from.length === 0) {
      throw new Error(MIME.Error.FromMissing);
    }
    // RFC 5322 3.6.2 Originator Fields
    // The from field consists of the field name "From" and a comma-
    // separated list of one or more mailbox specifications. If the from
    // field contains more than one mailbox specification in the mailbox-
    // list, then the sender field, containing the field name "Sender" and a
    // single mailbox specification, MUST appear in the message.
    if (self._from.length > 1 && !self.sender) {
      throw new Error(MIME.Error.SenderMissing);
    }
    return self._from;
  }
});

Object.defineProperty(MIME.Message.prototype, 'headers', {
  get: function() {
    var self = this;
    if (self._headers) return self._headers;
    var headers = {};
    MIME.decodeHeaders(self.entity[0], headers);
    self._headers = headers;
    return self._headers;
  }
});

Object.defineProperty(MIME.Message.prototype, 'inReplyTo', {
  get: function() {
    var self = this;
    if (self._inReplyTo) return self._inReplyTo;
    self._inReplyTo = MIME.decodeHeaderIdentifiers(self.headers['in-reply-to']);
    return self._inReplyTo;
  }
});

Object.defineProperty(MIME.Message.prototype, 'messageID', {
  get: function() {
    var self = this;
    if (self._messageID !== undefined) return self._messageID;
    self._messageID = MIME.decodeHeaderIdentifier(self.headers['message-id']);
    return self._messageID;
  }
});

Object.defineProperty(MIME.Message.prototype, 'parts', {
  get: function() {
    var self = this;
    if (self._parts) return self._parts;
    if (/^multipart\//i.test(self.contentType.value)) {
      var parts = MIME.decodeParts(
        self.body,
        self.contentType.parameters.boundary
      );
      for (var index = 0, length = parts.length; index < length; index++) {
        parts[index] = new MIME.Message(parts[index]);
      }
      self._parts = parts;
    } else {
      self._parts = [];
    }
    return self._parts;
  }
});

Object.defineProperty(MIME.Message.prototype, 'references', {
  get: function() {
    var self = this;
    if (self._references) return self._references;
    self._references = MIME.decodeHeaderIdentifiers(self.headers['references']);
    return self._references;
  }
});

Object.defineProperty(MIME.Message.prototype, 'replyTo', {
  get: function() {
    var self = this;
    if (self._replyTo) return self._replyTo;
    self._replyTo = MIME.decodeHeaderAddresses(self.headers['reply-to']);
    return self._replyTo;
  }
});

Object.defineProperty(MIME.Message.prototype, 'sender', {
  get: function() {
    var self = this;
    if (self._sender) return self._sender[0];
    self._sender = MIME.decodeHeaderAddresses(self.headers['sender']);
    // RFC 5322 3.6.2 Originator Fields
    // sender = "Sender:" mailbox CRLF
    if (self._sender.length > 1) {
      throw new Error(MIME.Error.SenderMultipleAddresses);
    }
    return self._sender[0];
  }
});

Object.defineProperty(MIME.Message.prototype, 'subject', {
  get: function() {
    var self = this;
    if (self._subject !== undefined) return self._subject;
    self._subject = MIME.decodeHeaderUnstructured(self.headers['subject']);
    return self._subject;
  }
});

Object.defineProperty(MIME.Message.prototype, 'to', {
  get: function() {
    var self = this;
    if (self._to) return self._to;
    self._to = MIME.decodeHeaderAddresses(self.headers['to']);
    return self._to;
  }
});

MIME.QuotedPrintable = require('@ronomon/quoted-printable');

module.exports = MIME;

// S.D.G.
