define(['./deep', './assert'], function (Deep, Assert) {

const {isObject} = Deep,
      {assert}   = Assert,
      json       = JSON.stringify,
      nodeTypes  = 
          'list splice quote string number symbol macro procedure'.split(' ');

function typeValue(object) {
    assert(() => isObject(object));

    const type = nodeTypes.find(key => object[key] !== undefined);

    return [type, object[type]];
}

function sexpr(datum) {
    // Return a string containing the s-expression form of `datum`.

    // This case is for convenience when printing values in diagnostics. No
    // s-expr is an array (they're always {[type]: ...} objects), but it's
    // handy to be able to print an s-expr [...] as if it were {list: [...]}.
    if (Array.isArray(datum)) {
        return sexpr({list: datum});
    }

    const [type, value] = typeValue(datum);

    switch (type) {
        case 'symbol': 
        case 'number': {
            return value;
        }
        case 'string': {
            return json(value);
        }
        case 'quote': {
            return "'" + sexpr(value);
        }
        case 'list': {
            const suffix = datum.suffix || ')',
                  prefix = {'}': '{', ')': '(', ']': '['}[suffix];

            return prefix + value.map(sexpr).join(' ') + suffix;
        }
        case 'splice': {
            return value.map(sexpr).join(' ');
        }
        case 'procedure': {
            if (typeof value === 'function') {
                return `(lambda #native ${value.name})`;
            }
            const {pattern, body} = value;
            return '(lambda ' + sexpr(pattern) + ' ' + sexpr(body) + ')';
        }
        default: {
            assert.deepEqual(() => type, () => "macro");
    
            if (typeof value.procedure === 'function') {
                return `(macro #native ${value.procedure.name})`;
            }
            const {pattern, body} = value.procedure;
            return '(macro ' +  sexpr(pattern) + ' ' + sexpr(body) + ')';
        }
    }
}

return {typeValue, sexpr, json};

});