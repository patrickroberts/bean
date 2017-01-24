importScripts('https://cdn.rawgit.com/patrickroberts/bean/master/dst/bean.min.js');

console.log = function log() {
  var args = [];

  for (var i = 0; i < arguments.length; i++) {
    args[i] = arguments[i];
  }

  postMessage(args);
};

self.onmessage = function onmessage(event) {
  var binary = event.data.binary;
  var input = event.data.input;
  var program = bean.program(binary);

  postMessage([program(input)]);
  postMessage('');
  close();
}
