
const Builtins = (function () {

const json = JSON.stringify;

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

    // TODO: describe this funny thing
    const result = [];
    var   depth  = 0;

    Array.from(value).reverse().forEach(item => {
        if (item.symbol === '...') {
            // Encountered an ellipsis. Keep track of how many are in a row.
            ++depth;
        }
        else if (depth > 0) {
            // Encountered a non-ellipsis, but there are some adjacent. Wrap.
            let wrapped = repositionEllipses(item);
            for (; depth; --depth) {
                wrapped = {list: [{symbol: '...'}, wrapped]};
            }
            result.push(wrapped);
        }
        else {
            // Encountered a non-ellipsis, and no wrapping is necessary.
            result.push(repositionEllipses(item));
        }
    });

    return {list: result.reverse()};
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

    // TODO: assert that bindings.length === 1.

    let argSymbol, argValue;

    // There's only one binding. Either it's a procedure-like pattern (e.g.
    // `(foo a b)`) or it's a variable-like pattern (e.g. `foo`). Convert the
    // whole expression into an immediately evaluated procedure.
    const {list: [pattern, template]} = bindings[0],
          [patternType, patternValue] = keyValue(pattern);

    if (patternType === 'symbol') {
        // The pattern is just a variable name.
        argSymbol = pattern;
        argValue  = template;
    }
    else {
        // TODO enforce patternType === 'list'
        // TODO enforce template is {list: [...]}
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
    // TODO: Document (there are some subtle points about the environment).

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

const defaultEnvironment = Object.freeze({
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

}());

// for node.js
try {
    Object.assign(exports, Builtins);
}
catch (e) {
}