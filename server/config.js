const path = require("path");

const varsFile = path.resolve(__dirname, "vars.ini");
const fileDir = path.resolve(__dirname, "./files");
const hostsFile = path.resolve(__dirname, "hosts.ini");
const configDir = path.resolve(__dirname, "./configs");
const scriptDir = path.resolve(__dirname, "./scripts");
const batDir = path.resolve(__dirname, "./bats");
const tempDir = path.resolve(__dirname, "./temp");

module.exports = {
  varsFile,
  fileDir,
  hostsFile,
  configDir,
  scriptDir,
  batDir,
  tempDir,
};
