#!/usr/bin/env node
'use strict';

var fs = require('fs');
var path = require('path');
var bean = require('../dst/bean.min');

if (process.argv.length < 3 || process.argv.length > 4) {
  process.exit(1);
}

var chunks = [];

process.stdin.on('data', function (chunk) {
  chunks.push(chunk);
});

process.stdin.on('end', function () {
  function isFlag(flag, value) {
    var concise = '-' + flag.charAt(0);
    var verbose = '--' + flag.charAt(0).toLowerCase() + flag.substr(1).replace(/[A-Z]/g, '-$&');

    return value === concise || value === verbose;
  }

  function fromXxd(input) {
    var output = '';
    var line = /^[\da-f]{7,8}:?((?: *[\da-f]{2}){0,16})/gim;
    var match, index, bytes;

    while ((match = line.exec(input)) !== null) {
      bytes = match[1].match(/[\da-f]{2}/g);

      for (index = 0; index < bytes.length; index++) {
        output += String.fromCharCode(parseInt(bytes[index], 16));
      }
    }

    return output;
  }

  var filepath = path.resolve(process.cwd(), process.argv.pop());
  var filetype = process.argv.length === 3 ? process.argv.pop() : '-r';
  var input = Buffer.concat(chunks).toString('utf8');

  var source;

  if (isFlag('raw', filetype)) {
    source = fs.readFileSync(filepath, 'binary');
  } else if (isFlag('dump', filetype)) {
    source = fromXxd(fs.readFileSync(filepath, 'utf-8'));
  } else {
    return process.exit(1);
  }

  console.log(bean.program(source)(input));
});
