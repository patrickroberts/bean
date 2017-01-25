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

    if ((match = /f=1(?:&|$)/.exec(location.hash)) !== null) {
      $('.btn-format').addClass('active');
    }

    if ((match = /w=0(?:&|$)/.exec(location.hash)) !== null) {
      $('.btn-worker').removeClass('active');
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
    var format = $('.btn-format').hasClass('active');
    var worker = $('.btn-worker').hasClass('active');
    var string = '#h=' + btoa(binary) + '&i=' + btoa(input) + '&f=' + (format ? 1 : 0) + '&w=' + (worker ? 1 : 0);

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

  $('[data-toggle="tooltip"]').tooltip();

  $('#javascript').on('change', function updateJavascript(event) {
    $('#output').val('').autogrow();

    try {
      var string = $('#javascript').val();

      binary = bean.compile(string);
      source = string;
    } catch (error) {
      $('#output').val(error.toString()).autogrow();
    }
  });

  function updateBinary() {
    $('#output').val('').autogrow();

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
    $('#output').val('').autogrow();

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
    var output = $('#output').val();

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
        if (argument === null || argument.constructor !== Object && typeof argument !== 'string' && !Array.isArray(argument) || !$('.btn-format').hasClass('active')) {
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

    $('#output').val(output + (output.length > 0 ? '\n' : '') + array.join(', ')).autogrow();

    log.apply(console, arguments);
  }

  var log = console.log;

  console.log = formatOutput;

  function toggleAction(label) {
    var $btn = $('.btn-run')
      .toggleClass('btn-primary btn-danger')

    $btn
      .find('.action-label')
      .text(label);

    $btn
      .find('.glyphicon')
      .toggleClass('glyphicon-play glyphicon-stop');
  }

  $('.btn-run').on('click', function clickRun(event) {
    if ($(this).hasClass('btn-danger')) {
      return;
    }

    $('#output').val('').autogrow();

    if ($('.btn-worker').hasClass('active') && typeof Worker === 'function') {
      var worker = new Worker('js/worker.js');

      function killWorker() {
        worker.terminate();
        toggleAction('Run');
        $('.btn-run').off('click', killWorker);
      }

      worker.onmessage = function onmessage(event) {
        if (event.data) {
          formatOutput.apply(window, event.data);
        } else {
          killWorker();
        }
      };

      worker.onerror = function onerror(event) {
        formatOutput(event.message);
        killWorker();
      };

      worker.postMessage({
        binary: binary,
        input: $('#input').val()
      });

      toggleAction('Kill');
      $('.btn-run').one('click', killWorker);
    } else if (typeof Worker !== 'function') {
      alert('Web Workers are unsupported on your browser. If your program is expected to run for more than a few seconds, use a browser that supports Web Workers.');
    } else {
      try {
        var program = bean.program(binary);
        var output = program($('#input').val());

        console.log(output);
      } catch (error) {
        console.log(error.toString());
      }
    }
  });

  $('.btn-option').on('click', function clickOption(event) {
    $(this).toggleClass('active');
    updateLink();
  });

  $('.btn-permalink').on('click', function clickPermalink(event) {
    event.preventDefault();

    $('#permalink')
      .select()
      .get(0)
      .scrollIntoView();

    document.execCommand('copy');
  });
});
