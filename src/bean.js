const babylon = require('babylon');

const Compiler = require('./compile');
const Interpreter = require('./interpret');

module.exports = {
  compile(source) {
    const bean = new Compiler(babylon.parse(source));

    return Uint8Array.from(bean.byteCode);
  },

  interpret(byteCode) {
    const bean = new Interpreter(byteCode);

    return bean.tokens.join('');
  },
};
