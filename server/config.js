const path = require("path");

function createContext(env) {
  const dir = path.resolve(__dirname, "workspace", env);
  const userDir = path.resolve(__dirname, "workspace", "user");
  const varsFile = path.resolve(dir, "vars.ini");
  const fileDir = path.resolve(dir, "files");
  const hostsFile = path.resolve(dir, "hosts.ini");
  const userFile = path.resolve(userDir, "user.ini");
  const configDir = path.resolve(dir, "configs");
  const scriptDir = path.resolve(dir, "scripts");
  const batDir = path.resolve(dir, "bats");
  const tempDir = path.resolve(dir, "temp");
  const deployDir = path.resolve(dir, "./deploys");
  return {
    dir,
    varsFile,
    fileDir,
    hostsFile,
    userFile,
    configDir,
    scriptDir,
    batDir,
    tempDir,
    deployDir,
  };
}

module.exports = {
  createContext,
};
