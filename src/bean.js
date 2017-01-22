const babylon = require('babylon');

const initialize = require('./input');
const Compiler = require('./compile');
const Assembler = require('./assemble');

module.exports = {
  compile(source) {
    return new Compiler(babylon.parse(source)).binary;
  },

  assemble(binary) {
    return new Assembler(binary).tokens.join('');
  },

  program(binary) {
    return (stdin = '') => {
      return new Function('', 'return eval("' + (initialize(stdin) + this.assemble(binary)).replace(/["\\]/g, '\\$&') + '")')();
    };
  }
};
