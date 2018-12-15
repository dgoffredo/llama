define(
['lex', 'parse', 'evaluate', 'builtins', 'xml', 'sexpr']
    .map(name => `../llama/${name}`),
function (Lex, Parse, Evaluate, Builtins, Xml, Sexpr) {

var calculated = {};

function onToggle() {
    const radios  = document.getElementsByName("showWhat"),
          display = document.getElementById("output");

    radios.forEach(radio => {
        if (radio.checked) {
            display.value = calculated[radio.value] || "";
        }
    });
}

function pprint(value) {
    return JSON.stringify(value, null, 2);
}

function onInput() {
   const entry   = document.getElementById("input"),
         display = document.getElementById("output");
    try {
        const input = entry.value;

        const tokens = Lex.tokens(input);
        calculated.tokens = pprint(tokens);
        onToggle();

        const tree = Parse.parse(tokens);
        calculated.parse = pprint(tree);
        onToggle();

        const value = Evaluate.evaluate(tree, Builtins.defaultEnvironment);
        calculated.evaluate = pprint(value);
        onToggle();

        const sexpr = Sexpr.sexpr(value);
        calculated.sexpr = sexpr;
        onToggle();

        const node = Xml.toNode(value);
        calculated.nodes = pprint(node);
        onToggle();

        const text = Xml.toXml(node);
        calculated.text = text;
        onToggle();

        display.style.backgroundColor = '';
    }
    catch (error) {
        display.style.backgroundColor = '#FFF0F0';
        throw error;
    }
}

return {onInput, onToggle};

});