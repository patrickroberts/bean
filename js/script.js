$(function () {
  var source = '';
  var byteCode = new Uint8Array(0);

  parseLink();

  function parseLink() {
    var match, string, length, index;

    if ((match = /h=(.*?)(?:&|$)/.exec(location.hash)) !== null) {
      string = atob(match[1]);
      length = string.length;

      byteCode = new Uint8Array(length);

      for (index = 0; index < length; index++) {
        byteCode[index] = string.charCodeAt(index);
      }

      try {
        autogrow.call($('#hexdump').val(toHexdump(byteCode)).get(0));

        source = bean.interpret(byteCode);

        autogrow.call($('#javascript').val(source).get(0));
      } catch (error) {
        autogrow.call($('#javascript').val(error.toString()).get(0));
      }
    }

    if ((match = /i=(.*?)(?:&|$)/.exec(location.hash)) !== null) {
      string = atob(match[1]);
      autogrow.call($('#input').val(string).get(0));
    }

    $('#permalink').val(generateLink(byteCode, $('#input').val()));

    updateByteCount();
  }

  function generateLink(byteCode, input) {
    var length = byteCode.byteLength;
    var string = '';

    for (var index = 0; index < length; index++) {
      string += String.fromCharCode(byteCode[index]);
    }

    string = '#h=' + btoa(string) + '&i=' + btoa(input);

    history.pushState({}, 'Bean Interpreter', string);

    return 'https://patrickroberts.github.io/bean' + string;
  }

  function fromHexdump(string) {
    var pattern = /^([\da-f]{7,8})(?:: *)?((?: +[\da-f]{2}){0,16})/gim;
    var array = [];
    var line, match;

    while ((line = pattern.exec(string)) !== null) {
      var inner = / +([\da-f]{2})/gi;

      while ((match = inner.exec(line[2])) !== null) {
        array.push(parseInt(match[1], 16));
      }
    }

    return Uint8Array.from(array);
  }

  function toHexdump(byteCode) {
    var length = byteCode.byteLength;
    var string = '';
    var charCode, row, col;

    for (row = 0; row < length + 16; row += 16) {
      string += ('0000000' + Math.min(row, length).toString(16)).substr(-8);

      for (col = 0; col < Math.min(length - row, 16); col++) {
        string += ' ' + ('0' + byteCode[row + col].toString(16)).substr(-2);
      }

      for (; col < 16; col++) {
        string += '   ';
      }

      string += '  ';

      for (col = 0; col < Math.min(length - row, 16); col++) {
        charCode = byteCode[row + col];

        if (charCode >= 0x20 && charCode <= 0x7E || charCode >= 0xA0 && charCode !== 0xAD) {
          string += String.fromCharCode(charCode);
        } else {
          string += '.';
        }
      }

      if (row < length) {
        string += '\n';
      }
    }

    return string;
  }

  function updateByteCount() {
    $('#js').text(source.length);
    $('#hd').text(byteCode.byteLength);
  }

  function autogrow() {
    while (this.clientHeight === this.scrollHeight && this.rows > 1) {
      this.rows--;
    }

    while (this.clientHeight < this.scrollHeight) {
      this.rows++;
    }
  }

  function getIdentifier(index, toUpperCase) {
    var identifier = '';

    while (index >= 0) {
      var character = index % 26;
      index = (index - character) / 26 - 1;

      identifier += String.fromCharCode((toUpperCase ? 0x41 : 0x61) + character);
    }

    return identifier;
  }

  function generateInput() {
    var inputs = $('#input').val().split(/\r?\n/g);

    var array = inputs.map(function escape(string, index) {
      return '"' + string.replace(/"/g, '\\"') + '"';
    });

    var parsed = inputs.map(function parse(string, index) {
      var json;

      try {
        JSON.parse(string);
        json = string;
      } catch (error) {
        json = '';
      }

      return json;
    });

    var script = 'var ';

    script += array.reduce(function concat(script, escaped, index) {
      return script + getIdentifier(index) + '=' + escaped + ',';
    }, '');

    script += parsed.reduce(function concat(script, json, index) {
      return script + (json ? getIdentifier(index, true) + '='  : '') + json + ',';
    }, '');

    script += '_=' + JSON.stringify(array) + ',';
    script += '$=[' + parsed.join(',') + '];';

    return script;
  }

  function formatOutput() {
    var array = [];

    for (var i = 0, length = arguments.length; i < length; i++) {
      var argument = arguments[i];

      array.push(JSON.stringify(argument && argument.hasOwnProperty && argument.hasOwnProperty('toString') ? argument.toString() : argument));
    }

    var output = $('#output').val();

    autogrow.call($('#output').val(output + (output.length > 0 ? '\n' : '') + array.join(', ')).get(0));
  }

  $('textarea').on('input', autogrow);

  $('#javascript').on('change', function change(event) {
    try {
      byteCode = bean.compile(this.value);
      source = this.value;

      autogrow.call($('#hexdump').val(toHexdump(byteCode)).get(0));

      $('#permalink').val(generateLink(byteCode, $('#input').val()));
    } catch (error) {
      autogrow.call($('#hexdump').val(error.toString()).get(0));
      $('#permalink').val('malformed source');
    }

    updateByteCount();
  });

  $('#hexdump').on('change', function change(event) {
    try {
      var uint8Array = fromHexdump(this.value);

      source = bean.interpret(uint8Array);
      byteCode = uint8Array;

      autogrow.call($('#javascript').val(source).get(0));

      $('#permalink').val(generateLink(byteCode, $('#input').val()));
    } catch (error) {
      autogrow.call($('#javascript').val(error.toString()).get(0));
      $('#permalink').val('malformed source');
    }

    updateByteCount();
  });

  $('#input').on('change', function change() {
    try {
      bean.interpret(byteCode);

      $('#permalink').val(generateLink(byteCode, $('#input').val()));
    } catch (error) {
      $('#permalink').val('malformed source');
    }
  });

  $('[data-toggle="run"]').on('click', function click(event) {
    var log = console.log;
    console.log = formatOutput;

    $('#output').val('');

    try {
      var program = new Function('', generateInput() + 'return eval("' + bean.interpret(byteCode).replace(/"/g, '\\"') + '")');
      var output = program();

      if (output !== undefined) {
        console.log(output);
      }
    } catch (error) {
      console.log(error.toString());
    }

    console.log = log;
  });

  $('[data-toggle="permalink"]').on('click', function click(event) {
    event.preventDefault();

    var $this = $(this);
    var target = $this.attr('data-target');
    var selector = 'input#permalink:visible';

    $(target)
      .find(selector)
      .addBack(selector)
      .select()
      .get(0)
      .scrollIntoView();
  });
});
