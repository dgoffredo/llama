
const Lex      = require('./lex.js'),
      Parse    = require('./parse.js'),
      Evaluate = require('./evaluate.js');

function display(name, value) {
    console.log(`${name}: ${JSON.stringify(value, null, 4)}`);
}

const input = `(let ([letterQ "q"]
                     [(withX a1 a2) ('x a2 a1)])
                 (withX "a" "b")
                 (withX letterQ "r")
                 (repeat 10 22))`
display('input', input);

const tokens = Lex.tokens(input);
display('tokens', tokens);

const tree = Parse.parse(tokens);
display('tree', tree);

const result = Evaluate.evaluate(tree);
display('result', result);