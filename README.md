# <img src="https://i.imgur.com/RL0RVy6.png" /> Bean-js

### _An esoteric byte-encoded code-golfing language derived from JavaScript_

Install via `npm`:

```bash
npm install --save bean-js
```

Also works in-browser thanks to `browserify` and is ES5-compatible:

```html
<script src="bean.min.js"></script>
<script>
  var source = '[a+b,A+B,_,$]';
  var uint8array = bean.compile(source);
  var byteCount = uint8array.byteLength;
  var assembly = bean.assemble(uint8array);
  var program = bean.program(uint8array);
  var input = '3\n4';
  var output = program(input);

  byteCount === 19
  assembly === '[a+b,A+B,_,$,];'
  JSON.stringify(output) === '["34",7,["3","4"],[3,4]]'
</script>
```

Online interpreter available [here][github].

#### License

Copyright (c) 2017 Patrick Roberts

[github]: https://patrickroberts.github.io/bean
