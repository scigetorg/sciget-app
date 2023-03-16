const meow = require('meow');
const fs = require('fs-extra');
const path = require('path');
const config = require('./config');

// const neurodesktomlFilePath = path.resolve(__dirname, '../neurodesktop.toml');

const cli = meow(
  `
    Usage
      $ node neurodeskutil <options>

    Options
      --set-neurodesk-version   set Neurodesk version

    Other options:
      --help                     show usage information

    Examples
      $ node neurodeskutil --set-neurodesk-version 
`,
  {
    flags: {
      setNeurodeskVersion: {
        type: 'string',
        default: ''
      }
    }
  }
);

const config = Config.loadConfig(path.join(__dirname, '..'));

if (cli.flags.setNeurodeskVersion !== '') {
  const url = `https://raw.githubusercontent.com/NeuroDesk/neurodesk.github.io/main/data/neurodesktop.toml`;

  fs.copyFile(url, path.join(__dirname, 'neurodesktop.toml'), (err) => {
    if (err) throw err;
    console.log('source.txt was copied to destination.txt');
  })
}