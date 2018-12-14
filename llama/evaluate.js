
const Evaluate = (function () {
/* Here are the possible things:

    {string: ...}     // remains verbatim
    {number: ...}     // remains verbatim
    {symbol: ...}     // looked up in the environment; quoted if not found
    {list: ...}       // evaluate first element, lookup, etc.
    {quote: ...}      // remains verbatim

    {macro: {
        procedure: ...
    }
    {procedure: {
        pattern: ...
        body ...
    }  
    {procedure: function (env, ...args) {...}}
*/

const json = JSON.stringify;

function isObject(value) {
    // https://stackoverflow.com/a/4320789
    return Object.prototype.toString.call(value) === '[object Object]';
}

function deepEqual(a, b) {
    // just an optimization
    if (typeof a !== typeof b) {
        return false;
    }

    // types whose values can be compared directly
    if (a === undefined || 
        a === null || 
        ['boolean', 'number', 'string'].indexOf(typeof a) !== -1) {
        return a === b;
    }

    // dates
    if (a instanceof Date && b instanceof Date) {
        return a.valueOf() === b.valueOf();
    }

    // arrays
    if (Array.isArray(a) && Array.isArray(b)) {
        return a.length === b.length &&
               a.every((aMember, index) => deepEqual(aMember, b[index]));
               
    }

    // objects like object literals
    if (isObject(a) && isObject(b)) {
        const aKeys = Object.keys(a);

        return aKeys.sort() === Object.keys(b).sort() &&
               aKeys.every(aKey => deepEqual(a[aKey], b[aKey]));
    }

    // Ran out of ideas. Compare identity.
    return a === b;
}

function keyValue(object) {
    // TODO assert that there is exactly one key.
    const key = Object.keys(object)[0];

    return [key, object[key]];
}

function sexpr(datum) {
    const [type, value] = keyValue(datum);

    if (type === 'symbol' || type === 'number') {
        return value;
    }
    if (type === 'string') {
        return json(value);
    }
    if (type === 'quote') {
        return "'" + sexpr(value);
    }
    if (type === 'list') {
        return '(' + value.map(sexpr).join(' ') + ')';
    }
    if (type === 'splice') {
        return value.map(sexpr).join(' ');
    }
    if (type === 'procedure') {
        if (typeof value === 'function') {
            return '(lambda #native)';
        }
        const {pattern, body} = value;
        return '(lambda ' + sexpr(pattern) + ' ' + sexpr(body) + ')';  // TODO?
    }
    if (type === 'macro') {
        if (typeof value.procedure === 'function') {
            return '(macro #native)';
        }
        const {pattern, body} = value.procedure;
        return '(macro ' +  sexpr(pattern) + ' ' + sexpr(body) + ')';  // TODO?
    }

    // TODO Use an assert above instead.
    throw new Error(`Unrecognized node type ${json(type)}: ${json(value)}`);
}

function lookup(symbolName, environment) {
    const value = environment.bindings[symbolName];
    if (value !== undefined) {
        return value;
    }
    else if (environment.parent === undefined) {
        return undefined;
    }
    else  {
        return lookup(symbolName, environment.parent);
    }
}

function checkEllipsis(arrayPattern) {
    // Return whether the specified array uses the ellipsis ("...") correctly
    // as would be used in a procedure argument pattern. If ellipses are used
    // correctly, return `true`. If ellipses are used but incorrectly, throw an
    // `Error`. If ellipsis are not used at all, return `false`. Note that this
    // function checks only `arrayPattern` for use of ellipsis, but not any of
    // its elements.

    // TODO: assert that `Array.isArray(arrayPattern)`
    if (arrayPattern.length === 0) {
        return false;
    }

    if (arrayPattern.slice(0, -1).find(datum => datum.symbol === '...')) {
        throw new Error('Improper use of "..." in pattern. "..." must appear ' +
                        'only at the end of a list, but here it appears ' +
                        `elsewhere: ${json(arrayPattern)}`);
    }
    
    return arrayPattern[arrayPattern.length - 1].symbol === '...';
}

function bindingsFromMatch(pattern, subject, bindings) {
    // Insert into `bindings` variable value bindings deduced by matching
    // `subject` against `pattern`, and return `bindings`. This function treats
    // the `...` symbol specially in `pattern` to mean "zero or more of" the
    // subpattern immediately to its left at the end of a list. Variables
    // appearing within a subpattern with N levels of `...` are bound as arrays
    // nested in arrays `N` levels deep, e.g. the pattern
    //
    //    (foo (bar baz ...) ...)
    //
    // given the subject:
    //
    //    (hello (names Bob George) (ages 23 57) (nations usa uk))
    //
    // would deduce bindings like the following (here without node types):
    //
    //     {
    //         foo: hello,
    //         bar: [names, ages, nations],
    //         baz: [[Bob, George], [23, 57], [usa, uk]]
    //     }

    bindings = bindings || {};

    const [patternType, patternValue] = keyValue(pattern),
          [subjectType, subjectValue] = keyValue(subject);

    // If the pattern is something literal, then whatever it matches has to be
    // exactly the same.
    if (['quote', 'number', 'string'].indexOf(patternType) !== -1 &&
        // compare type in addition to value
        !deepEqual(pattern, subject)) {
        throw new Error(`The value parsed as ${json(subject)} does not match ` +
                        `the literal pattern ${json(pattern)}.`);
    }

    // If the pattern is a symbol, then just bind the subject to that name.
    if (patternType === 'symbol') {
        bindings[patternValue] = subject;
        return bindings;
    }

    // TODO assert patternType === 'list' (has to be true)

    if (subjectType !== 'list') {
        throw new Error(`Pattern contains a list ${json(patternValue)}, but ` +
                        `value parsed is a ${subjectType}: ${json(subject)}`);
    }

    if (checkEllipsis(patternValue)) {
        // This pattern list ends in "...", so special consideration must be
        // taken for the "zero or more of" behavior.
        const unaffectedEnd     = patternValue.length - 2,
              unaffected        = patternValue.slice(0, unaffectedEnd),
              unaffectedSubject = subjectValue.slice(0, unaffected.length),  // AAUUUGHHHH!!!!
              affected          = patternValue[unaffectedEnd],
              affectedSubject   = subjectValue.slice(unaffected.length);

        // The parts unaffected by the "...", e.g. `foo bar` in
        // `(foo bar baz ...)`, can be treated normally.
        bindingsFromMatch({list: unaffected},
                          {list: unaffectedSubject},
                          bindings);

        // The part affected by the "...", e.g. `baz` in `(foo bar baz ...)`,
        // needs special treatment.
        affectedSubject.forEach(affectedSubjectPart => {
            const bindingsThisTime =
                bindingsFromMatch(affected, affectedSubjectPart, {});

            // Append the bound values to _arrays_ by the same name in bindings.
            Object.keys(bindingsThisTime).forEach(name => {
                const value  = bindingsThisTime[name];
                var   values = bindings[name];

                if (values === undefined) {
                    bindings[name] = values = {list: []};
                }

                values.list.push(value);
            });
        });
    }
    else {
        // No ellipsis, so just match per element.
        if (subjectValue.length !== patternValue.length) {
            const difference = subjectValue.length < patternValue.length ?
                               'shorter' : 'longer';
            throw new Error(`Parsed value ${json(subject)} is ` +
                            `${json(difference)} than, and thus doesn't ` +
                            `match, the pattern ${json(pattern)}.`);
        }

        patternValue.forEach((patternMember, i) =>
            bindingsFromMatch(patternMember, subjectValue[i], bindings));
    }

    return bindings;
}

function deduceBindings(pattern, args) {
    return bindingsFromMatch(pattern, {list: args});
}

function apply(procedure, args, environment) {
    if (typeof procedure === 'function') {
        // Built-in procedures get executed right here in JS, with the
        // environement as their first argument.
        return procedure(environment, ...args)
    }
    else {
        // User-(or macro)-defined procedures get their bindings deduced and
        // then have their bodies evaluated in an environment containing those
        // bindings.
        const {pattern, body} = procedure;

        return evaluate(body, {
            parent:   environment, 
            bindings: deduceBindings(pattern, args)
        });
    }
}

function flattenSplices(array) {
    return array.reduce((result, item) => {
        const [type, inside] = keyValue(item);
        if (type === 'splice') {
            result.push(...inside);
        }
        else {
            result.push(item);
        }
        return result;
    }, []);
}

function evaluate(datum, environment) {
    const [key, value] = keyValue(datum),
          listOrSplice = whichOne => () => {

        if (value.length === 0) {
            return datum;
        }

        const first          = evaluate(value[0], environment),
              rest           = value.slice(1),
              [type, inside] = keyValue(first),
              recur          = arg => evaluate(arg, environment),
              plainList      = () => ({
                  [whichOne]: flattenSplices([first, ...rest.map(recur)])
                });
       
        // switch on `type`
        return ({
            macro: () => {
                // A macro is a procedure invoked with unevaluated
                // arguments, and then the resulting expression is
                // evaluated.
                const {procedure} = inside;
                return recur(apply(procedure, rest, environment));
            },
            procedure: () => {
                // A procedure's arguments are evaluated, and then applied
                // to the procedure. Whatever it returns is the resulting
                // value.
                const procedure = inside;
                return apply(procedure, 
                             flattenSplices(rest.map(recur)),
                             environment);
            }
        }[type] || plainList)();
    };

    // switch on `key`
    return ({
        symbol: () => {
            const result = lookup(value, environment);
            if (result === undefined) {
                return {quote: datum};
            }
            else {
                return result;
            }
        },
        list:   listOrSplice('list'),
        splice: listOrSplice('splice')
    }[key] || (() => datum))();
}

return {
    evaluate
};

}());

// for node.js
try {
    Object.assign(exports, Evaluate);
}
catch (e) {
}