const globals = require('../config/globals.json');
const identifiers = require('../config/identifiers.json');
const nodeTypes = require('../config/ast.json');
const nodeTypeToByteCodeMap = new Map();

const MAX_LITERALS = 0x7F00;

const Compiler = module.exports = class Compiler {
  constructor(ast) {
    this.binary = '';
    this.literals = [];
    this[ast.program.type](ast.program);

    if (this.literals.length > MAX_LITERALS) {
      throw new RangeError(`encoded ${this.literals.length} program-specific literals, only ${MAX_LITERALS} supported`);
    }

    for (const literal of this.literals) {
      literal.split('').forEach((character, index) => {
        this.binary += String.fromCharCode((index + 1 === literal.length ? 0x00 : 0x80) | character.charCodeAt(0));
      });
    }
  }

  encodeLiteral(string) {
    // global
    let index = globals.indexOf(string);
    let byteCode = 0x00 | index;

    // predefined identifier
    if (index < 0) {
      index = identifiers.indexOf(string);
      byteCode = 0x80;
    }

    // program-specific identifier
    if (index < 0) {
      index = this.literals.indexOf(string);

      if (index < 0) {
        index = this.literals.push(string) - 1;
      }

      byteCode += (index - (index % 0x100)) / 0x100 + 1;
      index = index % 0x100;
    }

    this.binary += String.fromCharCode(byteCode);

    // if non-global identifier
    if (byteCode >= 0x80) {
      this.binary += String.fromCharCode(index);
    }
  }

  Identifier(node, last = true) {
    const {type, name} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.encodeLiteral(name);
  }

  RegExpLiteral(node, last = true) {
    const {type, pattern, flags} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 |
      (flags.includes('y') << 4) |
      (flags.includes('u') << 3) |
      (flags.includes('m') << 2) |
      (flags.includes('i') << 1) |
      (flags.includes('g') << 0));
    this.encodeLiteral(pattern.replace(/\\\//g, '/'));
  }

  NullLiteral(node, last = true) {
    const {type} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
  }

  StringLiteral(node, last = true) {
    const {type, value} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.encodeLiteral(value);
  }

  BooleanLiteral(node, last = true) {
    const {type, value} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(value ? 0x01 : 0x00);
  }

  NumericLiteral(node, last = true) {
    const {type, value} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (/\.$/.test(node.extra.raw)) {
      this.encodeLiteral(node.extra.raw);
    } else {
      const exponential = value.toExponential().replace(/e\+/, 'e');
      const precision = value.toPrecision().replace(/^0(.)/, '$1');

      this.encodeLiteral(exponential.length < precision.length ? exponential : precision);
    }
  }

  Program(node, last = true) {
    const {body = []} = node;

    body.forEach((statement, index) => {
      this[statement.type](statement, index + 1 === body.length);
    });
  }

  ExpressionStatement(node, last = true) {
    const {type, expression} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[expression.type](expression);
  }

  BlockStatement(node, last = true) {
    const {type, body = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    body.forEach((statement, index) => {
      this[statement.type](statement, index + 1 === body.length);
    });

    if (body.length === 0) {
      this.binary += String.fromCharCode(0x00);
    }
  }

  EmptyStatement(node, last = true) {
    const {type} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
  }

  DebuggerStatement(node, last = true) {
    const {type} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
  }

  WithStatement(node, last = true) {
    const {type, object, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[object.type](object, false);
    this[body.type](body);
  }

  ReturnStatement(node, last = true) {
    const {type, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (argument !== null) {
      this[argument.type](argument);
    } else {
      this.binary += String.fromCharCode(0x00);
    }
  }

  LabeledStatement(node, last = true) {
    const {type, label, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[label.type](label, false);
    this[body.type](body);
  }

  BreakStatement(node, last = true) {
    const {type, label} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (label !== null) {
      this[label.type](label);
    } else {
      this.binary += String.fromCharCode(0x00);
    }
  }

  ContinueStatement(node, last = true) {
    const {type, label} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (label !== null) {
      this[label.type](label);
    } else {
      this.binary += String.fromCharCode(0x00);
    }
  }

  IfStatement(node, last = true) {
    const {type, test, consequent, alternate} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[test.type](test, false);
    this[consequent.type](consequent, alternate === null);

    if (alternate !== null) {
      this[alternate.type](alternate);
    }
  }

  SwitchStatement(node, last = true) {
    const {type, discriminant, cases = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[discriminant.type](discriminant, cases.length === 0);
    cases.forEach((switchCase, index) => {
      this[switchCase.type](switchCase, index + 1 === cases.length);
    });
  }

  SwitchCase(node, last = true) {
    const {type, test, consequent} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (test !== null) {
      this[test.type](test, consequent.length === 0);
    } else {
      this.binary += String.fromCharCode(consequent.length === 0 ? 0x00 : 0x80);
    }

    consequent.forEach((statement, index) => {
      this[statement.type](statement, index + 1 === consequent.length);
    });
  }

  ThrowStatement(node, last = true) {
    const {type, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[argument.type](argument);
  }

  TryStatement(node, last = true) {
    const {type, block, handler, finalizer} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[block.type](block, false);

    if (handler !== null) {
      this[handler.type](handler, finalizer === null);
    } else {
      this.binary += String.fromCharCode(0x80);
    }

    if (finalizer !== null) {
      this[finalizer.type](finalizer);
    }
  }

  CatchClause(node, last = true) {
    const {type, param, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[param.type](param, false);
    this[body.type](body);
  }

  WhileStatement(node, last = true) {
    const {type, test, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[test.type](test, false);
    this[body.type](body);
  }

  DoWhileStatement(node, last = true) {
    const {type, body, test} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[body.type](body, false);
    this[test.type](test);
  }

  ForStatement(node, last = true) {
    const {type, init, test, update, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (init !== null) {
      this[init.type](init, false);
    } else {
      this.binary += String.fromCharCode(0x80);
    }

    if (test !== null) {
      this[test.type](test, false);
    } else {
      this.binary += String.fromCharCode(0x80);
    }

    if (update !== null) {
      this[update.type](update, false);
    } else {
      this.binary += String.fromCharCode(0x80);
    }

    this[body.type](body);
  }

  ForInStatement(node, last = true) {
    const {type, left, right, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[left.type](left, false);
    this[right.type](right, false);
    this[body.type](body);
  }

  ForOfStatement(node, last = true) {
    const {type, left, right, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[left.type](left, false);
    this[right.type](right, false);
    this[body.type](body);
  }

  ForAwaitStatement(node, last = true) {
    const {type, left, right, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[left.type](left, false);
    this[right.type](right, false);
    this[body.type](body);
  }

  FunctionDeclaration(node, last = true) {
    const {type, id, params = [], body, generator, async} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (generator << 1) | (async << 0));
    this[id.type](id, false);
    params.forEach((param, index) => {
      this[param.type](param, false);
    });
    this[body.type](body);
  }

  VariableDeclaration(node, last = true) {
    const {type, declarations = [], kind} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (1 << Compiler.DECLARE[kind]));
    declarations.forEach((declaration, index) => {
      this[declaration.type](declaration, index + 1 === declarations.length);
    });

    if (declarations.length === 0) {
      this.binary += String.fromCharCode(0x00);
    }
  }

  VariableDeclarator(node, last = true) {
    const {type, id, init} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[id.type](id, init === null);

    if (init !== null) {
      this[init.type](init);
    }
  }

  Super(node, last = true) {
    const {type} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
  }

  ThisExpression(node, last = true) {
    const {type} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
  }

  ArrowFunctionExpression(node, last = true) {
    const {type, params = [], body, generator, async} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (generator << 1) | (async << 0));
    params.forEach((param, index) => {
      this[param.type](param, false);
    });

    this[body.type](body);
  }

  YieldExpression(node, last = true) {
    const {type, argument, delegate} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode((argument === null ? 0x00 : 0x80) | (delegate << 0));

    if (argument !== null) {
      this[argument.type](argument);
    }
  }

  AwaitExpression(node, last = true) {
    const {type, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (argument !== null) {
      this[argument.type](argument);
    } else {
      this.binary += String.fromCharCode(0x00);
    }
  }

  ArrayExpression(node, last = true) {
    const {type, elements = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    elements.forEach((element, index) => {
      if (element !== null) {
        this[element.type](element, false);
      } else {
        // [,] behaves differently than [undefined,]
        this.binary += String.fromCharCode(0x80);
      }
    });

    // therefore we must explicitly terminate elements
    this.binary += String.fromCharCode(0x00);
  }

  ObjectExpression(node, last = true) {
    const {type, properties = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    properties.forEach((property, index) => {
      this[property.type](property, index + 1 === properties.length);
    });

    if (properties.length === 0) {
      this.binary += String.fromCharCode(0x00);
    }
  }

  ObjectProperty(node, last = true) {
    const {type, key, value, computed, shorthand} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (shorthand << 3) | (computed << 2));

    if (!shorthand) {
      this[key.type](key, false);
    }

    this[value.type](value);
  }

  ObjectMethod(node, last = true) {
    const {type, key, params = [], body, async, computed, generator, kind} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (Compiler.METHOD[kind] << 5) | (computed << 2) | (generator << 1) | (async << 0));
    this[key.type](key, false);
    params.forEach((param, index) => {
      this[param.type](param, false);
    });
    this[body.type](body);
  }

  RestProperty(node, last = true) {
    const {type, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[argument.type](argument);
  }

  SpreadProperty(node, last = true) {
    const {type, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[argument.type](argument);
  }

  FunctionExpression(node, last = true) {
    const {type, id, params = [], body, generator, async} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (generator << 1) | (async << 0));

    if (id !== null) {
      this[id.type](id, false);
    } else {
      this.binary += String.fromCharCode(0x80);
    }

    params.forEach((param, index) => {
      this[param.type](param, false);
    });
    this[body.type](body);
  }

  UnaryExpression(node, last = true) {
    const {type, operator, prefix, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (prefix << 6) | Compiler.UNARY[operator]);
    this[argument.type](argument);
  }

  UpdateExpression(node, last = true) {
    const {type, operator, prefix, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (prefix << 6) | Compiler.UPDATE[operator]);
    this[argument.type](argument);
  }

  BinaryExpression(node, last = true) {
    const {type, operator, left, right} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[left.type](left, false);
    this.binary += String.fromCharCode(0x80 | Compiler.BINARY[operator]);
    this[right.type](right);
  }

  AssignmentExpression(node, last = true) {
    const {type, operator, left, right} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[left.type](left, false);
    this.binary += String.fromCharCode(0x80 | Compiler.ASSIGNMENT[operator]);
    this[right.type](right);
  }

  LogicalExpression(node, last = true) {
    const {type, operator, left, right} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[left.type](left, false);
    this.binary += String.fromCharCode(0x80 | Compiler.LOGICAL[operator]);
    this[right.type](right);
  }

  SpreadElement(node, last = true) {
    const {type, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[argument.type](argument);
  }

  MemberExpression(node, last = true) {
    const {type, object, property, computed} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (computed << 2));
    this[object.type](object, false);
    this[property.type](property);
  }

  BindExpression(node, last = true) {
    const {type, object, callee} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (object !== null) {
      this[object.type](object, false);
    }

    this[callee.type](callee);
  }

  ConditionalExpression(node, last = true) {
    const {type, test, alternate, consequent} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[test.type](test, false);
    this[consequent.type](consequent, false);
    this[alternate.type](alternate);
  }

  CallExpression(node, last = true) {
    const {type, callee} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[callee.type](callee, node.arguments.length === 0);
    node.arguments.forEach((argument, index) => {
      this[argument.type](argument, index + 1 === node.arguments.length);
    });
  }

  NewExpression(node, last = true) {
    const {type, callee} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[callee.type](callee, node.arguments.length === 0);
    node.arguments.forEach((argument, index) => {
      this[argument.type](argument, index + 1 === node.arguments.length);
    });
  }

  SequenceExpression(node, last = true) {
    const {type, expressions = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    expressions.forEach((expression, index) => {
      this[expression.type](expression, index + 1 === expressions.length);
    });

    if (expressions.length === 0) {
      this.binary += String.fromCharCode(0x00);
    }
  }

  TemplateLiteral(node, last = true) {
    const {type, quasis = [], expressions = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    quasis.forEach((quasi, index) => {
      const expression = expressions[index];

      this[quasi.type](quasi, index + 1 === quasis.length);

      if (expression !== undefined) {
        this[expression.type](expression, false);
      }
    });
  }

  TaggedTemplateExpression(node, last = true) {
    const {type, tag, quasi} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[tag.type](tag, false);
    this[quasi.type](quasi);
  }

  TemplateElement(node, last = true) {
    const {type, tail, value} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.encodeLiteral(value.cooked);
  }

  ObjectPattern(node, last = true) {
    const {type, properties = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    properties.forEach((property, index) => {
      this[property.type](property, index + 1 === properties.length);
    });

    if (properties.length === 0) {
      this.binary += String.fromCharCode(0x00);
    }
  }

  ArrayPattern(node, last = true) {
    const {type, elements = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    elements.forEach((element, index) => {
      if (element !== null) {
        this[element.type](element, false);
      } else {
        this.binary += String.fromCharCode(0x80);
      }
    });
    this.binary += String.fromCharCode(0x00);
  }

  RestElement(node, last = true) {
    const {type, argument} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[argument.type](argument);
  }

  AssignmentPattern(node, last = true) {
    const {type, left, right} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[left.type](left, false);
    this[right.type](right);
  }

  ClassBody(node, last = true) {
    const {type, body = []} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    body.forEach((node, index) => {
      this[node.type](node, index + 1 === body.length);
    });

    if (body.length === 0) {
      this.binary += String.fromCharCode(0x00);
    }
  }

  ClassMethod(node, last = true) {
    const {type, computed, kind, key, params = [], body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (Compiler.METHOD[kind] << 5) | (node['static'] << 4) | (computed << 2));
    this[key.type](key, false);
    params.forEach((param, index) => {
      this[param.type](param, false);
    });
    this[body.type](body);
  }

  ClassProperty(node, last = true) {
    const {type, computed, key, value} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this.binary += String.fromCharCode(0x80 | (computed << 2));
    this[key.type](key, false);
    this[value.type](value);
  }

  ClassDeclaration(node, last = true) {
    const {type, id, superClass, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[id.type](id, false);

    if (superClass !== null) {
      this[superClass.type](superClass, false);
    }

    this[body.type](body);
  }

  ClassExpression(node, last = true) {
    const {type, id, superClass, body} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));

    if (id !== null) {
      this[id.type](id, false);
    } else {
      this.binary += String.fromCharCode(0x80);
    }

    if (superClass !== null) {
      this[superClass.type](superClass, false);
    }

    this[body.type](body);
  }

  MetaProperty(node, last = true) {
    const {type, meta, property} = node;

    this.binary += String.fromCharCode((last ? 0x00 : 0x80) | nodeTypeToByteCodeMap.get(type));
    this[meta.type](meta, false);
    this[property.type](property);
  }
};

Compiler.DECLARE = {"var": 0, "let": 1, "const": 2};
Compiler.METHOD = {"get": 0, "set": 1, "method": 2, "constructor": 3};
Compiler.UNARY = {"-": 0, "+": 1, "!": 2, "~": 3, "typeof": 4, "void": 5, "delete": 6};
Compiler.UPDATE = {"++": 0, "--": 1};
Compiler.BINARY = {"==": 0, "!=": 1, "===": 2, "!==": 3, "<": 4, "<=": 5, ">": 6, ">=": 7, "<<": 8, ">>": 9, ">>>": 10, "+": 11, "-": 12, "*": 13, "/": 14, "%": 15, "|": 16, "^": 17, "&": 18, "in": 19, "instanceof": 20, "**": 21};
Compiler.ASSIGNMENT = {"=": 0, "+=": 1, "-=": 2, "*=": 3, "/=": 4, "%=": 5, "<<=": 6, ">>=": 7, ">>>=": 8, "|=": 9, "^=": 10, "&=": 11};
Compiler.LOGICAL = {"||": 0, "&&": 1};

nodeTypes.forEach((type, index) => {
  const byteCode = index + 32;

  nodeTypeToByteCodeMap.set(type, byteCode);
});
