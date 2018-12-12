
const Xml = (function () {
/* Here's what a (XML) node is:

    Node  ::=  {string: ...}
           |   {number: ...}
           |   {tag: ..., attributes: {[name]: Node}}, children: [Node, ...]}

Attribute values are a little funny, because in addition to possibly being
strings, they can also themselves be Nodes and are serialized as
"{This kind={Of thing}, here}".
*/

function keyValue(object) {
    // TODO assert that there is exactly one key.
    const key = Object.keys(object)[0];

    return [key, object[key]];
}

function toNode(evaluatedTree) {
    // TODO
}

function toAttributeValue(node) {
    // TODO
}

function toXml(node) {
    // TODO
}

}());

try {
    Object.assign(exports, Xml);
}
catch (e) {
}