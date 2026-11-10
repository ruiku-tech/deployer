'use strict';

const { spawn } = require('child_process');
const pm2Environment = require('../app/service/pm2Environment');
const findPm2Cli = require('../app/service/pm2Cli');

try {
  const cli = findPm2Cli();
  const command = spawn(cli, process.argv.slice(2), { env: pm2Environment(), stdio: 'inherit' });
  command.on('error', error => {
    console.error(error.message);
    process.exitCode = 1;
  });
  command.on('close', code => { process.exitCode = code === null ? 1 : code; });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
