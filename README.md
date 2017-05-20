# mime
Fast, robust, compliant MIME decoder. Ships with extensive tests and fuzz tests.

## Standards Compliant
* [RFC 5322](https://tools.ietf.org/html/rfc5322) - Internet Message Format.

* [RFC 2045](https://tools.ietf.org/html/rfc2045) - Multipurpose Internet Mail Extensions (MIME) Part One: Format of Internet Message Bodies.

* [RFC 2046](https://tools.ietf.org/html/rfc2046) - Multipurpose Internet Mail Extensions (MIME) Part Two: Media Types.

* [RFC 2047](https://tools.ietf.org/html/rfc2047) - MIME (Multipurpose Internet Mail Extensions) Part Three: Message Header Extensions for Non-ASCII Text.

* [RFC 2183](https://tools.ietf.org/html/rfc2183) - The Content-Disposition Header Field.

* [RFC 2231](https://tools.ietf.org/html/rfc2231) - MIME Parameter Value and Encoded Word Extensions: Character Sets, Languages, and Continuations.

## Installation
```
npm install @ronomon/mime
```

## Usage
#### Decoding
`MIME` decodes on demand only as much as necessary to access a particular property. For example, if you need `mime.subject`, then `MIME` will search for the end of the headers, and then decode only the `subject`, and not all other headers, or the body.

```javascript
var MIME = require('@ronomon/mime');
var mime = new MIME.Message(buffer);

mime.headers;
mime.body;

mime.from;
mime.to;
mime.cc;
mime.bcc;
mime.date;
mime.subject;
mime.parts;
```

## Tests
To run all included tests:
```
node test.js
```
