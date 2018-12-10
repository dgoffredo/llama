const Parse = (function () {
/* Here is the grammar:

    datum  ::=   STRING
            |    NUMBER
            |    SYMBOL
            |    list
            |    quote

    list   ::=   "(" datum* ")"
            |    "[" datum* "]"
            |    "{" datum* "}"

    quote  ::=  QUOTE datum
*/

/* Here are the resulting parse tree nodes:

    {string: ...}  // unquoted and unescaped
    {number: ...}  // the _text_ of the number
    {symbol: ...}  // as a string
    {list: ...}    // as an array
    {quote: ...}   // as another node (e.g. 'foo -> {quote: {symbol: "foo"}})

Note that whitespace tokens are ignored during parsing.
*/

function listParser(suffix, tokens, index) {
    // The idea is to parse (`doParse`) elements until the parser returns
    // `undefined` as its parsed value. This will mean that we've enountered a
    // token for which the parser has no case, which means it's a closing
    // bracket/brace/parenthesis. Then do some error checking to make sure the
    // closing token is as expected, and finally return the array of parsed
    // elements and the following token index.

    return () => {
        const result = [];
        var   parsed, tokenAfter;
        for (;;) {
            [parsed, index] = doParse(tokens, index);
            if (parsed === undefined) {
                break;
            }

            result.push(parsed);
        };

        if (index >= tokens.length) {
            // TODO assert index === tokens.length (has to be true)
            throw new Error(`Reached end without expected "${suffix}"`);
        }

        tokenAfter = tokens[index];
        if (tokenAfter.text !== suffix) {
            throw new Error('Mismatched grouping tokens. Expected a closing ' +
                            `"${suffix}" but found a ${tokenAfter.kind}: ` +
                            tokenAfter.text);
        }

        return [{list: result}, index + 1];
    };
}

function doParse(tokens, index) {
    if (index === tokens.length) {
        return;
    }

    var token = tokens[index],
        other = () => [undefined, index];

    // switch on token kind
    return ({
        string: () => [{string: token.text}, index + 1],
        number: () => [{number: token.text}, index + 1],
        symbol: () => [{symbol: token.text}, index + 1],
        quote:  () => {
            var [quoted, indexAfter] = doParse(tokens, index + 1);
            return [{quote: quoted}, indexAfter];
        },
        openParenthesis: listParser(')', tokens, index + 1),
        openBracket:     listParser(']', tokens, index + 1),
        openBrace:       listParser('}', tokens, index + 1)
    }[token.kind] || other)();
}

function parse(tokens) {
    const notWhitespace        =  token => token.kind !== 'whitespace',
          [parsed, indexAfter] =  doParse(tokens.filter(notWhitespace), 0);

    return parsed;
}

return {parse};

}());

Object.assign(exports, Parse);
