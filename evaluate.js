
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

function keyValue(object) {
    // TODO assert that there is exactly one key.
    const key = Object.keys(object)[0];

    return [key, object[key]];
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

function deduceBindings(pattern, args) {
    // TODO: Support pattern matching. For now it's just a list of symbols.
    const {list} = pattern;

    return list.reduce((result, {symbol}, i) => {
        result[symbol] = args[i];
        return result;
    }, {});
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

const defaultEnvironment = Object.freeze({
    bindings: {
        // foo: {string: "This is foo's value"}
        foo: {
            macro: {
                procedure: (environment, arg) => {
                    console.log('foo was called with: ', arg);
                    return {number: "33.4"};
                }
            }
        },
        baz: {
            procedure: {
                pattern: {list: [{symbol: 'a'}, {symbol: 'b'}]},
                body: {splice: [{number: '42'}, {symbol: 'b'}]}
            }
        },
        let: {
            macro: {
                procedure: (environment, {list: bindings}, ...body) => {
                    // If there are no bindings, then the result is just the
                    // body spliced.
                    if (bindings.length === 0) {
                        return {splice: body};
                    }

                    // If there are multiple bindings, recur to instead nest
                    // them within each other.
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

                    // There's only one binding. Either it's a procedure-like
                    // pattern (e.g. `(foo a b)`) or it's a variable-like
                    // pattern (e.g. `foo`). Convert the whole expression into
                    // an immediately evaluated procedure.
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
                        const [procedureName, ...procedurePattern] = 
                                                                   patternValue;
                        argSymbol = procedureName;
                        argValue  = {
                            procedure: {
                                pattern: {list: procedurePattern},
                                body:    template
                            }
                        };
                    }

                    // Now that `argSymbol` and `argValue` are determined,
                    // return a procedure of one argument (`argSymbol`) invoked
                    // immediately with the value `argValue`.
                    return {list: [{procedure: {pattern: {list: [argSymbol]},
                                                body:    {splice: body}}},
                                   argValue]};
                }
            }
        }
    }
});

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
    environment = environment || defaultEnvironment;

    const [key, value] = keyValue(datum),
          listOrSplice = whichOne => () => {
        // TODO assert value.length >= 1
        const first          = evaluate(value[0], environment),
              rest           = value.slice(1),
              [type, inside] = keyValue(first),
              recur          = arg => evaluate(arg, environment),
              plainList      = () => ({
                  [whichOne]: flattenSplices([first].concat(rest.map(recur)))
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
                             // flattenSplices(rest.map(recur)), TODO?
                             rest.map(recur),
                             environment);
            }
            // TODO intrinsics, e.g. `conc`
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
    evaluate,
    defaultEnvironment
};

}());

try {
    Object.assign(exports, Evaluate);
}
catch (e) {
}