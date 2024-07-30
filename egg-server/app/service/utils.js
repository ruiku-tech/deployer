const fs = require('fs');

const varSpliter = '>>';

function parseVars() {
  const varStr = fs.readFileSync(this.varsFile, 'utf-8');
  const lines = varStr.split('\n');
  return lines.reduce((ret, item) => {
    const arr = item.split(varSpliter);
    if (arr[0]) {
      ret[arr[0]] = arr[1].trim();
    }
    return ret;
  }, {});
}
function saveVars(varObj) {
  const varStr = Object.entries(varObj)
    .map(([ k, v ]) => `${k}${varSpliter}${v}`)
    .join('\n');
  fs.writeFileSync(this.varsFile, varStr, 'utf-8');
}
function parseHosts() {
  const ret = JSON.parse(fs.readFileSync(this.hostsFile, 'utf-8') || '{}');
  return Object.entries(ret).reduce((ret, item) => {
    const info = item[1].split(':');
    ret[item[0]] = { host: info[0], password: info[1] };
    return ret;
  }, {});
}

module.exports = {
  parseVars,
  saveVars,
  parseHosts,
};
