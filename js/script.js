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

      autogrow.call($('#hexdump').val(toHexdump(byteCode)).get(0));
      updateHexdump();
    }

    if ((match = /i=(.*?)(?:&|$)/.exec(location.hash)) !== null) {
      string = atob(match[1]);
      autogrow.call($('#input').val(string).get(0));
    }

    updateStatus();
  }

  function updateStatus() {
    updateLink();
    updateByteCount();
  }

  function updateLink() {
    var input  = $('#input').val();
    var length = byteCode.byteLength;
    var string = '';

    for (var index = 0; index < length; index++) {
      string += String.fromCharCode(byteCode[index]);
    }

    string = '#h=' + btoa(string) + '&i=' + btoa(input);

    history.pushState({}, 'Bean Interpreter', string);

    $('#permalink').val('https://patrickroberts.github.io/bean' + string);
  }

  function updateByteCount() {
    $('#js').text(source.length);
    $('#hd').text(byteCode.byteLength);
  }

  function updateHexdump() {
    var $js = $('#javascript');
    var js;

    try {
      var uint8Array = fromHexdump($('#hexdump').val());

      source = bean.assemble(uint8Array);
      byteCode = uint8Array;

      js = source;
    } catch (error) {
      js = error.toString();
    }

    autogrow.call($js.val(js).get(0));
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

      if (row < length) {
        for (col = 0; col < Math.min(length - row, 16); col++) {
          string += ' ' + ('0' + byteCode[row + col].toString(16)).substr(-2);
        }

        for (; col < Math.min(length, 16); col++) {
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

        string += '\n';
      }
    }

    return string;
  }

  function autogrow() {
    while (this.clientHeight === this.scrollHeight && this.rows > 1) {
      this.rows--;
    }

    while (this.clientHeight < this.scrollHeight) {
      this.rows++;
    }
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

  $(window).bind('hashchange', parseLink);

  $('#javascript').on('change', function change(event) {
    var $hd = $('#hexdump');
    var hd;

    try {
      byteCode = bean.compile(this.value);
      source = this.value;

      hd = toHexdump(byteCode);
    } catch (error) {
      hd = error.toString();
    }

    autogrow.call($hd.val(hd).get(0));
  });

  $('#hexdump').on('change', updateHexdump);

  $('textarea').on('input', autogrow).on('change', updateStatus);

  $('[data-toggle="run"]').on('click', function click(event) {
    var log = console.log;
    console.log = formatOutput;

    autogrow.call($('#output').val('').get(0));

    try {
      var program = bean.program(byteCode);
      var output = program($('#input').val());

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
