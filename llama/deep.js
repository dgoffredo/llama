define([], function () {

function isObject(value) {
    // https://stackoverflow.com/a/4320789
    return Object.prototype.toString.call(value) === '[object Object]';
}

function freeze(object) {
    try {
        Object.keys(object).forEach(key => freeze(object[key]));
    }
    catch (ignored) {
    }

    return Object.freeze(object);
}

function equal(a, b) {
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
               a.every((aMember, index) => equal(aMember, b[index]));
    }

    // objects like object literals
    if (isObject(a) && isObject(b)) {
        const aKeys = Object.keys(a);

        return equal(aKeys.sort(), Object.keys(b).sort()) &&
               aKeys.every(aKey => equal(a[aKey], b[aKey]));
    }

    // Ran out of ideas. Compare identity.
    return a === b;
}

return {equal, freeze, isObject};

});