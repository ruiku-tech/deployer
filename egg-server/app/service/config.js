const path = require('path');
const workspace = path.resolve(process.env.DEPLOY_WORKSPACE || path.resolve(__dirname, '../../workspace'));

function createContext(env) {
  if (typeof env !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(env) || ['user', 'temp'].includes(env)) throw new Error('环境名称无效');
  const dir = path.resolve(workspace, env);
  const userDir = path.resolve(workspace, 'user');
  const varsFile = path.resolve(dir, 'vars.ini');
  const fileDir = path.resolve(dir, 'files');
  const hostsFile = path.resolve(dir, 'hosts.ini');
  const userFile = path.resolve(userDir, 'user.ini');
  const configDir = path.resolve(dir, 'configs');
  const scriptDir = path.resolve(dir, 'scripts');
  const batDir = path.resolve(dir, 'bats');
  const tempDir = path.resolve(dir, 'temp');
  const deployDir = path.resolve(dir, './deploys');
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
function userFile() {
  return path.resolve(__dirname, '../../data', 'user.ini');
}

module.exports = {
  workspace,
  createContext,
  userFile,
};
