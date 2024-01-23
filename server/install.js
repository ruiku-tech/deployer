const fs = require("fs");
const config = require("./config");

function check() {
  if (!fs.existsSync(config.varsFile)) {
    fs.writeFileSync(config.varsFile, "", "utf-8");
  }
  if (!fs.existsSync(config.fileDir)) {
    fs.mkdirSync(config.fileDir);
  }
  if (!fs.existsSync(config.hostsFile)) {
    fs.writeFileSync(config.hostsFile, "", "utf-8");
  }
  if (!fs.existsSync(config.configDir)) {
    fs.mkdirSync(config.configDir);
  }
  if (!fs.existsSync(config.scriptDir)) {
    fs.mkdirSync(config.scriptDir);
  }
  if (!fs.existsSync(config.batDir)) {
    fs.mkdirSync(config.batDir);
  }
  if (!fs.existsSync(config.tempDir)) {
    fs.mkdirSync(config.tempDir);
  }
}

module.exports = {
  check,
};
