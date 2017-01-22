const initialize = require('./input');
const Compiler = require('./compile');
const Assembler = require('./assemble');

const bean = module.exports = {
  Compiler, Assembler,

  compile(source) {
    return new bean.Compiler(source).binary;
  },

  assemble(binary) {
    return new bean.Assembler(binary).tokens.join('');
  },

  program(binary) {
    return (stdin = '') => {
      const init = initialize(stdin);
      const exec = bean.assemble(binary);
      const body = (init + exec).replace(/["\\]/g, '\\$&').replace(/\r?\n/g, '\\n');

      return new Function('', 'return eval("' + body + '")')();
    };
  },
};
