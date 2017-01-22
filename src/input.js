function getIdentifier(index, toUpperCase) {
  var identifier = '';

  while (index >= 0) {
    var character = index % 26;
    index = (index - character) / 26 - 1;

    identifier += String.fromCharCode((toUpperCase ? 0x41 : 0x61) + character);
  }

  return identifier;
}

module.exports = function generateInput(stdin) {
  const inputs = stdin.split(/\r?\n/g);
  const parsed = inputs.map(function parse(string, index) {
    var json;

    try {
      JSON.parse(string);
      json = string;
    } catch (error) {
      json = '';
    }

    return json;
  });

  let script = 'var ';

  script += inputs.reduce((script, string, index) => script + getIdentifier(index) + '=' + JSON.stringify(string) + ',', '');
  script += parsed.reduce((script, json, index) => script + (json ? getIdentifier(index, true) + '=' + json + ',' : ''), '');
  script += '_=' + JSON.stringify(inputs) + ',';
  script += '$=[' + parsed.join(',') + '];';

  return script;
};
