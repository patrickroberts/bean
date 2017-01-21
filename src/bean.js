const babylon = require('babylon');

const Compiler = require('./compile');
const Assembler = require('./assemble');

function getIdentifier(index, toUpperCase) {
  var identifier = '';

  while (index >= 0) {
    var character = index % 26;
    index = (index - character) / 26 - 1;

    identifier += String.fromCharCode((toUpperCase ? 0x41 : 0x61) + character);
  }

  return identifier;
}

function generateInput(stdin) {
  const inputs = stdin.split(/\r?\n/g);
  const parsed = inputs.map(function parse(string, index) {
    var json;

    try {
      JSON.parse(string);
      json = string;
    } catch (error) {
      json = '';
    }

    return json;
  });

  let script = 'var ';

  script += inputs.reduce((script, string, index) => script + getIdentifier(index) + '=' + JSON.stringify(string) + ',', '');
  script += parsed.reduce((script, json, index) => script + (json ? getIdentifier(index, true) + '=' + json + ',' : ''), '');
  script += '_=' + JSON.stringify(inputs) + ',';
  script += '$=[' + parsed.join(',') + '];';

  return script;
}

module.exports = {
  compile(source) {
    const compiled = new Compiler(babylon.parse(source));

    return Uint8Array.from(compiled.byteCode);
  },

  assemble(byteCode) {
    const assembled = new Assembler(byteCode);

    return assembled.tokens.join('');
  },

  program(byteCode) {
    return (stdin) => {
      return new Function('', 'return eval("' + (generateInput(stdin) + this.assemble(byteCode)).replace(/["\\]/g, '\\$&') + '")')();
    };
  }
};
