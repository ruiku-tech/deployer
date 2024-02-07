const fs = require("fs");
const config = require("./config");
const path = require("path");
const { exec } = require("child_process");

function create(env) {
  const context = config.createContext(env);

  if (!fs.existsSync(context.dir)) {
    fs.mkdirSync(context.dir);
  }

  if (!fs.existsSync(context.varsFile)) {
    fs.writeFileSync(context.varsFile, "", "utf-8");
  }
  if (!fs.existsSync(context.fileDir)) {
    fs.mkdirSync(context.fileDir);
  }
  if (!fs.existsSync(context.hostsFile)) {
    fs.writeFileSync(context.hostsFile, "", "utf-8");
  }
  if (!fs.existsSync(context.configDir)) {
    fs.mkdirSync(context.configDir);
  }
  if (!fs.existsSync(context.scriptDir)) {
    fs.mkdirSync(context.scriptDir);
  }
  if (!fs.existsSync(context.batDir)) {
    fs.mkdirSync(context.batDir);
  }
  if (!fs.existsSync(context.tempDir)) {
    fs.mkdirSync(context.tempDir);
  }
  if (!fs.existsSync(context.deployDir)) {
    fs.mkdirSync(context.deployDir);
  }
}

function copy(env, src) {
  const context = config.createContext(env);
  const srcContext = config.createContext(src);

  return new Promise((resolve, reject) => {
    exec(
      `cp -rf "${srcContext.dir}" "${context.dir}"`,
      (error, stdout, stderr) => {
        if (error) {
          reject({ err: error.message });
          return;
        }
        if (stderr) {
          reject({ err: stderr });
          return;
        }
        resolve();
      }
    );
  });
}
function destory(env){
  const context = config.createContext(env);
  return new Promise((resolve, reject) => {
    exec(
      `rm -rf "${context.dir}"`,
      (error, stdout, stderr) => {
        if (error) {
          reject({ err: error.message });
          return;
        }
        if (stderr) {
          reject({ err: stderr });
          return;
        }
        resolve();
      }
    );
  });
}

module.exports = {
  create,
  copy,
  destory
};
