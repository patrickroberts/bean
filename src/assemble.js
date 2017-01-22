const globals = require('../config/globals.json');
const identifiers = require('../config/identifiers.json');
const nodeTypes = require('../config/ast.json');
const byteCodeToNodeTypeMap = new Map();

const MAX_LITERALS = 0x7F00;

const Assembler = module.exports = class Assembler {
  constructor(binary) {
    this.binary = binary;
    this.byteIndex = 0;
    this.tokens = [];
    this.literals = [];

    while (!this.decodeByte()) {}

    this.binary.substr(this.byteIndex).split('').reduce((literal, character, byteIndex) => {
      const code = character.charCodeAt(0);
      const last = this.isLast(code);

      literal += String.fromCharCode(code & 0x7F);

      if (last) {
        this.literals.push(literal);

        return '';
      }

      return literal;
    }, '');

    if (this.literals.length > MAX_LITERALS) {
      throw new RangeError(`decoded ${this.literals.length} program-specific literals, only ${MAX_LITERALS} supported`);
    }
  }

  decodeByte(code = this.nextByte(true)) {
    const last = this.isLast(code);
    const type = byteCodeToNodeTypeMap.get(code & 0x7F);

    if (type !== undefined) {
      this[type]();
    }

    return last;
  }

  decodeLiteral() {
    const code = this.nextByte(true);

    // global
    if (code < 0x80) {
      this.tokens.push(globals[code]);
    // predefined identifier
    } else if (code === 0x80) {
      const index = this.nextByte(true);

      this.tokens.push(identifiers[index]);
    // program-specific identifier
    } else {
      const index = this.nextByte(true) + (code - 0x81) * 0x100;
      // toString invoked in post-processing of tokens when joined
      // must parse program-specific literals first
      this.tokens.push({
        toString: () => this.literals[index]
      });
    }
  }

  isLast(code = this.nextByte()) {
    return !(code & 0x80);
  }

  nextByte(postIncrement = false) {
    return this.binary.charCodeAt(postIncrement ? this.byteIndex++ : this.byteIndex);
  }

  lastToken() {
    return this.tokens[this.tokens.length - 1] || '';
  }

  Identifier() {
    this.decodeLiteral();
  }

  RegExpLiteral() {
    const code = this.nextByte(true);

    this.tokens.push('/');
    this.decodeLiteral();

    const literal = this.tokens.pop();

    this.tokens.push({
      toString: () => literal.toString().replace(/\//g, '\\/')
    });
    this.tokens.push('/');

    const [g, i, m, u, y] = [
      (code >> 0) & 1,
      (code >> 1) & 1,
      (code >> 2) & 1,
      (code >> 3) & 1,
      (code >> 4) & 1,
    ];
    const flags = [
      (g ? 'g' : ''),
      (i ? 'i' : ''),
      (m ? 'm' : ''),
      (u ? 'u' : ''),
      (y ? 'y' : ''),
    ].join('');

    this.tokens.push(flags);
  }

  NullLiteral() {
    this.tokens.push('null');
  }

  StringLiteral() {
    this.tokens.push('"');
    this.decodeLiteral();

    const literal = this.tokens.pop();

    this.tokens.push({
      toString: () => literal.toString().replace(/["\\]/g, '\\$&').replace(/\r?\n/g, '\\n')
    });
    this.tokens.push('"');
  }

  BooleanLiteral() {
    const code = this.nextByte(true);

    this.tokens.push(code ? 'true' : 'false');
  }

  NumericLiteral() {
    this.decodeLiteral();
  }

  ExpressionStatement() {
    this.decodeByte();
    this.tokens.push(';');
  }

  BlockStatement() {
    this.tokens.push('{');

    while (!this.decodeByte()) {}

    this.tokens.push('}');
  }

  EmptyStatement() {
    this.tokens.push(';');
  }

  DebuggerStatement() {
    this.tokens.push('debugger', ';');
  }

  WithStatement() {
    this.tokens.push('with', '(');
    this.decodeByte();
    this.tokens.push(')');
    this.decodeByte();
  }

  ReturnStatement() {
    this.tokens.push('return');

    const code = this.nextByte();

    if (code !== 0x00) {
      this.tokens.push(' ');
    }

    this.decodeByte();
    this.tokens.push(';');
  }

  LabeledStatement() {
    this.decodeByte();
    this.tokens.push(':');
    this.decodeByte();
  }

  BreakStatement() {
    this.tokens.push('break');

    const code = this.nextByte();

    if (code !== 0x00) {
      this.tokens.push(' ');
    }

    this.decodeByte();
    this.tokens.push(';');
  }

  ContinueStatement() {
    this.tokens.push('continue');

    const code = this.nextByte();

    if (code !== 0x00) {
      this.tokens.push(' ');
    }

    this.decodeByte();
    this.tokens.push(';');
  }

  IfStatement() {
    this.tokens.push('if', '(');
    this.decodeByte();
    this.tokens.push(')');

    if (!this.decodeByte()) {
      this.tokens.push('else', ' ');
      this.decodeByte();
    }
  }

  SwitchStatement() {
    this.tokens.push('switch', '(');

    let last = this.decodeByte();

    this.tokens.push(')', '{');

    while (!last) {
      last = this.decodeByte();
    }

    this.tokens.push('}');
  }

  SwitchCase() {
    const code = this.nextByte();

    if (code & 0x7F) {
      this.tokens.push('case', ' ');
    } else {
      this.tokens.push('default');
    }

    let last = this.decodeByte();

    this.tokens.push(':');

    while (!last) {
      last = this.decodeByte();
    }
  }

  ThrowStatement() {
    this.tokens.push('throw', ' ');
    this.decodeByte();
    this.tokens.push(';');
  }

  TryStatement() {
    this.tokens.push('try');
    this.decodeByte();

    const last = this.decodeByte();

    if (!last) {
      this.tokens.push('finally');
      this.decodeByte();
    }
  }

  CatchClause() {
    this.tokens.push('catch', '(');
    this.decodeByte();
    this.tokens.push(')');
    this.decodeByte();
  }

  WhileStatement() {
    this.tokens.push('while', '(');
    this.decodeByte();
    this.tokens.push(')');
    this.decodeByte();
  }

  DoWhileStatement() {
    this.tokens.push('do', ' ');
    this.decodeByte();
    this.tokens.push('while', '(');
    this.decodeByte();
    this.tokens.push(')');
  }

  ForStatement() {
    this.tokens.push('for', '(');
    this.decodeByte();

    if (this.lastToken() !== ';') {
      this.tokens.push(';');
    }

    this.decodeByte();
    this.tokens.push(';');
    this.decodeByte();
    this.tokens.push(')');
    this.decodeByte();
  }

  ForInStatement() {
    this.tokens.push('for', '(');
    this.decodeByte();
    this.tokens.push(' ', 'in', ' ');
    this.decodeByte();
    this.tokens.push(')');
    this.decodeByte();
  }

  ForOfStatement() {
    this.tokens.push('for', '(');
    this.decodeByte();
    this.tokens.push(' ', 'of', ' ');
    this.decodeByte();
    this.tokens.push(')');
    this.decodeByte();
  }

  ForAwaitStatement() {
    this.tokens.push('for', '(');
    this.decodeByte();
    this.tokens.push(' ', 'await', ' ');
    this.decodeByte();
    this.tokens.push(')');
    this.decodeByte();
  }

  FunctionDeclaration() {
    const code = this.nextByte(true);
    const [generator, async] = [
      (code >> 1) & 1,
      (code >> 0) & 1,
    ];

    if (async) {
      this.tokens.push('async', ' ');
    }

    this.tokens.push('function');

    if (generator) {
      this.tokens.push('*');
    }

    this.tokens.push(' ');
    this.decodeByte();
    this.tokens.push('(');

    while (!this.isLast()) {
      this.decodeByte();

      if (!this.isLast()) {
        this.tokens.push(',');
      }
    }

    this.tokens.push(')');
    this.decodeByte();
  }

  VariableDeclaration() {
    const code = this.nextByte(true);

    let kind = Assembler.DECLARE.length;

    while (((code >> --kind) & 0x01) === 0x00) {}

    this.tokens.push(Assembler.DECLARE[kind], ' ');

    while (!this.isLast()) {
      this.decodeByte();
      this.tokens.push(',');
    }

    this.decodeByte();
    this.tokens.push(';');
  }

  VariableDeclarator() {
    const last = this.decodeByte();

    if (!last) {
      this.tokens.push('=');
      this.decodeByte();
    }
  }

  Super() {
    this.tokens.push('super');
  }

  ThisExpression() {
    this.tokens.push('this');
  }

  ArrowFunctionExpression() {
    const code = this.nextByte(true);
    const async = (code >> 0) & 1;

    if (async) {
      this.tokens.push('async');
    }

    this.tokens.push('(');

    while (!this.isLast()) {
      this.decodeByte();

      if (!this.isLast()) {
        this.tokens.push(',');
      }
    }

    this.tokens.push(')', '=>');
    this.decodeByte();
  }

  YieldExpression() {
    this.tokens.push('yield');

    const code = this.nextByte(true);
    const last = this.isLast(code);
    const delegate = (code >> 0) & 1;

    if (delegate) {
      this.tokens.push('*');
    }

    if (!last) {
      this.decodeByte();
    }

    this.tokens.push(';');
  }

  AwaitExpression() {
    this.tokens.push('await');

    const code = this.nextByte();

    if (code !== 0x00) {
      this.tokens.push(' ');
    }

    this.decodeByte();
    this.tokens.push(';');
  }

  ArrayExpression() {
    this.tokens.push('[');

    while (!this.isLast()) {
      this.decodeByte();
      this.tokens.push(',');
    }

    this.decodeByte();
    this.tokens.push(']');
  }

  ObjectExpression() {
    this.tokens.push('{');

    while (!this.isLast()) {
      this.decodeByte();
      this.tokens.push(',');
    }

    this.decodeByte();
    this.tokens.push('}');
  }

  ObjectProperty() {
    const code = this.nextByte(true);
    const last = this.isLast(code);
    const [shorthand, computed] = [
      (code >> 3) & 1,
      (code >> 2) & 1,
    ];

    if (!last && !shorthand) {
      if (computed) {
        this.tokens.push('[');
      }

      this.decodeByte();

      if (computed) {
        this.tokens.push(']');
      }

      this.tokens.push(':');
    }

    this.decodeByte();
  }

  ObjectMethod() {
    const code = this.nextByte(true);
    const [kind, computed, generator, async] = [
      (code >> 5) & 3,
      (code >> 2) & 1,
      (code >> 1) & 1,
      (code >> 0) & 1,
    ];
    const type = Assembler.METHOD[kind];

    switch (type) {
    case 'get':
    case 'set':
      this.tokens.push(type, ' ');
    case 'method':
      if (async) {
        this.tokens.push('async');
      }

      if (generator) {
        this.tokens.push('*');
      }

      if (computed) {
        this.tokens.push('[');
      }

      this.decodeByte();

      if (computed) {
        this.tokens.push(']');
      }
    }

    this.tokens.push('(');

    while (!this.isLast()) {
      this.decodeByte();

      if (!this.isLast()) {
        this.tokens.push(',');
      }
    }

    this.tokens.push(')');
    this.decodeByte();
  }

  RestProperty() {
    this.tokens.push('...');
    this.decodeByte();
  }

  SpreadProperty() {
    this.tokens.push('...');
    this.decodeByte();
  }

  FunctionExpression() {
    const code = this.nextByte(true);
    const [generator, async] = [
      (code >> 1) & 1,
      (code >> 0) & 1,
    ];

    if (async) {
      this.tokens.push('async', ' ');
    }

    this.tokens.push('function');

    if (generator) {
      this.tokens.push('*');
    }

    this.tokens.push(' ');
    this.decodeByte();
    this.tokens.push('(');

    while (!this.isLast()) {
      this.decodeByte();

      if (!this.isLast()) {
        this.tokens.push(',');
      }
    }

    this.tokens.push(')');
    this.decodeByte();
  }

  UnaryExpression() {
    const code = this.nextByte(true);
    const [prefix, operator] = [
      (code >> 6) & 1,
      (code >> 0) & 31,
    ];
    const token = Assembler.UNARY[operator];
    const space = /^[a-z]+$/.test(token) ? ' ' : '';

    if (prefix) {
      this.tokens.push(token, space);
      this.decodeByte();
    } else {
      this.decodeByte();
      this.tokens.push(space, token);
    }
  }

  UpdateExpression() {
    const code = this.nextByte(true);
    const [prefix, operator] = [
      (code >> 6) & 1,
      (code >> 0) & 31,
    ];

    if (prefix) {
      this.tokens.push(Assembler.UPDATE[operator]);
      this.decodeByte();
    } else {
      this.decodeByte();
      this.tokens.push(Assembler.UPDATE[operator]);
    }
  }

  BinaryExpression() {
    this.decodeByte();

    const code = this.nextByte(true);
    const operator = (code >> 0) & 31;
    const token = Assembler.BINARY[operator];
    const space = /^[a-z]+$/.test(token) ? ' ' : '';

    this.tokens.push(space, token, space);
    this.decodeByte();
  }

  AssignmentExpression() {
    this.tokens.push('(');
    this.decodeByte();

    const code = this.nextByte(true);
    const operator = (code >> 0) & 31;

    this.tokens.push(Assembler.ASSIGNMENT[operator]);
    this.decodeByte();
    this.tokens.push(')');
  }

  LogicalExpression() {
    this.decodeByte();

    const code = this.nextByte(true);
    const operator = (code >> 0) & 31;

    this.tokens.push(Assembler.LOGICAL[operator]);
    this.decodeByte();
  }

  SpreadElement() {
    this.tokens.push('...');
    this.decodeByte();
  }

  MemberExpression() {
    const code = this.nextByte(true);
    const computed = (code >> 2) & 1;

    this.decodeByte();

    if (computed) {
      this.tokens.push('[');
      this.decodeByte();
      this.tokens.push(']');
    } else {
      this.tokens.push('.');
      this.decodeByte();
    }
  }

  BindExpression() {
    if (!this.isLast()) {
      this.decodeByte();
    }

    this.tokens.push('::');
    this.decodeByte();
  }

  ConditionalExpression() {
    this.decodeByte();
    this.tokens.push('?');
    this.decodeByte();
    this.tokens.push(':');
    this.decodeByte();
  }

  CallExpression() {
    let last = this.decodeByte();
    this.tokens.push('(');

    while (!last) {
      last = this.decodeByte();

      if (!last) {
        this.tokens.push(',');
      }
    }

    this.tokens.push(')');
  }

  NewExpression() {
    this.tokens.push('new', ' ');
    let last = this.decodeByte();
    this.tokens.push('(');

    while (!last) {
      last = this.decodeByte();

      if (!last) {
        this.tokens.push(',');
      }
    }

    this.tokens.push(')');
  }

  SequenceExpression() {
    this.tokens.push('(');

    while (!this.isLast()) {
      this.decodeByte();
      this.tokens.push(',');
    }

    this.decodeByte();
    this.tokens.push(')');
  }

  TemplateLiteral() {
    this.tokens.push('`');

    while (!this.isLast()) {
      this.decodeByte();
      this.tokens.push('${');
      this.decodeByte();
      this.tokens.push('}');
    }

    this.decodeByte();
    this.tokens.push('`');
  }

  TaggedTemplateExpression() {
    this.decodeByte();
    this.decodeByte();
  }

  TemplateElement() {
    this.decodeLiteral();

    const literal = this.tokens.pop();

    this.tokens.push({
      toString: () => literal.toString().replace(/[`\\]/g, '\\$&').replace(/\r?\n/g, '\\n')
    });
  }

  ObjectPattern() {
    this.tokens.push('{');

    while (!this.isLast()) {
      this.decodeByte();
      this.tokens.push(',');
    }

    this.decodeByte();
    this.tokens.push('}');
  }

  ArrayPattern() {
    this.tokens.push('[');

    while (!this.isLast()) {
      this.decodeByte();
      this.tokens.push(',');
    }

    this.decodeByte();
    this.tokens.push(']');
  }

  RestElement() {
    this.tokens.push('...');
    this.decodeByte();
  }

  AssignmentPattern() {
    this.decodeByte();
    this.tokens.push('=');
    this.decodeByte();
  }

  ClassBody() {
    this.tokens.push('{');

    while (!this.isLast()) {
      this.decodeByte();
    }

    this.decodeByte();
    this.tokens.push('}');
  }

  ClassMethod() {
    const code = this.nextByte(true);
    const [kind, isStatic, computed, generator, async] = [
      (code >> 5) & 3,
      (code >> 4) & 1,
      (code >> 2) & 1,
      (code >> 1) & 1,
      (code >> 0) & 1,
    ];
    const type = Assembler.METHOD[kind];

    if (isStatic) {
      this.tokens.push('static', ' ');
    }

    switch (type) {
    case 'get':
    case 'set':
      this.tokens.push(type, ' ');
    case 'method':
      if (async) {
        this.tokens.push('async');
      }

      if (generator) {
        this.tokens.push('*');
      }

      if (computed) {
        this.tokens.push('[');
      }

      this.decodeByte();

      if (computed) {
        this.tokens.push(']');
      }

      break;
    case 'constructor':
      this.tokens.push(type);
    }

    this.tokens.push('(');

    while (!this.isLast()) {
      this.decodeByte();

      if (!this.isLast()) {
        this.tokens.push(',');
      }
    }

    this.tokens.push(')');
    this.decodeByte();
  }

  ClassProperty() {
    const code = this.nextByte(true);
    const computed = (code >> 2) & 1;

    if (computed) {
      this.tokens.push('[');
    }

    this.decodeByte();

    if (computed) {
      this.tokens.push(']');
    }

    this.tokens.push('=');
    this.decodeByte();
    this.tokens.push(';');
  }

  ClassDeclaration() {
    this.tokens.push('class', ' ');
    this.decodeByte();

    if (!this.isLast()) {
      this.tokens.push(' ', 'extends', ' ');
      this.decodeByte();
    }

    this.decodeByte();
  }

  ClassExpression() {
    const space = this.nextByte() === 0x80 ? '' : ' ';

    this.tokens.push('class', space);
    this.decodeByte();

    if (!this.isLast()) {
      this.tokens.push(' ', 'extends', ' ');
      this.decodeByte();
    }

    this.decodeByte();
  }

  MetaProperty() {
    this.decodeByte();
    this.tokens.push('.');
    this.decodeByte();
  }
};

Assembler.DECLARE = ["var", "let", "const"];
Assembler.METHOD = ["get", "set", "method", "constructor"];
Assembler.UNARY = ["-", "+", "!", "~", "typeof", "void", "delete"];
Assembler.UPDATE = ["++", "--"];
Assembler.BINARY = ["==", "!=", "===", "!==", "<", "<=", ">", ">=", "<<", ">>", ">>>", "+", "-", "*", "/", "%", "|", "^", "&", "in", "instanceof", "**"];
Assembler.ASSIGNMENT = ["=", "+=", "-=", "*=", "/=", "%=", "<<=", ">>=", ">>>=", "|=", "^=", "&="];
Assembler.LOGICAL = ["||", "&&"];

nodeTypes.forEach((type, index) => {
  const byteCode = index + 32;

  byteCodeToNodeTypeMap.set(byteCode, type);
});
