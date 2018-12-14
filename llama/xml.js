
const Xml = (function () {
/* Here's what a (XML) node is:

    Node  ::=  {string: ...}
           |   {number: ...}
           |   {tag: ..., attributes: {[name]: Node}}, children: [Node, ...]}

Attribute values are a little funny, because in addition to possibly being
strings, they can also themselves be Nodes and are serialized as
"{This kind={Of thing}, here}".

A Node is "parsed" from the output of the evaluator by first stripping away all
`{quote: ...}` wrappers and then by looking for one of the following patterns:

Just a string:

    {string: ...}

Just a number:

    {number: ...}

A tag with attributes:

    {list: [{symbol: <tag name>},
            {list: [{list: ...}, ...]},
            ...children]}

A tag with empty attributes:

    {list: [{symbol: <tag name>},
            {list: []},
            ...children]}

A tag without attributes:

    {list: [{symbol: <tag name>},
            ...children]}

When parsing attributes, an attribute name can be a string, symbol, or a number
(in any case, it's converted into an object key) and the value can be a string,
number, symbol, or a list. If it's a symbol, then it's converted into a string.
If it's a list, then the list is converted into a Node.
*/

const json = JSON.stringify;

function keyValue(object) {
    // TODO assert that there is exactly one key.
    const key = Object.keys(object)[0];

    return [key, object[key]];
}

function stripQuote(evaluatedTree) {
    const [type, value] = keyValue(evaluatedTree);
    if (type === "quote") {
        return stripQuote(value);
    }
    else if (Array.isArray(value)) {
        return {[type]: value.map(stripQuote)}
    }
    else {
        return evaluatedTree;
    }
}

function toNodeNoQuote(evaluatedTree) {
    const [type, value] = keyValue(evaluatedTree);

    if (["string", "number", "symbol"].indexOf(type) !== -1) {
        // TODO: symbol makes attributes easier, but does it make sense?
        return evaluatedTree;
    }

    if (type !== "list") {
        throw new Error(`XML node cannot have type ${json(type)}. ` +
                        'It must be of type string, number, or list. Tag ' +
                        'names and attributes may contain symbols, but the ' +
                        'nodes themselves cannot be.');
    }

    const [first, ...rest] = value,
          {symbol: tag}    = first;

    if (!tag) {
        throw new Error(`${json(first)} is invalid for use as a tag name. ` +
                        'Tag names must be nonempty symbols.');
    }

    // Cases:
    // - `rest` is empty: means `first` is an empty tag.
    // - `rest`'s first element looks like an attribute list.
    // - `rest`'s first element does not look like an attribute list.
    if (rest.length === 0) {
        return {
            tag,
            attributes: {},
            children: []
        };
    }
    
    const [second, ...remaining] = rest;
    if (looksLikeAttributeList(second)) {
        return {
            tag,
            attributes: parseAttributes(second.list),
            children: remaining.map(toNodeNoQuote)
        };
    }

    return {
        tag,
        attributes: {},
        children: rest.map(toNodeNoQuote)
    };
}

function toNode(evaluatedTree) {
    return toNodeNoQuote(stripQuote(evaluatedTree));
}

function looksLikeAttributeList(datum) {
    const [type, value] = keyValue(datum);
    if (type !== 'list') {
        return false;
    }

    return value.every(item => {
        const [itemKey, itemValue] = keyValue(item);

        return itemKey === 'list' &&
               itemValue.length === 2 &&
               'symbol' in itemValue[0];
    });
}

function parseAttributes(inputList) {
    return inputList.reduce((attributes, {list: [key, value]}) => {
        const name                    = keyValue(key)[1],
              [valueType, valueValue] = keyValue(value);

        if (name in attributes) {
            throw new Error(`Duplicate attribute ${json(name)}.`);
        }

        // switch on `valueType`
        attributes[name] = ({
            string: () => value,
            symbol: () => ({string: valueValue}),
            number: () => value,
            list:   () => toNodeNoQuote(value)
        }[valueType]());

        return attributes;
    }, {});
}

function toAttributeValue(node) {
    if ('number' in node) {
        return node.number;
    }

    if ('string' in node || 'symbol' in node) {
        const value = keyValue(node)[1];
        // If this string/symbol begins as a number could, escape it with a
        // backtick.
        if (value.match(/^[.\-+\d].*/)) {
            return '`' + value;
        }
        else {
            return value;
        }
    }

    const {tag, attributes, children} = node,
          args = Object.keys(attributes).
                 map(attributeName => {
                     const expression = attributes[attributeName];
                     return `${attributeName}=${toAttributeValue(expression)}`;
                 }).
                 concat(children.map(toAttributeValue));
    
    return `{${tag} ${args.join(', ')}}`;
}

const xmlEscapes = {
    '"': "&quot;",
    "'": "&apos;",
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;"
};

function escapeXml(text) {
    return text.replace(/["'<>&]/g, char => xmlEscapes[char]);
}

function toXml(node) {
    if ('string' in node || 'symbol' in node || 'number' in node) {
        const value = keyValue(node)[1];
        return escapeXml(value);
    }

    const {tag, attributes, children} = node,
          attrs = Object.keys(attributes).
                  map(name => {
                      const attrValue = toAttributeValue(attributes[name]);
                      return `${name}=${json(escapeXml(attrValue))}`;
                  }),
          tagAndAttrs = [tag, ...attrs].join(' ');

    if (children.length === 0) {
        return `<${tagAndAttrs}/>`;
    }
    
    const kids = children.map(toXml).join('');
    return `<${tagAndAttrs}>${kids}</${tag}>`;
}

return {toNode, toXml};

}());

// for node.js
try {
    Object.assign(exports, Xml);
}
catch (e) {
}