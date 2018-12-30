define(['./sexpr', './assert', './deep'], function (Sexpr, Assert, Deep) {
/*
This module implements the `json` macro and its helper procedure. For example,

    (let ([word "hello"] [bar "ignored"])    
      (json {
          "foo": [1, 2, null, {bar: word}]
      }))

evaluates to

    "{
        \"foo\": [1, 2, null, {\"bar\": \"hello\"}]
    }"

Here's another example input:

    (let ([hello "ignored"] [foo "keyyy"] [bar 34])
      (pml:json
        (json {
            hello: "world",
            "thing": [1, 2, 78.9],
            [foo]: (conc (repeat 10 "wakka")),
            "last": bar
        })))
*/

const {sexpr, typeValue} = Sexpr,
      {assert}           = Assert,
      {isObject}         = Deep;

const jsonifyList = datum => {
    const [type, value] = typeValue(datum);

    assert.deepEqual(() => type, () => 'list');

    if (value.length % 2) {
        throw new Error('Since an object is key/value pairs, it must ' +
                        'have an even number of elements, but found ' +
                        `object with ${value.length} elements: ` +
                        sexpr(value));
    }

    // `["foo", "bar", "1", 2]` --> `{"foo": "bar", "1": 2}`
    const processPair = (result, key, value, ...rest) => {
        if (key === undefined) {
            return result;
        }

        var computedKey = jsonify(key);
        if (Array.isArray(computedKey)) {
            if (computedKey.length !== 1) {
                throw new Error('JSON computed property names must ' +
                                'contain only one element, but ' +
                                `encountered ${computedKey.length}: ` +
                                JSON.stringify(computedKey));
            }
            computedKey = computedKey[0];
        }

        result[computedKey] = jsonify(value);
        
        return processPair(result, ...rest);
    };
    
    return processPair({}, ...value);
};

// In order to support the JSON stringification of numbers that don't fit in
// a javascript `Number`, each numeric datum is instead transformed into an
// object `{[numberProperty]: stringVersionOfNumber}`. Our `stringify` function
// then knows to look for this property and serialize the number string
// unquoted (like a normal number would be).
// This property name is a UUID that I generated using python3.6's `uuid4`
// function from its `uuid` module. This means that if you read this source
// code, you can trick this module into printing as a number something that is
// not a number. So, don't do that.
const numberProperty = 'number-tag:252bcfbb-4368-4476-a094-46544053bbe4';

const jsonify = datum => {
    // This procedure interprets its argument as a JSON value and returns that
    // value as a javascript object ready for stringification. The bracket
    // flavor ("suffix") of lists matters here.
    //
    //     Llama Input                    JSON Output
    //     -----------                    -----------
    //     "string"                       "string"
    //     42                             42
    //     null                           null
    //     [x y z ...]                    [x, y, z, ...]
    //     {"key1" value1 "key2" value2}  {"key1": value1, "key2": value2}

    const recur         = jsonify,
          [type, value] = typeValue(datum);

    switch (type) {
    case 'string':
        return value;
    case 'number':
        return {[numberProperty]: value};
    case 'symbol':
        if (value !== 'null') {
            throw new Error('Symbols (words) are not allowed within JSON, ' +
                            'except for null, but encountered: ' +
                            value);
        }
        return null;
    case 'quote':
        return recur(value);
    default:
        // Can't be a splice, procedure, or macro, because they're evaluated
        // before arguments are applied.
        assert.deepEqual(() => type, () => 'list');
        switch (datum.suffix) {
        case ')':
            throw new Error('JSON cannot contain parenthesized lists, but ' +
                            `encountered: ${sexpr(datum)}`);
        case ']':  // JSON array
            return value.map(recur);
        default:   // JSON object
            assert.deepEqual(() => datum.suffix, () => '}');
            return jsonifyList(datum);
        }              
    }
};

const stringify = jsValue => {
    // Return the same thing that `JSON.stringify(jsValue)` would, except
    // handle numbers differently so that javascript's `Number` type is not
    // involved, thus allowing for arbitrary numbers instead of only those
    // representable in IEEE double precision.

    if (isObject(jsValue)) {
        const numberValue = jsValue[numberProperty];
        if (numberValue !== undefined) {
            return jsValue[numberProperty];
        }

        return '{' + 
               Object.keys(jsValue).map(key =>
                   JSON.stringify(key) + ':' + stringify(jsValue[key]))
               .join(',') + 
               '}';
    }

    if (Array.isArray(jsValue)) {
        return '[' + jsValue.map(stringify).join(',') + ']';
    }

    return JSON.stringify(jsValue);
};

const jsonifyAndStringify = (environment, datum) => {
    return {string: stringify(jsonify(datum))};
};

const notColonSymbol = datum => {
    const unquoted = {symbol: ':'},
          quoted   = {quote: unquoted};
    
    return !Deep.equal(datum, unquoted) && !Deep.equal(datum, quoted);
};

const convertUnquotedPropertyName = datum => {
    const [type, value] = typeValue(datum),
          recur         = convertUnquotedPropertyName;

    switch (type) {
        case 'quote':
            return {quote: recur(value)};
        case 'symbol':
            if (value.endsWith(':')) {
                // Trim the ":" off, and convert the symbol to a string.
                return {string: value.slice(0, -1)};
            }
        default:
            // We don't have to worry about lists and splices here, because
            // `removeColonsFromObjects` will recur on each element returned by
            // this function anyway.
            return datum;
    }
};

const quoteNull = datum => {
    const [type, value] = typeValue(datum);

    if (type === 'symbol' && value === 'null') {
        return {quote: datum};
    }

    return datum;
};

const removeColonsFromObjects = datum => {
    // The macro has three jobs:
    //
    // 1. Remove separating colon symbols from object literals.
    // 2. Stringify symbols ending in colons within object literals (stripping
    //    the trailing colon as well).
    // 3. Quote unquoted appearances of `null`, so that `null` always means
    //    `null` in a `json` form.

    const [type, value] = typeValue(datum),
          recur         = removeColonsFromObjects;

    // Keep in mind that since we're being called in macro evaluation order,
    // our argument has not been evaluated, and so it can contain things like
    // procedures, macros, and splices.
    //
    // There are four cases to consider.
    //
    // 1.  The datum is a quote. In this case, recur on what's inside the quote,
    //     preserving the quote-ness.
    // 2.  The datum is a splice. Just map outselves over the splice.
    // 3a. The datum is a list whose "suffix" is "}". This means that we are to
    //     interpret the list as a JSON object, and so we need to transform
    //     (map) the list in such a way to handle the two cases explained at the
    //     top of this function.
    // 3b. The datum is a list whose "suffix" is not "}", i.e. its suffix is
    //     either ")" or "]". This means that the list is array-like or
    //     procedure-like, and we can just map ourselves over the list,
    //     preserving the "suffix".
    // 4.  The datum is not a list, a splice, or a quote. In this case, pass it
    //     through.

    switch (type) {
    // 1:
    case 'quote':
        return {quote: recur(value)};
    // 2:
    case 'splice':
        return {
            splice: value.map(recur)
        };
    case 'list':
        return {
            list:   datum.suffix === '}'
                    // 3a:
                  ? value.filter(notColonSymbol)
                         .map(convertUnquotedPropertyName)
                         .map(recur)
                    // 3b:
                  : value.map(recur),
            suffix: datum.suffix
        };
    // 4:
    default:
        return quoteNull(datum);
    }
};

const jsonMacroProcedure = (environment, ...args) => {
    // The macro has four jobs:
    //
    // 1. Remove separating colon symbols from object literals.
    // 2. Stringify symbols ending in colons within object literals (stripping
    //    the trailing colon as well).
    // 3. Quote unquoted appearances of `null`, so that `null` always means
    //    `null` in a `json` form.
    // 4. Return a form that is a procedure invocation that will (after
    //    argument evaluation) further work the input into a JSON string.
   
    if (args.length !== 1) {
        throw new Error('"json" macro requires exactly one argument, but was ' +
                        `called with ${args.length}: ${sexpr(args)}`);
    }

    const preDatum  = args[0],  // "pre" in the sense of "before processsing"
          postDatum = removeColonsFromObjects(preDatum);

    // Return a form (list) that is the `jsonifyAndStringify` procedure being
    // applied to `postDatum`. `postDatum` will be evaluated by the evaluator,
    // and then `jsonifyAndStringify` will turn the result into a JSON string.
    return {list: [{procedure: jsonifyAndStringify}, postDatum]};
};

return {jsonMacroProcedure};

});