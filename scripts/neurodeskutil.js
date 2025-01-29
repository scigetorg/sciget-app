const meow = require('meow');
const fs = require('fs-extra');
const path = require('path');
const https = require('https');

// const neurodesktomlFilePath = path.resolve(__dirname, '../neurodesktop.toml');
const pkgjsonFilePath = path.resolve(__dirname, '../package.json');

const cli = meow(
  `
    Usage
      $ node neurodeskutil <options>

    Options
      --set-neurodesk-version   set Neurodesk version
      --set-tinyrange-version   set TinyRange version
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
      },
      setTinyrangeVersion: {
        type: 'string',
        default: ''
      }
    }
  }
);

if (cli.flags.setNeurodeskVersion !== '') {
  const url = `https://raw.githubusercontent.com/NeuroDesk/neurodesk.github.io/main/data/neurodesktop.toml`;

  https
    .get(url, res => {
      let body = '';

      res.on('data', chunk => {
        body += chunk;
      });

      res.on('end', () => {
        try {
          fs.writeFileSync(path.join(__dirname, '../neurodesktop.toml'), body);

          process.exit(0);
        } catch (error) {
          console.error(error.message);
          process.exit(1);
        }
      });
    })
    .on('error', error => {
      console.error(error.message);
      process.exit(1);
    });
}

if (cli.flags.setTinyrangeVersion !== '') {
  // parse application version
  const pkgjsonFileData = fs.existsSync(pkgjsonFilePath)
    ? fs.readJSONSync(pkgjsonFilePath)
    : undefined;
  if (!pkgjsonFileData) {
    console.error('package.json not found!');
    process.exit(1);
  }

  pkgjsonFileData['tinyrange_version'] = cli.flags.setTinyrangeVersion;
  fs.writeFileSync(pkgjsonFilePath, JSON.stringify(pkgjsonFileData, null, 2));

  console.log(`tinyrange version set to: ${cli.flags.setTinyrangeVersion}`);
  process.exit(0);
}
