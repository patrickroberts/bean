# <img src="http://i.imgur.com/RL0RVy6.png" /> Bean-js

### _An esoteric byte-encoded code-golfing language derived from JavaScript_

Install via `npm`:

```bash
npm install --save bean-js
```

Also works in-browser thanks to `browserify` and is ES5-compatible:

```html
<script src="bean.min.js"></script>
<script>
  var source = document.querySelector('input#source').value;
  var uint8array = bean.compile(source);
  var string = bean.interpret(uint8array);

  eval(string);
</script>
```

#### License

Copyright (c) 2017 Patrick Roberts
