
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
    evaluate
};

}());

try {
    Object.assign(exports, Evaluate);
}
catch (e) {
}