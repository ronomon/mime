# mime
Fast, robust, standards-compliant MIME decoder. Ships with extensive tests and
fuzz tests.

## Installation
```
npm install @ronomon/mime
```

## Fast

* Decodes on demand only as much as necessary to access a particular property.
For example, if you need `mime.subject`, then `MIME` will search for the `CRLF`
pair marking the end of the headers and decode only the `subject` header,
without decoding any other headers and without decoding the body. This works
well with the first few layers of spam defenses, which often only need to decode
particular headers to reject an email.

* Caches decoded properties for subsequent use.

* Uses native fuzz-tested C++ [Base64](https://github.com/ronomon/base64) and [Quoted-Printable](https://github.com/ronomon/quoted-printable) bindings.
`MIME`'s Base64 decoder in particular was developed for decoding wrapped Base64
[more efficiently](https://github.com/ronomon/base64#motivation) and detecting
obvious corruption and character truncation.

* Uses custom lookup tables to minimize the cost of branching through too many
conditionals when decoding.

* Avoids unnecessary string and buffer allocations. Algorithms accept and work
with buffers directly, and allocate and copy buffers only when necessary.

* Avoids regular expression decoders.

## Robust

* Provides detailed error messages which refer to the relevant RFCs to assist
debugging, and which can be used directly as part of an SMTP `reply`.

* Accepts `CRLF` and `LF` line-endings (which are common) but not `CR`
line-endings (which are rare).

* Accepts illegal transport padding frequently added by intermediaries (e.g.
within the angle brackets of a `msg-id` or `angle-addr`, and between tokens in
an `encoded-word`).

* Decodes a variety of malformed but common mailbox syntaxes (e.g. no angle
brackets around the `addr-spec`, with a `display-name` present on the left or
right).

* Removes balanced single quotes around the `display-name` or `addr-spec` in an
email address (sometimes added by Outlook).

* Decodes `encoded-words` not separated by `WSP`.

* Decodes `encoded-words` with empty `encoded-text`.

* Decodes `encoded-words` found in `Content-Type` and `Content-Disposition`
parameters (used by Outlook and Gmail contrary to [RFC 2047 5 Use of
encoded-words in message headers](https://tools.ietf.org/html/rfc2047#section-5)).

* Removes any directory path components from an attachment name or filename
(when accessed via `mime.filename`, see Usage below).

* Decodes `msg-ids` not separated by whitespace or commas (i.e. separated only
by angle brackets).

* Rejects unrecognized `Content-Transfer-Encoding` mechanisms contrary to
[RFC 2045 6.4](https://tools.ietf.org/html/rfc2045#section-6.4) (e.g. anything
other than `7bit`, `8bit`, `binary`, `base64`, or `quoted-printable`). This is
to avoid accepting responsibility for content which will not display correctly,
if at all. In contrast, the spec advocates silently altering the `Content-Type`.

* Rejects malicious `RFC 2231` continuation indices designed to cause
overallocation.

* Rejects Base64 data containing illegal characters (anything which is not a
valid Base64 or whitespace character, e.g. null bytes which could cause security
issues).

* Rejects Base64 data which is clearly truncated (as opposed to just missing
padding).

* Corrects Quoted-Printable data containing illegal characters (anything which
is not a valid Quoted-Printable character, e.g. null bytes which could cause
security issues).

* Rejects illegal character sequences according to the specified `charset`.

* Rejects truncated character sequences according to the specified `charset`.

* Normalizes and aliases a variety of character sets to the canonical character
set, (e.g. `ks_c_5601-1987` is sometimes used by Outlook and is aliased to
`CP949` - Korean, otherwise the characters would decode from the wrong character
set and be unintelligible).

* Rejects unknown character sets not supported by
[`iconv`](https://github.com/bnoordhuis/node-iconv).

* Decodes `text/*` body parts to `UTF-8` buffers if the `Content-Type` indicates
that the body is encoded in any other character set.

* Rejects unterminated `comments` and `quoted-strings`.

* Rejects invalid `Content-Type` syntax.

* Detects missing multipart parts (e.g. no terminating boundary delimiter).

* Rejects dangerous `message/external-body` and `message/partial` media types.

* Decodes a variety of time zones and year formats.

* Accepts missing time zone and assumes UTC to support email clients such as Blackberry which do not provide the required time zone in the `Date` header.

* Rejects invalid `Date` header syntax.

* Rejects missing `From` header.

* Rejects headers containing forbidden characters.

* Rejects folded header lines which exceed the 998 line length limit, but only
after allowing for clients such as Outlook.com which exclude the
`field-name` and `colon` from their character count, and which mistake the limit
to be 1000 characters excluding the CRLF. The limit is in fact 998 characters
excluding the CRLF.

* Rejects multipart boundaries containing forbidden characters.

* Rejects malicious data designed to cause CPU-intensive decoding and stack
overflows.

* Rejects malicious multiple occurrences of crucial headers and parameters,
which could cause clients to render an email differently from that scanned by
anti-virus software.

## Standards-Compliant

* [RFC 5322](https://tools.ietf.org/html/rfc5322) - Internet Message Format.

* [RFC 2045](https://tools.ietf.org/html/rfc2045) - Multipurpose Internet Mail
Extensions (MIME) Part One: Format of Internet Message Bodies.

* [RFC 2046](https://tools.ietf.org/html/rfc2046) - Multipurpose Internet Mail
Extensions (MIME) Part Two: Media Types.

* [RFC 2047](https://tools.ietf.org/html/rfc2047) - MIME (Multipurpose Internet
Mail Extensions) Part Three: Message Header Extensions for Non-ASCII Text.

* [RFC 2183](https://tools.ietf.org/html/rfc2183) - The Content-Disposition
Header Field.

* [RFC 2231](https://tools.ietf.org/html/rfc2231) - MIME Parameter Value and
Encoded Word Extensions: Character Sets, Languages, and Continuations.

## Usage

```javascript
var MIME = require('@ronomon/mime');

// Instantiate a new mime instance (no decoding will take place):

var mime = new MIME.Message(buffer);

// Decoding will take place when the following getter properties are accessed.
// These getter properties may throw an exception for malformed MIME data.

mime.headers;             // { 'received': [<Buffer>] }
mime.body;                // <Buffer>

mime.from;                // [ { name: <String>, email: <String> } ]
mime.sender;              //   { name: <String>, email: <String> } / undefined
mime.replyTo;             // [ { name: <String>, email: <String> } ]
mime.to;                  // [ { name: <String>, email: <String> } ]
mime.cc;                  // [ { name: <String>, email: <String> } ]
mime.bcc;                 // [ { name: <String>, email: <String> } ]

mime.messageID;           //   <String> / undefined
mime.references;          // [ <String>, <String> ]
mime.inReplyTo;           // [ <String>, <String> ]

mime.date;                // <Unix Timestamp Integer> / undefined
mime.subject;             // <String>

mime.contentDisposition;  // { value: <String>, parameters: {} }
mime.contentType;         // { value: <String>, parameters: {} }
mime.contentID;           // <String> / undefined
mime.filename;            // <String> / undefined

mime.parts;               // [ <MIME.Message>, <MIME.Message> ]
```

## Tests

To run all included tests and fuzz tests:
```
node test.js
```
