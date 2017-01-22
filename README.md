# ![Logo][logo] Bean-js

### _An esoteric byte-encoded code-golfing language derived from JavaScript_

Install via `npm`:

```bash
npm install --save bean-js
```

Also works in-browser thanks to `browserify` and is ES5-compatible. Online interpreter available [here][github].

Example usage:

```html
<script src="js/bean.min.js"></script>
<script>
  var binary = bean.compile('[a+b,A+B,_,$]');
  var byteCount = binary.length;
  var source = bean.assemble(binary);
  var program = bean.program(binary);
  var input = '3\n4';
  var output = program(input);

  console.log(byteCount === 19);
  console.log(source === '[a+b,A+B,_,$,];');
  console.log(JSON.stringify(output) === '["34",7,["3","4"],[3,4]]');
</script>
```

### Documentation

#### `bean.compile(source)`

_Arguments_

* `source` An ISO8859-1 encoded string containing valid JavaScript source: e.g. a function or variable declaration, expression, statement, or any combination thereof. An empty input string returns an empty output string.

_Returns_

* `binary` An ISO8859-1 encoded binary string of equivalent Bean source.

_Throws_

* Potentially any error throwable by `babylon.parse(source)`
* `RangeError` if more than 32512 unique identifiers not listed in `globals.json` or `identifiers.json` are parsed from `source`.

#### `bean.assemble(binary)`

_Arguments_

* `binary` An ISO8859-1 encoded binary string containing valid Bean source. An empty input string returns an empty output string.

_Returns_

* `source` An ISO8859-1 encoded binary string of equivalent JavaScript source.

_Throws_

* `RangeError` if more than 32512 unique identifiers not listed in `globals.json` or `identifiers.json` are parsed from `binary`.

#### `bean.program(binary)`

_Arguments_

* `binary` An ISO8859-1 encoded binary string containing valid Bean source. If an empty string is passed, the return value of the output function will be `undefined`, no matter what the input.

_Returns_

* `function program(stdin = "") {...}` A function that optionally accepts standard line-separated input and implicitly initializes input before executing the Bean source. Returns the implicit output of the Bean source, which is the result of the last executed statement.

#### License

Copyright (c) 2017 Patrick Roberts

[logo]: https://i.imgur.com/RL0RVy6.png "Bean Logo"
[github]: https://patrickroberts.github.io/bean
