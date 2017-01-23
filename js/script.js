$(function () {
  var source = '';
  var binary = '';

  $.fn.autogrow = function autogrow() {
    this.filter('textarea').each(function () {
      while (this.clientHeight === this.scrollHeight && this.rows > 1) {
        this.rows--;
      }

      while (this.clientHeight < this.scrollHeight) {
        this.rows++;
      }
    });

    return this;
  };

  parseLink();

  function parseLink() {
    var match;

    if ((match = /h=(.*?)(?:&|$)/.exec(location.hash)) !== null) {
      binary = atob(match[1]);
      source = bean.assemble(binary);
    }

    if ((match = /i=(.*?)(?:&|$)/.exec(location.hash)) !== null) {
      $('#input').val(atob(match[1])).autogrow();
    }

    updateStatus();
  }

  function updateStatus() {
    $('#js').text(source.length);
    $('#bn').text(binary.length);
    $('#javascript').val(source).autogrow();
    $('#binary').val(binary).autogrow();
    $('#hexdump').val(toHexdump(binary)).autogrow();

    updateLink();
  }

  function updateLink() {
    var input  = $('#input').val();
    var string = '#h=' + btoa(binary) + '&i=' + btoa(input);

    history.pushState({}, 'Bean Interpreter', string);

    $('#permalink').val('https://patrickroberts.github.io/bean' + string);
  }

  function fromHexdump(string) {
    var pattern = /^([\da-f]{7,8}):?((?: *[\da-f]{2}){0,16})/gim;
    var binary = '';
    var line, match;

    while ((line = pattern.exec(string)) !== null) {
      var inner = / *([\da-f]{2})/gi;

      while ((match = inner.exec(line[2])) !== null) {
        binary += String.fromCharCode(parseInt(match[1], 16));
      }
    }

    return binary;
  }

  function toHexdump(binary) {
    var length = binary.length;
    var string = '';
    var charCode, row, col;

    for (row = 0; row < length + 16; row += 16) {
      string += ('0000000' + Math.min(row, length).toString(16)).substr(-8);

      if (row < length) {
        for (col = 0; col < Math.min(length - row, 16); col++) {
          string += ' ' + ('0' + binary.charCodeAt(row + col).toString(16)).substr(-2);
        }

        for (; col < Math.min(length, 16); col++) {
          string += '   ';
        }

        string += '  ';

        for (col = 0; col < Math.min(length - row, 16); col++) {
          charCode = binary.charCodeAt(row + col);

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

  $(window).bind('hashchange', parseLink);

  $('#javascript').on('change', function updateJavascript(event) {
    $('#output').val('');

    try {
      var string = $('#javascript').val();

      binary = bean.compile(string);
      source = string;
    } catch (error) {
      $('#output').val(error.toString()).autogrow();
    }
  });

  function updateBinary() {
    $('#output').val('');

    try {
      var string = $('#binary').val();

      source = bean.assemble(string);
      binary = string;
    } catch (error) {
      $('#output').val(error.toString()).autogrow();
    }
  }

  $('#binary').on('change', updateBinary);

  $('#hexdump').on('change', function updateHexdump() {
    $('#output').val('');

    try {
      var string = fromHexdump($('#hexdump').val());

      source = bean.assemble(string);
      binary = string;
    } catch (error) {
      $('#output').val(error.toString()).autogrow();
    }
  });

  $('textarea').on('input', function autogrow() { $(this).autogrow(); }).on('change', updateStatus);

  function formatOutput() {
    var array = [];

    for (var i = 0, length = arguments.length; i < length; i++) {
      var argument = arguments[i];

      switch (typeof argument) {
      case 'boolean':
      case 'function':
      case 'number':
      case 'undefined':
        argument += '';
        break;
      case 'object':
      case 'string':
        if (argument === null || argument.constructor !== Object) {
          argument += '';
        } else {
          argument = JSON.stringify(argument);
        }
        break;
      case 'symbol':
      default:
        argument = argument.toString();
        break;
      }

      array.push(argument);
    }

    var output = $('#output').val();

    $('#output').val(output + (output.length > 0 ? '\n' : '') + array.join(', ')).autogrow();
  }

  $('[data-toggle="run"]').on('click', function click(event) {
    var log = console.log;
    console.log = formatOutput;

    $('#output').val('').autogrow();

    try {
      var program = bean.program(binary);
      var output = program($('#input').val());

      console.log(output);
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

    document.execCommand('copy');
  });
});
