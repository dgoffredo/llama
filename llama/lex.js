define([], function () {

const regexes = [
    {string:           /"(?:[^"\\]|\\.)*"/},
    {openParenthesis:  /\(/},
    {closeParenthesis: /\)/},
    {openBracket:      /\[/},
    {closeBracket:     /\]/},
    {openBrace:        /\{/},
    {closeBrace:       /\}/},
    {whitespace:       /\s+/},
    {number:           /\d[^;'\s()[\]{}]*/},
    {symbol:           /[^;'\d\s()[\]{}][^;'\s()[\]{}]*/},
    {quote:            /'/},
    {comment:          /;[^\n]*(?:\n|$)/}
].map(entry => {
    const [kind]  = Object.keys(entry),
          pattern = entry[kind].source;
    return {kind, pattern};
});

const regex =
    new RegExp(regexes.map(entry => `(${entry.pattern})`).join('|'), 'g');

function rawTokens(input) {
    var matches,
        matchString,
        which,
        previousEnd = 0,
        result = [],
        defined = x => x !== undefined;

    regex.lastIndex = 0;

    while ((matches = regex.exec(input)) !== null) {
        matchString = matches[0];
        which       = Array.from(matches).slice(1).findIndex(defined);
        if (matches.index !== previousEnd) {
            throw new Error(`Text from offset ${previousEnd} to ` +
                            `${matches.index} does not form a valid ` +
                            `token. The text is: ` +
                            input.slice(previousEnd, matches.index));
        }

        previousEnd = matches.index + matchString.length;

        result.push({kind: regexes[which].kind, text: matchString});           
    }

    if (previousEnd !== input.length) {
        throw new Error(`Text from offset ${previousEnd} until the end ` +
                        'does not match any tokens: '+
                        input.slice(previousEnd, input.length));
    }

    return result;
};

const descapes = {
    'a': '\a',
    'b': '\b',
    'n': '\n',
    'r': '\r',
    't': '\t'
};

function destring(input) {
    const inside = input.slice(1, input.length - 1);
    
    return inside.replace(/\\(.)/g, (_, char) => descapes[char] || char);
}

function tokens(input) {
    return rawTokens(input).map(token => {
        if (token.kind === 'string') {
            return {kind: token.kind, text: destring(token.text)};
        }
        else {
            return token;
        }
    });
}

return {tokens};

});