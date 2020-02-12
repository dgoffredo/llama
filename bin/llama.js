#!/usr/bin/env node

const printUsage = () => {
    console.log(
`usage: ${process.argv[1]} [llama-file]
    
Reads Llama from the optionally specified llama-file or from standard input if
no file is specified, and prints the resulting XML to standard output.`);
};


const requirejs = require('./requirejs/r.js'),
      llamaDeps = ['lex', 'parse', 'builtins', 'evaluate', 'xml']
                  .map(name => `../llama/${name}`);

requirejs.config({
    // Pass the top-level main.js/index.js require function to requirejs so that
    // node modules are loaded relative to the top-level JS file.
    // (copied from the requirejs documentation)
    nodeRequire: require
});

requirejs(['fs', ...llamaDeps], 
function (fs, Lex, Parse, Builtins, Evaluate, Xml) {
    const thrush      = (value, func, ...funcs) =>
                            func ? thrush(func(value), ...funcs) : value,
          environment = Builtins.defaultEnvironment,
          evaluate    = tree => Evaluate.evaluate(tree, environment),
          inputPath   = process.argv[2] || '/dev/stdin';

    if (['--help', '-h'].indexOf(inputPath) !== -1) {
        printUsage();
        return;
    }
    
    fs.readFile(inputPath, 'utf8', (error, llamaText) => {
        if (error) {
            process.exit(1);
        }

        const xmlText = thrush(llamaText,
                               Lex.tokens, 
                               Parse.parse, 
                               evaluate, 
                               Xml.toNode, 
                               Xml.toXml);

        console.log(xmlText);
    });
});