define(['./deep'], function (Deep) {

function body(lambda) {
    // In order to get both the value of something and how it looks in the
    // source code, assertions take a no-argument anonymous arrow function
    // per argument. The value is what you get from invoking the function, and
    // its souce code is available as `.toString()`. This function massages the
    // result of `.toString()` to remove function syntax boilerplate, assuming
    // that the function is a no-argument arrow function returning an
    // expression, e.g. `() => 42`.

    const code = lambda.toString();

    return code.slice(code.indexOf('=>') + 2).trim();
}

function checkArguments(...args) {
    args.forEach(arg => {
        if (typeof arg === 'function') {
            return;
        }

        const message = 'The argument(s) to an assertion must be functions ' +
                        'that will be invoked for values, e.g. (() => foo)" ' +
                        'for the variable foo. Non-function argument was ' +
                        'given having the value: ' + JSON.stringify(arg);
        throw new Error(message);
    });
}

function assert(predicate) {
    checkArguments(predicate);

    const quoted = body(predicate),
          result = predicate();

    if (result) {
        return;
    }

    const message = "Assertion failed: " + quoted;
    throw new Error(message);
}

assert.deepEqual = function (getLeft, getRight) {
    checkArguments(getLeft, getRight);

    const leftQuoted  = body(getLeft),
          rightQuoted = body(getRight);

    const [left, right] = [getLeft(), getRight()];

    if (Deep.equal(left, right)) {
        return;
    }

    const message = "Deep equality assertion failed: " +
                    leftQuoted + " does not equal " +
                    rightQuoted + " because " + leftQuoted +
                    " is " + JSON.stringify(left) + " and " +
                    rightQuoted + " is " + JSON.stringify(right);
    throw new Error(message);
};

assert.deepNotEqual = function (getLeft, getRight) {
    checkArguments(getLeft, getRight);

    const leftQuoted  = body(getLeft),
          rightQuoted = body(getRight);

    const [left, right] = [getLeft(), getRight()];

    if (!Deep.equal(left, right)) {
        return;
    }

    const message = "Deep inequality assertion failed: " +
                    leftQuoted + " equals " + rightQuoted +
                    ". They both have the value " +
                    JSON.stringify(left);
    throw new Error(message);
};

return {assert};

});