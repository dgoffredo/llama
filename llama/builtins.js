define(['./sexpr', './assert', './deep'], function (Sexpr, Assert, Deep) {

const {keyValue, sexpr} = Sexpr,
      {assert}          = Assert;

function repositionEllipses(datum) {
    // Return a transformed copy of `datum` where trailing "<etc> ..." have been
    // replaced by `(... <etc>)` forms.
    const [type, value] = keyValue(datum);

    if (type !== 'list' || value.length === 0) {
        return datum;
    }

    if (value[0].symbol === '...') {
        throw new Error('"..." cannot appear first in a procedure body ' +
                        `(template): ${sexpr(datum)}`);
    }

    const array = value.reduce((result, item) => {
        if (item.symbol !== '...') {
            result.push(repositionEllipses(item));
        }
        else {
            const backIndex   = result.length - 1;
            result[backIndex] = {list: [{symbol: '...'}, result[backIndex]]};
        }

        return result;
    }, []);

    return {list: array};
}

function letMacroProcedure(environment, {list: bindings}, ...body) {
    // If there are no bindings, then the result is just the body spliced.
    if (bindings.length === 0) {
        return {splice: body};
    }

    // If there are multiple bindings, recur to instead nest them within each
    // other.
    if (bindings.length > 1) {
        const [firstBinding, ...restOfBindings] = bindings;
        return {
            list: [{symbol: 'let'},
                   {list: [firstBinding]},
                   {list: [{symbol: 'let'},
                           {list: restOfBindings},
                           ...body]}]};
    }

    assert.deepEqual(() => bindings.length, () => 1);

    let argSymbol, argValue;

    // There's only one binding. Either it's a procedure-like pattern (e.g.
    // `(foo a b)`) or it's a variable-like pattern (e.g. `foo`). Convert the
    // whole expression into an immediately evaluated procedure.
    const {list: [pattern, template, ...extra]} = bindings[0],
          [patternType, patternValue]           = keyValue(pattern);

    if (extra.length !== 0) {
        // Note for the future: If you ever want to support matching of multiple
        // patterns, here's the place (it would allow for general computation,
        // though).
        throw new Error('A "let" binding must be a list of length two: first ' +
                        'the pattern and then the template; but extra items ' +
                        `specified after the template: ${sexpr(extra)}`);
    }

    if (patternType === 'symbol') {
        // The pattern is just a variable name.
        argSymbol = pattern;
        argValue  = template;
    }
    else {
        const [procedureName, ...procedurePattern] = patternValue;
        argSymbol = procedureName;
        argValue  = {
            procedure: {
                pattern: {list: procedurePattern},
                // In the pattern, it's ok to leave the "..." at the end of a
                // list, since the evaluator knows to look for them them there.
                // In the body, however, "..." can be implemented as a macro,
                // and so first call `repositionEllipses` to turn `(a (b c)
                // ...)` into `(a (... (b c)))`.
                body:    repositionEllipses(template)
            }
        };
    }

    // Now that `argSymbol` and `argValue` are determined, return a procedure of
    // one argument (`argSymbol`) invoked immediately with the value `argValue`.
    const expansion=
        {list: [{procedure: {pattern: {list: [argSymbol]},
                             body:    {splice: body}}},
                argValue]};

    return expansion;
}

function concProcedure(environment, ...args) {
    const values = args.reduce(function processArg(result, arg) {
        const [key, value] = keyValue(arg);
        if (key === 'quote') {
            return processArg(result, value);
        }

        (result[key] = result[key] || []).push(value);
        return result;
    }, {}),
          keys = Object.keys(values);

    if (keys.length !== 1) {
        throw new Error('conc expected arguments having the same type ' +
                        '(either symbol or string), but instead the  ' +
                        `following ${keys.length} types were included ` +
                        `together: ${sexpr(keys)}`);
    }

    const [type, literals] = keyValue(values);
    return {
        [type]: literals.join('')
    };
}

function repeatProcedure(environment, {number: countStr}, what) {
    const count = Number(countStr),
          dupes = [];
    for (let i = 0; i !== count; ++i) {
        dupes.push(what);
    }

    return {splice: dupes};
}

function commentMacroProcedure() {
    return {splice: []};
}

function localBindingsReferenced(bindings, datum, result) {
    result = result || {};

    const [type, value] = keyValue(datum);

    if (type === 'symbol') {
        const bound = bindings[value];
        if (bound !== undefined) {
            result[value] = bound;
        }
    }
    else if (['list', 'slice'].indexOf(type) !== -1) {
        value.forEach(member => {
            localBindingsReferenced(bindings, member, result)
        });
    }

    return result;
}

function transpose(object) {
    // `{a: [...], b: [...]}` => `[{a: ..., b: ...}, {a: ..., b: ...}]`. If any
    // of the arrays are not the same length, they're truncated to the shortest
    // length.

    const keys      = Object.keys(object),
          minLength = Math.min(...keys.map(key => object[key].length)),
          length    = Number.isInteger(minLength) ? minLength : 0,
          result    = [];

    for (var i = 0; i != length; ++i) {
        result.push(keys.reduce((row, key) => {
            row[key] = object[key][i];
            return row;
        }, {}));
    }

    return result;
}

function ellipsisMacroProcedure(environment, ...args) {
    // The ellipsis ("...") macro takes exactly one argument and expands it into
    // a splice having as many items as there are values in list-valued
    // local bindings within the argument. That's a mouthfull. The idea is this:
    //
    //     (... (foo bar))
    //
    // If either `foo` or `bar` or both are _locally_ bound to a list, then
    // (foo bar) will be repeated for each index up to the length of the
    // shortest list, e.g.
    //
    //     (let ([foo (0 1 2)])
    //       (... (foo bar)))
    //
    // expands to
    //
    //     (0 bar)
    //     (1 bar)
    //     (2 bar)
    //
    // and if `foo` is `(0 1 2)` and `bar` is `(a b)`, then `(... (foo bar))`
    // expands to
    //
    //     (0 a)
    //     (1 b)
    //
    // When I say "locally" bound, I mean that the binding must be in the
    // immediately enclosing scope, as opposed to some outer one. This prevents
    // the expansion of lists that are free in procedure templates that include
    // "...". In that case, only _bound_ lists should be expanded. Restricting
    // expansion to locally bound names guarantees that free variables are not
    // expanded in the procedure template application case.
    // 
    // In particular, a `let` expression that introduces multiple bindings
    // introduces each in its own scope (enclosing the previous ones), and so
    // "..." would expand only the last one.

    if (args.length !== 1) {
        throw new Error('The "..." macro takes exactly one argument, but was ' +
                        `called with ${args.length}: ${sexpr(args)}.`);
    }

    const arg              = args[0],
          referenced       = localBindingsReferenced(environment.bindings, arg),
          // {name: {list: [...]}, ...} -> {name: [...], ...}
          referencedValues = Object.keys(referenced).reduce((result, name) => {
              const value         = referenced[name],
                    {list: array} = value;

              if (array === undefined) {
                  throw new Error('When used in a context with "...", a ' +
                                  'variable must be bound to a list, but ' +
                                  `${name} is bound to ${sexpr(value)}.`);
              }

              result[name] = array;
              return result;
          }, {});

    // The idea is that
    //
    //     `(... (a b))`
    //
    // becomes
    //
    //     (let ([a a1] [b b1])
    //       (a b))
    //     (let ([a a2] [b b2])
    //       (a b))
    //     (let ([a a3] [b b3])
    //       (a b))
    //
    // and so on.
    //
    const expanded = {
        splice: transpose(referencedValues).map(bindings => ({
            list: [
                {symbol: 'let'},
                {list: Object.keys(bindings).map(name => ({
                           list: [{symbol: name}, bindings[name]]
                       }))},
                arg
            ]
        }))
    };

    return expanded;
}

const defaultEnvironment = Deep.freeze({
    bindings: {
        let: {
            macro: {
                procedure: letMacroProcedure
            }
        },
        conc: {
            procedure: concProcedure
        },
        repeat: {
            procedure: repeatProcedure
        },
        comment: {
            macro: {
                procedure: commentMacroProcedure
            }
        },
        "...": {
            macro: {
                procedure: ellipsisMacroProcedure
            }
        }
    }
});

return {defaultEnvironment};

});