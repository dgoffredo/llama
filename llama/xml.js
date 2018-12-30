define(['./sexpr'], function (Sexpr) {
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

const {json, typeValue, sexpr} = Sexpr;

function stripQuote(evaluatedTree) {
    const [type, value] = typeValue(evaluatedTree);
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
    // console.log(`toNodeNoQuote: ${sexpr(evaluatedTree)}`);
    const [type, value] = typeValue(evaluatedTree);

    if (["string", "number", "symbol"].indexOf(type) !== -1) {
        return evaluatedTree;
    }

    // Special exception made for splices of one element. This happens when you
    // have:
    //
    //     (let (blahblah...) (my thing))
    //
    // It's reasonable to interpet this as if it were just `(my thing)`, but
    // since `let` bodies can contain multiple statements, it's instead a
    // splice containing a list that contains that one list. If that's the case,
    // let's just take it. If there are multiple things in the `let`, though,
    // don't, because then there'd be no root.
    if (type === "splice" && value.length === 1) {
        return toNodeNoQuote(value[0]);
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
    const [type, value] = typeValue(datum);
    if (type !== 'list') {
        return false;
    }

    return value.every(item => {
        const [itemKey, itemValue] = typeValue(item);

        return itemKey === 'list' &&
               itemValue.length === 2 &&
               'symbol' in itemValue[0];
    });
}

function parseAttributes(inputList) {
    return inputList.reduce((attributes, {list: [key, value]}) => {
        const name                    = typeValue(key)[1],
              [valueType, valueValue] = typeValue(value);

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
        const value = typeValue(node)[1];
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

// See https://www.w3.org/TR/xml/#syntax
// via https://stackoverflow.com/a/1091953
const xmlEscapes = {
    '"': "&quot;",
    "'": "&apos;",
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;"
};

function escapeXmlText(text) {
    return text.replace(/[>&]/g, char => xmlEscapes[char]);
}

function escapeXmlAttribute(text) {
    // Note that we don't escape the single quote here, because we assume that
    // the resulting string will be double quoted.
    return text.replace(/["<&]/g, char => xmlEscapes[char]);
}

function toXml(node) {
    if ('string' in node || 'symbol' in node || 'number' in node) {
        const value = typeValue(node)[1];
        return escapeXmlText(value);
    }

    const {tag, attributes, children} = node,
          attrs = Object.keys(attributes).
                  map(name => {
                      const attrValue = toAttributeValue(attributes[name]);
                      return `${name}=${json(escapeXmlAttribute(attrValue))}`;
                  }),
          tagAndAttrs = [tag, ...attrs].join(' ');

    if (children.length === 0) {
        return `<${tagAndAttrs}/>`;
    }
    
    const kids = children.map(toXml).join('');
    return `<${tagAndAttrs}>${kids}</${tag}>`;
}

return {toNode, toXml};

});