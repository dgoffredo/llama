define(['./sexpr', './assert', './deep'], function (Sexpr, Assert, Deep) {
/* Here are the possible things:

    {string: ...}     // remains verbatim
    {number: ...}     // remains verbatim
    {symbol: ...}     // looked up in the environment; quoted if not found
    {list: ...}       // evaluate first element, lookup, etc.
    {quote: ...}      // remains verbatim

    {splice: ...}     // splice into enclosing list

    {macro: {           // procedure applied before its arguments are evaluated
        procedure: ...
    }
    {procedure: {       // pattern-matching procedure
        pattern: ...
        body: ...
        definitionEnvironment?: ...
    }
    {procedure: function (env, ...args) {...}}  // intrinsic procedure

These "possible things" must be kept up to date with the `typeValue` function,
defined in `sexpr.js`.
*/

const {typeValue, sexpr} = Sexpr,
      {assert}          = Assert;

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

    assert(() => Array.isArray(arrayPattern));

    if (arrayPattern.length === 0) {
        return false;
    }

    if (arrayPattern.slice(0, -1).find(datum => datum.symbol === '...')) {
        throw new Error('Improper use of "..." in pattern. "..." must appear ' +
                        'only at the end of a list, but here it appears ' +
                        `elsewhere: ${sexpr(arrayPattern)}`);
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

    const [patternType, patternValue] = typeValue(pattern),
          [subjectType, subjectValue] = typeValue(subject);

    
    // If the pattern is something literal, then whatever it matches has to be
    // exactly the same.
    if (['quote', 'number', 'string'].indexOf(patternType) !== -1) {
        // Compare both type and value, but not the whole nodes, because we
        // want, e.g., `{}` to be equal to `[]` (even though they have different
        // "suffix" properties).
        if (!Deep.equal([patternType, patternValue],
                        [subjectType, subjectValue])) {
            throw new Error(`The value ${sexpr(subject)} does not match the ` +
                            `literal pattern ${sexpr(pattern)}.`);
        }

        return bindings;
    }

    // If the pattern is a symbol, then just bind the subject to that name.
    if (patternType === 'symbol') {
        bindings[patternValue] = subject;
        return bindings;
    }

    assert.deepEqual(() => patternType, () => "list");

    if (subjectType !== 'list') {
        throw new Error(`Pattern contains a list ${sexpr(patternValue)}, but ` +
                        `value parsed is a ${subjectType}: ${sexpr(subject)}`);
    }

    if (checkEllipsis(patternValue)) {
        // This pattern list ends in "...", so special consideration must be
        // taken for the "zero or more of" behavior.
        bindingsFromListMatchEllipsis(patternValue, subjectValue, bindings);
    }
    else {
        // No ellipsis, so just match per element.
        bindingsFromListMatchNoEllipsis(patternValue, subjectValue, bindings);
    }

    return bindings;
}

function bindingsFromListMatchEllipsis(patternValue, subjectValue, bindings) {
    // See `bindingsFromMatch`.

    // This pattern list ends in "...", so special consideration must be
    // taken for the "zero or more of" behavior.
    const unaffectedEnd     = patternValue.length - 2,
          unaffected        = patternValue.slice(0, unaffectedEnd),
          unaffectedSubject = subjectValue.slice(0, unaffected.length),
          affected          = patternValue[unaffectedEnd],
          affectedSubject   = subjectValue.slice(unaffected.length);

    // The parts unaffected by the "...", e.g. `foo bar` in `(foo bar baz ...)`,
    // can be treated normally.
    bindingsFromMatch({list: unaffected},
                      {list: unaffectedSubject},
                      bindings);

    // The part affected by the "...", e.g. `baz` in `(foo bar baz ...)`, needs
    // special treatment.
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

function bindingsFromListMatchNoEllipsis(patternValue, subjectValue, bindings) {
    // See `bindingsFromMatch`.

    // No ellipsis, so just match per element.
    if (subjectValue.length !== patternValue.length) {
        const difference = subjectValue.length < patternValue.length ?
                            'shorter' : 'longer';
        throw new Error(`Parsed value ${sexpr(subjectValue)} is ` +
                        `${difference} than, and thus doesn't match, the ` +
                        `pattern ${sexpr(patternValue)}.`);
    }

    patternValue.forEach((patternMember, i) =>
        bindingsFromMatch(patternMember, subjectValue[i], bindings));
}

function deduceBindings(pattern, args) {
    return bindingsFromMatch(pattern, {list: args});
}

function apply(procedure, args, environment) {
    if (typeof procedure === 'function') {
        // Built-in procedures get executed right here in JS, with the
        // environment as their first argument.
        return procedure(environment, ...args);
    }
    else {
        // User-(or macro)-defined procedures get their bindings deduced and
        // then have their bodies evaluated in an environment containing those
        // bindings.
        const {pattern, body, definitionEnvironment} = procedure;

        // If `definitionEnvironment` is defined, then use it as the parent
        // environment instead of `environment`.  This happens in
        // procedure-style procedures, where free variables refer to their
        // definitions in the environment where the procedure was _defined_.
        // Macro-style procedures, on the contrary, don't define
        // `definitionEnvironment`, and so free variables in macros are
        // resolved at the call site.
        return evaluate(body, {
            parent:   definitionEnvironment || environment,
            bindings: deduceBindings(pattern, args)
        });
    }
}

function flattenSplices(array) {
    return array.reduce((result, item) => {
        const [type, inside] = typeValue(item);
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
    const result = evaluate_(datum, environment);
    // console.log(`evaluate\nbefore: ${sexpr(datum)}\nafter: ${sexpr(result)}`);
    return result;
}

function evaluate_(datum, environment) {
    const [key, value] = typeValue(datum),
          listOrSplice = whichOne => () => {
        // What follows is the body of the return value of `listOrSplice`.
        if (value.length === 0) {
            return datum;
        }

        const first          = evaluate(value[0], environment),
              rest           = value.slice(1),
              [type, inside] = typeValue(first),
              recur          = arg => evaluate(arg, environment),
              plainList      = () => ({
                  [whichOne]: flattenSplices([first, ...rest.map(recur)]),
                  suffix:     datum.suffix || ')'
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

});