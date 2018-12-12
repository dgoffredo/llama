
const Builtins = (function () {

function keyValue(object) {
    // TODO assert that there is exactly one key.
    const key = Object.keys(object)[0];

    return [key, object[key]];
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
                body:    template
            }
        };
    }

    // Now that `argSymbol` and `argValue` are determined, return a procedure of
    // one argument (`argSymbol`) invoked immediately with the value `argValue`.
    return {list: [{procedure: {pattern: {list: [argSymbol]},
                                body:    {splice: body}}},
                   argValue]};
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
                        'together: ' + JSON.stringify(keys));
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
        }
    }
});

return {defaultEnvironment};

}());

try {
    Object.assign(exports, Builtins);
}
catch (e) {
}