const config = require("../server/config");
const { exec } = require("child_process");
const fs = require("fs");
const path = require("path");

const context = config.createContext("test");

fs.mkdirSync(context.dir);

const dir = path.resolve(__dirname, "../server");
const varsFile = path.resolve(dir, "vars.ini");
const fileDir = path.resolve(dir, "files");
const hostsFile = path.resolve(dir, "hosts.ini");
const userFile = path.resolve(dir, "user.ini");
const configDir = path.resolve(dir, "configs");
const scriptDir = path.resolve(dir, "scripts");
const batDir = path.resolve(dir, "bats");
const tempDir = path.resolve(dir, "temp");
const deployDir = path.resolve(dir, "./deploys");
exec(`cp -rf "${varsFile}" ${context.varsFile}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${varsFile},failed!!`, error.message);
  }
  console.log(`${varsFile}, success`);
});
exec(`cp -rf "${fileDir}" ${context.fileDir}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${fileDir},failed!!`, error.message);
  }
  console.log(`${fileDir}, success`);
});
exec(`cp -rf "${hostsFile}" ${context.hostsFile}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${hostsFile},failed!!`, error.message);
  }
  console.log(`${hostsFile}, success`);
});
exec(`cp -rf "${userFile}" ${context.userFile}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${userFile},failed!!`, error.message);
  }
  console.log(`${userFile}, success`);
});
exec(`cp -rf "${configDir}" ${context.configDir}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${configDir},failed!!`, error.message);
  }
  console.log(`${configDir}, success`);
});
exec(`cp -rf "${scriptDir}" ${context.scriptDir}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${scriptDir},failed!!`, error.message);
  }
  console.log(`${scriptDir}, success`);
});
exec(`cp -rf "${batDir}" ${context.batDir}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${batDir},failed!!`, error.message);
  }
  console.log(`${batDir}, success`);
});
exec(`cp -rf "${tempDir}" ${context.tempDir}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${tempDir},failed!!`, error.message);
  }
  console.log(`${tempDir}, success`);
});
exec(`cp -rf "${deployDir}" ${context.deployDir}`, (error, stdout, stderr) => {
  if (error) {
    return console.log(`${deployDir},failed!!`, error.message);
  }
  console.log(`${deployDir}, success`);
});
